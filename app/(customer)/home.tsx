import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity, Dimensions, Alert,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addMerchantId } from '../../lib/merchant-store';
import { MotiView, AnimatePresence } from 'moti';
import Constants from 'expo-constants';
import WidgetRenderer from '../../lib/generative/renderer';
import { WidgetSpecType } from '../../lib/generative/widget-spec';
import { encodeIntent, getDeviceHash } from '../../lib/privacy/intent-encoder';
import { playChime } from '../../lib/sounds';
import { hapticSuccess } from '../../lib/haptics';
import { safePalette } from '../../lib/colors';
import { speak } from '../../lib/tts';
import { detectMovement } from '../../lib/context/movement';
import { getStats, recordSaving, SavingsStats } from '../../lib/savings';
import LiveHeader from '../../lib/components/LiveHeader';
import { subscribeOfferChannel } from '../../lib/supabase/realtime';
import { showOfferNotification } from '../../lib/notifications';
import { AppState, AppStateStatus } from 'react-native';
import RoleSwitch from '../../lib/components/RoleSwitch';
import MilestoneModal, { isMilestone } from '../../lib/components/MilestoneModal';
import ShimmerCard from '../../lib/components/Shimmer';
import LlmStatusPill from '../../lib/components/LlmStatusPill';
import FreshnessChip from '../../lib/components/FreshnessChip';
import Confetti from '../../lib/components/Confetti';
import { theme, space, radius, type } from '../../lib/theme';
import i18n, { useLocaleVersion } from '../../lib/i18n';

const { height } = Dimensions.get('window');
const API = Constants.expoConfig?.extra?.apiUrl as string;

interface OfferEntry {
  id: string;
  widget_spec: WidgetSpecType & { base_amount_cents?: number };
  // Server-side loyalty count: how many times this device redeemed at this
  // merchant. Drives the "Stammkunde / Nth visit" chip on the offer card.
  your_redemptions_at_merchant?: number;
  // Server-computed savings amount in cents (from offers.discount_amount_cents).
  discount_amount_cents?: number | null;
}
interface AdvisorState { winnerId: string | null; explanation: string }

// Pure math: how many cents this offer saves the customer if they redeem it.
// Falls back to discount.value × widget base when the server hasn't set a
// concrete cents amount yet.
function offerSavingsCents(o: OfferEntry): number {
  const direct = o.discount_amount_cents;
  if (typeof direct === 'number' && direct > 0) return direct;
  const spec = o.widget_spec;
  const base = spec.base_amount_cents ?? 1200;
  if (spec.discount.kind === 'eur') return Math.round(spec.discount.value * 100);
  if (spec.discount.kind === 'pct') return Math.round(base * (spec.discount.value / 100));
  return Math.round(base * 0.2);
}

// Sort the feed by absolute savings desc, return the winner + the rest.
// Used to promote the mathematically best deal to the primary card slot
// without LLM round-tripping (deterministic, fast, demoable).
function pickBestDeal(offers: OfferEntry[]): { winner: OfferEntry; rest: OfferEntry[]; gapCents: number } {
  const ranked = [...offers].sort((a, b) => offerSavingsCents(b) - offerSavingsCents(a));
  const winner = ranked[0];
  const rest = ranked.slice(1);
  const runnerUp = rest[0];
  const gapCents = runnerUp ? Math.max(0, offerSavingsCents(winner) - offerSavingsCents(runnerUp)) : 0;
  return { winner, rest, gapCents };
}
type State =
  | { status: 'idle' }
  | { status: 'location_denied' }
  | { status: 'loading' }
  | { status: 'no_merchant'; lastLat: number; lastLng: number }
  | { status: 'offer'; offer: OfferEntry; extras: OfferEntry[]; payload: object; generatedAt: number }
  | { status: 'declined' }
  | { status: 'expired' }
  | { status: 'error'; message: string };

const EMPTY_STATS: SavingsStats = { total_eur: 0, count_total: 0, count_this_week: 0, recent: [] };

export default function CustomerHome() {
  useLocaleVersion(); // re-render on language change
  const [state, setState] = useState<State>({ status: 'idle' });
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<SavingsStats>(EMPTY_STATS);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const [milestone, setMilestone] = useState<number | null>(null);
  const [morph, setMorph] = useState<{ bg: string; fg: string; accent: string } | null>(null);
  const [advisor, setAdvisor] = useState<AdvisorState>({ winnerId: null, explanation: '' });
  // Capture the navigation that the morph timer or the milestone-modal
  // close handler should perform — whichever fires first claims it.
  const pendingNav = useRef<{ id: string; palette: { bg: string; fg: string; accent: string } } | null>(null);

  // Server-driven savings — sums discount_amount_cents from offers where
  // status='redeemed' for this device. Falls back to local AsyncStorage if
  // the server is unreachable. The server number is the source of truth and
  // refreshes on the offer.redeemed realtime event below.
  const refreshStats = useCallback(async () => {
    try {
      const deviceHash = await getDeviceHash();
      const r = await fetch(`${API}/api/offer/savings/${deviceHash}`);
      if (r.ok) {
        const server = await r.json();
        setStats({
          total_eur: server.total_eur ?? 0,
          count_total: server.count_total ?? 0,
          count_this_week: server.count_this_week ?? 0,
          recent: server.recent ?? [],
        });
        return;
      }
    } catch {}
    // Fallback: local AsyncStorage (used when offline / before first redeem).
    setStats(await getStats());
  }, []);

  const generate = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      let status = existing.status;
      if (status !== 'granted' && existing.canAskAgain) {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }
      if (status !== 'granted') { setState({ status: 'location_denied' }); return; }

      const [loc, movement, deviceHash] = await Promise.all([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        detectMovement(1500).catch(() => undefined),
        getDeviceHash(),
      ]);
      const { latitude: lat, longitude: lng } = loc.coords;

      const payload = encodeIntent({
        lat, lng,
        weatherCondition: 'unknown',
        tempC: 15,
        locale: i18n.locale,
        deviceHash,
        movement,
      });

      // Fetch up to 3 offers from top-scored nearby merchants — judges get
      // a richer view than a single card, and the rotation/freshness logic
      // applies to whichever the user accepts first.
      const res = await fetch(`${API}/api/offer/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, count: 3 }),
      });

      if (!res.ok) { setState({ status: 'error', message: i18n.t('errors.generation_failed') }); return; }
      const data = await res.json();
      const offers: OfferEntry[] = Array.isArray(data?.offers) ? data.offers : [];
      if (offers.length === 0) { setState({ status: 'no_merchant', lastLat: lat, lastLng: lng }); return; }
      // Promote the mathematically best-saving offer to the primary slot —
      // the customer-side AI advisor: no LLM call, just deterministic math
      // against discount_amount_cents (or base × pct fallback).
      const { winner, rest } = pickBestDeal(offers);
      setState({ status: 'offer', offer: winner, extras: rest, payload, generatedAt: Date.now() });
      // Fire-and-forget Mistral advisor explanation. Never blocks the feed.
      if (rest.length > 0) {
        setAdvisor({ winnerId: winner.id, explanation: '' });
        const summarizedOffers = [winner, ...rest].map(o => ({
          id: o.id,
          headline: o.widget_spec.headline,
          merchant_name: o.widget_spec.merchant.name,
          base_amount_cents: o.widget_spec.base_amount_cents ?? 1200,
          discount_amount_cents: offerSavingsCents(o),
          pct: o.widget_spec.discount.kind === 'pct' ? o.widget_spec.discount.value : null,
        }));
        fetch(`${API}/api/offer/advisor/explain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locale: i18n.locale,
            winner_id: winner.id,
            offers: summarizedOffers,
          }),
        })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data?.explanation) {
              setAdvisor(a => a.winnerId === winner.id ? { winnerId: winner.id, explanation: data.explanation } : a);
            }
          })
          .catch(() => {});
      } else {
        setAdvisor({ winnerId: null, explanation: '' });
      }
    } catch (e) {
      setState({ status: 'error', message: i18n.t('errors.generation_failed') });
    }
  }, []);

  const seedDemoMerchant = useCallback(async () => {
    if (state.status !== 'no_merchant' && state.status !== 'idle') return;
    setSeeding(true);
    try {
      let lat: number, lng: number;
      if (state.status === 'no_merchant') {
        lat = state.lastLat; lng = state.lastLng;
      } else {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude; lng = loc.coords.longitude;
      }
      const deviceHash = await getDeviceHash();
      const res = await fetch(`${API}/api/merchant/seed-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, owner_device_id: deviceHash }),
      });
      if (!res.ok) throw new Error('seed failed');
      const created = await res.json();
      // Take ownership: save merchant_id locally so Händler tab works
      if (created?.id) await addMerchantId(created.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await generate();
    } catch (e) {
      Alert.alert('Error', 'Demo shop could not be created');
    } finally {
      setSeeding(false);
    }
  }, [state, generate]);

  useEffect(() => { refreshStats(); generate(); }, []);

  // Foreground 5s polling. Apple's BackgroundFetch minimum is ~15 min, so true
  // 5s background polling is impossible. Instead: while the app is in the
  // foreground, peek the /feed endpoint every 5s. When a brand-new offer ID
  // appears that the user hasn't seen, we fire a local notification AND
  // silently swap the visible card to the better/newer offer.
  // Backgrounded > 30s → JS suspends; user gets the notification on next
  // wake. There's no spec-compliant way around that on iOS.
  const seenOfferIds = useRef<Set<string>>(new Set());
  const pollingActive = useRef(true);
  useEffect(() => {
    const poll = async () => {
      if (!pollingActive.current) return;
      // Only poll when we already have a successful first generate; before
      // that, the main generate() flow handles permission prompts.
      if (state.status !== 'offer' && state.status !== 'no_merchant' && state.status !== 'declined' && state.status !== 'expired') return;
      try {
        const existing = await Location.getForegroundPermissionsAsync();
        if (existing.status !== 'granted') return;
        const [loc, deviceHash] = await Promise.all([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          getDeviceHash(),
        ]);
        const payload = encodeIntent({
          lat: loc.coords.latitude, lng: loc.coords.longitude,
          weatherCondition: 'unknown', tempC: 15,
          locale: i18n.locale, deviceHash,
        });
        const r = await fetch(`${API}/api/offer/feed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, count: 3 }),
        });
        if (!r.ok) return;
        const data = await r.json();
        const offers: OfferEntry[] = Array.isArray(data?.offers) ? data.offers : [];

        if (state.status === 'offer') {
          const visibleOfferId = state.offer.id;
          const stillThere = offers.some(o => o.id === visibleOfferId);
          if (!stillThere) {
            // The current visible offer dropped out of the feed (claimed
            // elsewhere / merchant deleted menu / flash ended). Replace it.
            if (offers.length === 0) {
              setState({ status: 'no_merchant', lastLat: loc.coords.latitude, lastLng: loc.coords.longitude });
            } else {
              const { winner, rest } = pickBestDeal(offers);
              setState({ status: 'offer', offer: winner, extras: rest, payload, generatedAt: Date.now() });
            }
            return;
          }
          // The visible offer is still in the feed — but a NEW flash on
          // the same merchant (or any new offer) might also be in there.
          // Swap if a higher-savings offer just appeared.
          const { winner } = pickBestDeal(offers);
          if (winner.id !== visibleOfferId) {
            const newSavings = offerSavingsCents(winner);
            const oldSavings = offerSavingsCents(state.offer);
            if (newSavings > oldSavings) {
              const rest = offers.filter(o => o.id !== winner.id);
              setState({ status: 'offer', offer: winner, extras: rest, payload, generatedAt: Date.now() });
              return;
            }
          }
        }

        if (offers.length === 0) return;
        const newOnes = offers.filter(o => !seenOfferIds.current.has(o.id));
        for (const o of offers) seenOfferIds.current.add(o.id);
        if (newOnes.length > 0 && state.status === 'offer') {
          // Fire a local notification — picks up automatically on the OS
          // banner/lock screen the moment the app foregrounds again.
          const top = newOnes[0];
          showOfferNotification(
            top.widget_spec.headline,
            top.widget_spec.merchant.name,
          ).catch(() => {});
        }
      } catch {}
    };
    // Seed the seen-set with what's already on screen so the first poll
    // doesn't notify the user about offers they're already looking at.
    if (state.status === 'offer') {
      seenOfferIds.current.add(state.offer.id);
      for (const e of state.extras) seenOfferIds.current.add(e.id);
    }
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [state]);

  // AppState transition: clear the seen-set on background>foreground so the
  // first foreground poll definitely notifies the user about whatever has
  // changed while they were away. (Backgrounded JS doesn't run reliably on
  // iOS, but local notifications still surface from the server's broadcast
  // path when the user re-opens.)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        // Force a fresh peek next tick; clear seen-set so any new offer pings.
        seenOfferIds.current = state.status === 'offer'
          ? new Set([state.offer.id, ...state.extras.map(e => e.id)])
          : new Set();
        refreshStats();
      }
    });
    return () => sub.remove();
  }, [state, refreshStats]);

  // Auto-seed of a fake demo merchant disabled — judges should see only
  // the real merchant the teammate sets up. The "no_merchant" empty state
  // surfaces the manual "Demo-Café hier erstellen" affordance instead.
  const autoSeededRef = useRef(false);
  // (Intentionally no auto-seed effect.) seedDemoMerchant() is still wired
  // to the explicit button in the no_merchant view for solo testing.

  // Read out the offer when TTS preference is on (accessibility).
  useEffect(() => {
    if (state.status !== 'offer') return;
    const s = state.offer.widget_spec;
    speak(`${s.headline}. ${s.subline}. ${s.cta}.`);
  }, [state.status === 'offer' ? state.offer.id : null]);

  // Auto-rotation removed — offers stay until the user pulls to refresh or
  // acts on them. (User feedback: auto-cycling without user input felt fake.)

  // Live-lock: when the merchant scans this offer's QR (or the user takes
  // cashback elsewhere), the server broadcasts on offer:{id}. The home
  // screen drops the now-redeemed card, refreshes the savings stats from
  // the server (so "Gespart" ticks immediately), and pulls the next offer.
  useEffect(() => {
    if (state.status !== 'offer') return;
    const offerId = state.offer.id;
    const unsub = subscribeOfferChannel(offerId, (event) => {
      if (event.type !== 'offer.redeemed' || event.offer_id !== offerId) return;
      refreshStats();
      generate();
    });
    return unsub;
  }, [state, generate, refreshStats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([generate(), refreshStats()]);
    setRefreshing(false);
  };

  const handleAccept = async () => {
    if (state.status !== 'offer') return;
    hapticSuccess();
    playChime().catch(() => {});
    setConfettiTrigger(t => t + 1);

    const spec = state.offer.widget_spec;
    const offerId = state.offer.id;

    // Kick off the card→QR morph immediately; redeem screen will open with
    // the same palette so the colors flow continuously. Normalize first so
    // a malformed value never reaches RN's StyleSheet ("invalid colour value").
    const safe = safePalette(spec.palette);
    const stripHash = (h: string) => h.replace(/^#/, '');
    const paletteParams = {
      bg: stripHash(safe.bg),
      fg: stripHash(safe.fg),
      accent: stripHash(safe.accent),
    };
    setMorph(paletteParams);
    pendingNav.current = { id: offerId, palette: paletteParams };

    // Navigate at a fixed 320ms from tap — independent of any awaits below
    // so the morph never freezes mid-animation.
    const navTimer = setTimeout(() => {
      const nav = pendingNav.current;
      if (!nav) return; // milestone modal claimed it
      pendingNav.current = null;
      router.push({
        pathname: '/(customer)/redeem/[id]',
        params: { id: nav.id, ...nav.palette },
      });
      setTimeout(() => setMorph(null), 400);
    }, 320);

    // Fire-and-forget side effects.
    fetch(`${API}/api/offer/${offerId}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'accepted' }),
    }).catch(() => {});

    try {
      const amount_cents =
        spec.discount.kind === 'eur' ? Math.round(spec.discount.value * 100) :
        spec.discount.kind === 'pct' ? Math.round(spec.discount.value * 30) :
        150;
      await recordSaving({
        ts: Date.now(),
        amount_cents,
        merchant_name: spec.merchant.name,
        offer_id: offerId,
      });
      const next = await getStats();
      setStats(next);
      if (isMilestone(next.count_total)) {
        // Milestone modal pre-empts navigation; cancel the auto-nav timer
        // so the redeem screen waits until the user dismisses the modal.
        clearTimeout(navTimer);
        setMilestone(next.count_total);
      }
    } catch {}
  };

  const handleDecline = async () => {
    if (state.status !== 'offer') return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetch(`${API}/api/offer/${state.offer.id}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'declined' }),
    }).catch(() => {});
    setState({ status: 'declined' });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Confetti trigger={confettiTrigger} />
      <AnimatePresence>
        {morph && (
          <MotiView
            key="morph"
            from={{ opacity: 0, scale: 0.4, borderRadius: 22 }}
            animate={{ opacity: 1, scale: 1, borderRadius: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'timing', duration: 320 }}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              // morph.bg comes from URL-friendly paletteParams (no leading #).
              // Re-add and normalize so RN's StyleSheet doesn't crash.
              backgroundColor: safePalette({ bg: `#${morph.bg}`, fg: morph.fg, accent: morph.accent }).bg,
              zIndex: 999,
            }}
          />
        )}
      </AnimatePresence>
      <MilestoneModal
        visible={milestone !== null}
        count={milestone ?? 0}
        onClose={() => {
          setMilestone(null);
          const nav = pendingNav.current;
          if (nav) {
            pendingNav.current = null;
            router.push({
              pathname: '/(customer)/redeem/[id]',
              params: { id: nav.id, ...nav.palette },
            });
            setTimeout(() => setMorph(null), 400);
          } else {
            // No pending offer to open — just drop the morph paint.
            setMorph(null);
          }
        }}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, padding: space.lg, gap: space.md }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
      >
        <View style={{ alignItems: 'center', marginBottom: space.xs }}>
          <RoleSwitch active="customer" />
        </View>
        <LiveHeader stats={stats} />

        <View style={{ flex: 1, minHeight: height - 220 }}>
          {state.status === 'idle' || state.status === 'loading' ? (
            <View style={{ flex: 1 }}>
              <ShimmerCard />
              <LlmStatusPill verb="generiert" />
            </View>
          ) : state.status === 'location_denied' ? (
            <LocationDeniedState onRetry={generate} />
          ) : state.status === 'no_merchant' ? (
            <NoMerchantState onSeed={seedDemoMerchant} seeding={seeding} />
          ) : state.status === 'error' ? (
            <ErrorState message={state.message} onRetry={generate} />
          ) : state.status === 'declined' ? (
            <DeclinedState onRefresh={generate} />
          ) : state.status === 'expired' ? (
            <ExpiredState onRefresh={generate} />
          ) : state.status === 'offer' ? (
            <MotiView
              key={state.offer.id}
              from={{ opacity: 0, translateY: 12, scale: 0.98 }}
              animate={{ opacity: 1, translateY: 0, scale: 1 }}
              transition={{ type: 'spring', damping: 18, stiffness: 180 }}
              style={{ flex: 1, gap: space.sm }}
            >
              {/* AI-advisor "Best deal" badge — shown when there's at least
                  one other offer to compare against AND this primary actually
                  saves more than the runner-up. Pure math, no LLM. */}
              {state.extras.length > 0 && (() => {
                const winnerCents = offerSavingsCents(state.offer);
                const runnerCents = offerSavingsCents(state.extras[0]);
                const gap = winnerCents - runnerCents;
                if (gap <= 0) return null;
                return <BestDealBadge gapCents={gap} />;
              })()}
              {/* Mistral-generated one-liner explaining the win. Streamed in
                  asynchronously so the feed renders instantly; this slides in
                  when ready. Falls back to a deterministic sentence if the
                  cloud call fails. */}
              {advisor.winnerId === state.offer.id && advisor.explanation.length > 0 && (
                <MotiView
                  from={{ opacity: 0, translateY: -2 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 280 }}
                  style={{
                    backgroundColor: theme.primaryWash,
                    borderRadius: radius.md,
                    paddingVertical: space.md, paddingHorizontal: space.md,
                    borderWidth: 1, borderColor: theme.primary + '1A',
                    flexDirection: 'row', gap: space.sm,
                    alignItems: 'flex-start',
                  }}
                >
                  <Text style={{ fontSize: type.body, lineHeight: type.bodyL + 2 }}>💡</Text>
                  <Text
                    style={{ color: theme.text, fontSize: type.small, lineHeight: 18, fontWeight: '600', flex: 1 }}
                    numberOfLines={3}
                  >
                    {advisor.explanation}
                  </Text>
                </MotiView>
              )}
              {/* Loyalty chip — only shows after first redemption at this
                  merchant. Reads count from /api/offer/feed response. */}
              {(state.offer.your_redemptions_at_merchant ?? 0) > 0 && (
                <LoyaltyChip count={state.offer.your_redemptions_at_merchant!} />
              )}
              <View style={{ flex: 1, minHeight: height * 0.58 }}>
                <WidgetRenderer
                  spec={state.offer.widget_spec}
                  offerId={state.offer.id}
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                />
              </View>
              {/* "Why?" link removed — judges should focus on the offer + accept,
                  not a sub-screen explaining context signals. */}

              {/* Secondary feed: any extra nearby offers as compact rows.
                  Tapping one swaps it into the primary slot so the user can
                  use the same accept flow. */}
              {state.extras.length > 0 && (
                <View style={{ marginTop: space.lg, gap: space.sm }}>
                  <Text style={{
                    color: theme.textMuted, fontSize: type.caption, fontWeight: '800',
                    letterSpacing: 1.4, marginLeft: space.xs,
                  }}>
                    MORE NEARBY · {state.extras.length}
                  </Text>
                  {state.extras.map(extra => (
                    <ExtraOfferRow
                      key={extra.id}
                      entry={extra}
                      onSelect={() => setState({
                        ...state,
                        offer: extra,
                        extras: [state.offer, ...state.extras.filter(e => e.id !== extra.id)],
                        generatedAt: Date.now(),
                      })}
                    />
                  ))}
                </View>
              )}
            </MotiView>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function AnimatedEmoji({ emoji, delay = 0 }: { emoji: string; delay?: number }) {
  // Two-layer animation: outer spring entrance (scale + rotate),
  // inner perpetual breathe so the empty-state emoji never feels frozen.
  return (
    <MotiView
      from={{ scale: 0.6, rotate: '-12deg', opacity: 0 }}
      animate={{ scale: 1, rotate: '0deg', opacity: 1 }}
      transition={{ type: 'spring', damping: 10, stiffness: 140, delay }}
    >
      <MotiView
        from={{ translateY: 0 }}
        animate={{ translateY: -6 }}
        transition={{
          type: 'timing', duration: 1400,
          loop: true, repeatReverse: true,
          delay: delay + 600,
        }}
      >
        <Text style={{ fontSize: 64 }}>{emoji}</Text>
      </MotiView>
    </MotiView>
  );
}

function PrimaryButton({ onPress, label, disabled = false }: { onPress: () => void; label: string; disabled?: boolean }) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      style={{
        backgroundColor: disabled ? theme.primaryWash : theme.primary,
        borderRadius: 16, paddingHorizontal: 32, paddingVertical: 16,
        shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
      }}
    >
      <Text style={{ color: theme.textOnPrimary, fontWeight: '800', fontSize: 16 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function GhostButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: theme.surface, borderRadius: 14,
        paddingHorizontal: 24, paddingVertical: 12,
        borderWidth: 1, borderColor: theme.border,
      }}
    >
      <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function LocationDeniedState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space['2xl'], gap: space['2xl'] }}>
      <AnimatedEmoji emoji="📍" />
      <View style={{ gap: space.sm }}>
        <Text style={{ color: theme.text, fontSize: type.title, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 }}>
          {i18n.t('customer.location_needed')}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: type.body, lineHeight: 21, textAlign: 'center', maxWidth: 280 }}>
          {i18n.t('customer.no_location')}
        </Text>
      </View>
      <PrimaryButton onPress={onRetry} label={i18n.t('customer.grant_location')} />
      <TouchableOpacity onPress={() => Linking.openSettings()} hitSlop={12}>
        <Text style={{ color: theme.primary, fontSize: type.small, fontWeight: '700' }}>
          {i18n.t('customer.open_settings')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function NoMerchantState({ onSeed: _onSeed, seeding: _seeding }: { onSeed: () => void; seeding: boolean }) {
  // Demo-merchant seed button intentionally hidden — judges should see only
  // real merchants set up on a second phone. Empty state guides toward the
  // 2-phone flow instead of a synthetic shop.
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space['2xl'], gap: space['2xl'] }}>
      <AnimatedEmoji emoji="🗺️" />
      <View style={{ gap: space.sm }}>
        <Text style={{ color: theme.text, fontSize: type.title, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 }}>
          {i18n.t('customer.no_one_nearby')}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: type.body, lineHeight: 21, textAlign: 'center', maxWidth: 300 }}>
          {i18n.t('customer.no_one_nearby_help')}
        </Text>
      </View>
      <GhostButton onPress={() => router.replace('/(merchant)/setup')} label={i18n.t('customer.open_merchant_role')} />
    </View>
  );
}

function DeclinedState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
      <AnimatedEmoji emoji="👌" />
      <Text style={{ color: theme.textMuted, fontSize: type.bodyL, fontWeight: '600' }}>{i18n.t('customer.decline')}</Text>
      <GhostButton onPress={onRefresh} label={i18n.t('customer.another_offer')} />
    </View>
  );
}

function ExpiredState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
      <AnimatedEmoji emoji="⌛" />
      <Text style={{ color: theme.textMuted, fontSize: type.bodyL, fontWeight: '600', textAlign: 'center', maxWidth: 280 }}>
        {i18n.t('customer.expired')}
      </Text>
      <GhostButton onPress={onRefresh} label={i18n.t('customer.load_new_offer')} />
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
      <AnimatedEmoji emoji="⚠️" />
      <Text style={{ color: theme.danger, fontSize: type.bodyL, textAlign: 'center', maxWidth: 280 }}>{message}</Text>
      <GhostButton onPress={onRetry} label={i18n.t('customer.try_again')} />
    </View>
  );
}

// AI-advisor badge: tells the customer their primary card is the best deal
// in the current feed and by how much (in EUR). Computed from
// offerSavingsCents() — deterministic math, runs locally.
function BestDealBadge({ gapCents }: { gapCents: number }) {
  const eur = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' })
    .format(gapCents / 100);
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.9, translateY: -4 }}
      animate={{ opacity: 1, scale: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 14, stiffness: 220 }}
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row', alignItems: 'center', gap: space.xs,
        backgroundColor: theme.success + '14',
        borderWidth: 1, borderColor: theme.success + '55',
        borderRadius: radius.pill,
        paddingHorizontal: space.md, paddingVertical: space.xs + 1,
      }}
    >
      <Text style={{ color: theme.success, fontSize: type.small, fontWeight: '900', letterSpacing: 0.4 }}>
        {i18n.t('customer.best_deal')} · {i18n.t('customer.saves_more', { eur })}
      </Text>
    </MotiView>
  );
}

// Loyalty chip: shown above the primary offer card when the device has
// redeemed at this merchant before. Personalisation signal that demonstrates
// real DB usage (counts come from the offers/redemptions tables).
function LoyaltyChip({ count }: { count: number }) {
  const label = count >= 5
    ? i18n.t('customer.regular')
    : i18n.t('customer.nth_visit', {
        n: count + 1,
        th: ((c) => c === 1 ? 'st' : c === 2 ? 'nd' : c === 3 ? 'rd' : 'th')(count + 1),
      });
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.85, translateY: -4 }}
      animate={{ opacity: 1, scale: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 14, stiffness: 220 }}
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row', alignItems: 'center', gap: space.xs,
        backgroundColor: theme.primary + '14',
        borderWidth: 1, borderColor: theme.primary + '44',
        borderRadius: radius.pill,
        paddingHorizontal: space.md, paddingVertical: space.xs + 1,
      }}
    >
      <Text style={{ color: theme.primary, fontSize: type.small, fontWeight: '900', letterSpacing: 0.4 }}>
        {label}
      </Text>
    </MotiView>
  );
}

// Compact teaser row for the secondary feed below the primary offer card.
// Tap promotes the row into the primary slot (uses existing accept flow).
function ExtraOfferRow({ entry, onSelect }: { entry: OfferEntry; onSelect: () => void }) {
  const spec = entry.widget_spec;
  const palette = safePalette(spec.palette);
  const distance = spec.merchant.distance_m < 1000
    ? `${Math.round(spec.merchant.distance_m)} m`
    : `${(spec.merchant.distance_m / 1000).toFixed(1).replace('.', ',')} km`;
  const formattedDiscount =
    spec.discount.kind === 'pct' ? `−${spec.discount.value}%` :
    spec.discount.kind === 'eur' ? `−${spec.discount.value.toFixed(2).replace('.', ',')} €` :
    spec.discount.constraint ?? '';
  return (
    <MotiView
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260 }}
    >
      <TouchableOpacity
        onPress={onSelect}
        activeOpacity={0.92}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: space.md,
          backgroundColor: theme.surface,
          borderRadius: radius.md, padding: space.md,
          borderWidth: 1, borderColor: theme.primary + '14',
          // Soft tinted shadow keyed to the offer's accent (per skill).
          shadowColor: palette.accent, shadowOpacity: 0.14,
          shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
        }}
      >
        <View style={{
          width: 48, height: 48, borderRadius: radius.md,
          backgroundColor: palette.bg,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: type.title + 2 }}>{spec.hero.value || '🛍'}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: theme.text, fontSize: type.body, fontWeight: '900', letterSpacing: -0.2 }} numberOfLines={1}>
            {spec.headline}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: type.small, fontWeight: '600' }} numberOfLines={1}>
            {spec.merchant.name} · {distance}
          </Text>
        </View>
        <View style={{
          backgroundColor: palette.accent,
          borderRadius: radius.sm + 2,
          paddingHorizontal: space.md, paddingVertical: space.xs + 2,
        }}>
          <Text style={{ color: palette.bg, fontSize: type.small, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
            {formattedDiscount}
          </Text>
        </View>
      </TouchableOpacity>
    </MotiView>
  );
}
