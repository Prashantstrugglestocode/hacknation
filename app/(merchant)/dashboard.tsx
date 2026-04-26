import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Dimensions, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { subscribeMerchantChannel, MerchantEvent } from '../../lib/supabase/realtime';
import Sparkline from '../../lib/components/Sparkline';
import AnimatedNumber from '../../lib/components/AnimatedNumber';
import FallbackImage from '../../lib/components/FallbackImage';
import { shopImageUrl } from '../../lib/images';
import i18n, { useLocaleVersion } from '../../lib/i18n';
import { theme, space, radius, type as typeScale } from '../../lib/theme';

const API = Constants.expoConfig?.extra?.apiUrl as string;
const { width } = Dimensions.get('window');

interface Stats {
  generated: number;
  accepted: number;
  redeemed: number;
  accept_rate: number;
  // Legacy alias = customer_savings_cents. Kept so older callers don't break.
  eur_moved: number;
  // Sum of discounts on redeemed offers — what the customer saved.
  customer_savings_cents?: number;
  // Sum of (base − discount) on redeemed offers — what the merchant earned
  // (the customer-paid amount attributable to the offer-driven visit).
  revenue_cents?: number;
  weekly?: Array<{ day: string; generated: number; accepted: number; rate: number }>;
}

interface FeedItem {
  type: MerchantEvent['type'];
  ts: string;
  discount_amount_cents?: number;
  // Set on offer.redeemed events. Drives the live activity row showing
  // positive merchant revenue (instead of the negative discount amount).
  revenue_amount_cents?: number | null;
  base_amount_cents?: number | null;
}

interface Merchant {
  id: string;
  name: string;
  type: string;
  goal: string;
}

function greetingFor(hour: number): { hi: string; emoji: string } {
  if (hour < 5)  return { hi: 'Good night', emoji: '🌙' };
  if (hour < 11) return { hi: 'Good morning', emoji: '☀️' };
  if (hour < 14) return { hi: 'Lunchtime', emoji: '🥪' };
  if (hour < 18) return { hi: 'Good afternoon', emoji: '☕' };
  if (hour < 22) return { hi: 'Good evening', emoji: '🌆' };
  return { hi: 'Late hour', emoji: '🌙' };
}

const eventLabel = (t: MerchantEvent['type']) => ({
  'offer.shown': 'Offer shown',
  'offer.accepted': 'Accepted',
  'offer.declined': 'Declined',
  'offer.redeemed': 'Redeemed',
}[t]);

const eventDot = (t: MerchantEvent['type']) => ({
  'offer.shown': theme.primaryLight,
  'offer.accepted': theme.success,
  'offer.declined': theme.warn,
  'offer.redeemed': theme.success,
}[t]);

const eventToastBg = (t: MerchantEvent['type']) => ({
  'offer.shown': theme.primary,
  'offer.accepted': theme.success,
  'offer.declined': theme.warn,
  'offer.redeemed': theme.success,
}[t]);

const eventEmoji = (t: MerchantEvent['type']) => ({
  'offer.shown': '👁',
  'offer.accepted': '✓',
  'offer.declined': '✕',
  'offer.redeemed': '🎫',
}[t]);

interface PayoneSignal { density: 'low' | 'medium' | 'high'; label: string; txn_per_min: number }
interface TopItem { id: string; name: string; price_cents: number | null; category: string | null; redemptions: number }

export default function MerchantDashboard() {
  useLocaleVersion(); // re-render on language flip
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [stats, setStats] = useState<Stats>({ generated: 0, accepted: 0, redeemed: 0, accept_rate: 0, eur_moved: 0 });
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [pulseKey, setPulseKey] = useState(0);
  const [eventToast, setEventToast] = useState<{ key: number; type: MerchantEvent['type']; cents?: number } | null>(null);
  const [menuCount, setMenuCount] = useState<number | null>(null);
  const [payone, setPayone] = useState<PayoneSignal | null>(null);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMenuCount = useCallback(async (id: string) => {
    try {
      const r = await fetch(`${API}/api/merchant/${id}/menu`);
      if (r.ok) {
        const data = await r.json();
        setMenuCount(Array.isArray(data) ? data.length : 0);
      }
    } catch {}
  }, []);

  const fetchStats = useCallback(async (id: string) => {
    try {
      const r = await fetch(`${API}/api/merchant/${id}/stats`);
      if (r.ok) setStats(await r.json());
    } catch {}
  }, []);

  const fetchPayone = useCallback(async (id: string) => {
    try {
      const r = await fetch(`${API}/api/merchant/${id}/payone`);
      if (r.ok) setPayone(await r.json());
    } catch {}
  }, []);

  const fetchTopItems = useCallback(async (id: string) => {
    try {
      const r = await fetch(`${API}/api/merchant/${id}/top-items?limit=3`);
      if (r.ok) {
        const data = await r.json();
        setTopItems(Array.isArray(data?.items) ? data.items : []);
      }
    } catch {}
  }, []);

  // Re-fetch on every focus — picks up merchant switches via picker, new
  // shop creation from setup, and any background data updates.
  useFocusEffect(
    useCallback(() => {
      let unsub: (() => void) | undefined;
      let pollTimer: ReturnType<typeof setInterval> | null = null;
      let prevGen = 0;
      (async () => {
        const id = await AsyncStorage.getItem('merchant_id');
        if (!id) { router.replace('/(merchant)/setup'); return; }
        try {
          const r = await fetch(`${API}/api/merchant/${id}`);
          if (r.ok) setMerchant(await r.json());
        } catch {}
        fetchStats(id);
        fetchMenuCount(id);
        fetchPayone(id);
        fetchTopItems(id);

        unsub = subscribeMerchantChannel(id, (event) => {
          setFeed(prev => [{
            type: event.type,
            ts: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
            discount_amount_cents: event.discount_amount_cents,
            revenue_amount_cents: event.revenue_amount_cents,
            base_amount_cents: event.base_amount_cents,
          }, ...prev].slice(0, 12));
          setPulseKey(k => k + 1);
          const key = Date.now();
          // Toast surfaces revenue (positive merchant earning) on redeem;
          // discount on other event types where revenue isn't applicable.
          const toastCents = event.type === 'offer.redeemed' && event.revenue_amount_cents != null
            ? event.revenue_amount_cents
            : event.discount_amount_cents;
          setEventToast({ key, type: event.type, cents: toastCents });
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => setEventToast(null), 2000);
          fetchStats(id);
          fetchMenuCount(id);
        });

        // Fallback polling — if Realtime broadcast fails (Supabase quota,
        // dropped websocket, REST-fallback gap), poll stats every 6s and
        // surface any change as a toast so live activity always works.
        pollTimer = setInterval(async () => {
          try {
            const r = await fetch(`${API}/api/merchant/${id}/stats`);
            if (!r.ok) return;
            const next = await r.json();
            const gen = next.generated ?? 0;
            if (gen > prevGen && prevGen > 0) {
              setStats(next);
              setPulseKey(k => k + 1);
              const key = Date.now();
              setEventToast({ key, type: 'offer.shown', cents: undefined });
              if (toastTimer.current) clearTimeout(toastTimer.current);
              toastTimer.current = setTimeout(() => setEventToast(null), 2000);
            } else {
              setStats(next);
            }
            prevGen = gen;
            // Refresh Payone + top-items alongside stats. Top-items query
            // is light (offer_item_links join) so 2s is fine.
            fetchPayone(id);
            fetchTopItems(id);
          } catch {}
        }, 2000);
      })();
      return () => {
        if (unsub) unsub();
        if (pollTimer) clearInterval(pollTimer);
        if (toastTimer.current) clearTimeout(toastTimer.current);
      };
    }, [fetchStats, fetchMenuCount, fetchPayone, fetchTopItems])
  );

  const greeting = greetingFor(new Date().getHours());
  const lastWeek = stats.weekly?.[stats.weekly.length - 1];
  const acceptPct = Math.round(stats.accept_rate * 100);
  const redemptionPct = stats.accepted > 0 ? Math.round((stats.redeemed / stats.accepted) * 100) : 0;

  // Tile-tap helpers — read merchant.id but fall back to AsyncStorage so a
  // tap during the brief "merchant fetching" window doesn't silently no-op.
  const goToMenu = async () => {
    const id = merchant?.id ?? await AsyncStorage.getItem('merchant_id');
    if (id) router.push(`/(merchant)/menu?id=${id}`);
  };
  const goToPreview = async () => {
    const id = merchant?.id ?? await AsyncStorage.getItem('merchant_id');
    if (id) router.push(`/(merchant)/preview?id=${id}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <AnimatePresence>
        {eventToast && (
          <MotiView
            key={eventToast.key}
            from={{ opacity: 0, translateY: -16, scale: 0.85 }}
            animate={{ opacity: 1, translateY: 0, scale: 1 }}
            exit={{ opacity: 0, translateY: -8 }}
            transition={{ type: 'spring', damping: 12, stiffness: 240 }}
            style={{
              position: 'absolute', top: 64, left: 0, right: 0,
              alignItems: 'center', zIndex: 100, pointerEvents: 'none',
            }}
          >
            {/* Soft glow ring under the toast — peak moment cue for redemption */}
            {eventToast.type === 'offer.redeemed' && (
              <MotiView
                from={{ opacity: 0.55, scale: 0.9 }}
                animate={{ opacity: 0, scale: 1.7 }}
                transition={{ type: 'timing', duration: 900 }}
                style={{
                  position: 'absolute', top: -6,
                  width: 220, height: 56, borderRadius: radius.pill,
                  backgroundColor: theme.success,
                }}
              />
            )}
            <View style={{
              backgroundColor: eventToastBg(eventToast.type),
              borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.sm + 2,
              flexDirection: 'row', alignItems: 'center', gap: space.sm,
              shadowColor: eventToastBg(eventToast.type),
              shadowOpacity: 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 10 },
              elevation: 8,
            }}>
              <Text style={{ fontSize: typeScale.bodyL }}>{eventEmoji(eventToast.type)}</Text>
              <Text style={{ color: '#FFFFFF', fontSize: typeScale.body, fontWeight: '900', letterSpacing: 0.3 }}>
                {eventLabel(eventToast.type)}
              </Text>
              {eventToast.cents != null && eventToast.cents > 0 && (
                <Text style={{ color: '#FFFFFF', fontSize: typeScale.body, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
                  {eventToast.type === 'offer.redeemed' ? ' +' : ' · '}
                  {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }).format(eventToast.cents / 100)}
                </Text>
              )}
            </View>
          </MotiView>
        )}
      </AnimatePresence>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Role-switch removed — once a merchant always a merchant on this
            device (until they reset via Settings → Account). */}

        {/* HERO BAND — warm greeting + identity over a soft red wash.
            Type system inside band: 2 weights (700 labels, 900 numbers) ×
            4 sizes (caption, small, body, hero). */}
        <View style={{
          marginHorizontal: space.lg, marginTop: space.sm, borderRadius: radius.xl + 6, overflow: 'hidden',
          shadowColor: theme.primary, shadowOpacity: 0.28, shadowRadius: 24, shadowOffset: { width: 0, height: 12 },
          elevation: 8,
        }}>
          {/* Shop banner photo (loremflickr) under a darkening gradient */}
          {merchant && (
            <FallbackImage
              uri={shopImageUrl(merchant.name, merchant.type)}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              fallbackEmoji="🏪"
              fallbackBg={theme.primaryDark}
            />
          )}
          <LinearGradient
            colors={[theme.primary + 'EE', theme.primaryDark + 'F2'] as any}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ padding: space['2xl'], gap: space.lg }}
          >
            {/* Row 1 — greeting + merchant name + actions on a single row */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
              <Pressable onPress={() => router.push('/(merchant)/picker')} hitSlop={8} style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFFB8', fontSize: typeScale.small, fontWeight: '700', letterSpacing: 0.4 }}>
                  {greeting.hi} {greeting.emoji}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs + 2, marginTop: space.xs }}>
                  <Text
                    style={{ color: '#FFFFFF', fontSize: typeScale.display, fontWeight: '900', letterSpacing: -0.7, flexShrink: 1 }}
                    numberOfLines={1}
                  >
                    {merchant?.name ?? i18n.t('merchant.your_shop')}
                  </Text>
                  <Text style={{ color: '#FFFFFFB8', fontSize: typeScale.bodyL, fontWeight: '900' }}>▾</Text>
                </View>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Pressable onPress={() => merchant && router.push('/(merchant)/rules')}
                  hitSlop={10}
                  style={({ pressed }) => ({
                    width: 40, height: 40, borderRadius: radius.pill,
                    backgroundColor: pressed ? '#FFFFFF38' : '#FFFFFF24',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: '#FFFFFF22',
                  })}>
                  <Text style={{ fontSize: typeScale.bodyL }}>📐</Text>
                </Pressable>
                <Pressable onPress={() => router.push('/(merchant)/settings')}
                  hitSlop={10}
                  style={({ pressed }) => ({
                    width: 40, height: 40, borderRadius: radius.pill,
                    backgroundColor: pressed ? '#FFFFFF38' : '#FFFFFF24',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: '#FFFFFF22',
                  })}>
                  <Text style={{ fontSize: typeScale.bodyL }}>⚙️</Text>
                </Pressable>
              </View>
            </View>

            {/* Row 2 — today / revenue stat columns */}
            <View style={{ flexDirection: 'row', gap: space.lg, justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFFA8', fontSize: typeScale.micro, fontWeight: '900', letterSpacing: 1.6 }}>
                  {i18n.t('merchant.today').toUpperCase()}
                </Text>
                <MotiView
                  key={`redeemed-${pulseKey}`}
                  from={{ scale: 1.22 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 9, stiffness: 280 }}
                  style={{ marginTop: space.xs }}
                >
                  <AnimatedNumber
                    value={stats.redeemed}
                    style={{ color: '#fff', fontSize: typeScale.hero + 12, fontWeight: '900', letterSpacing: -1.8, lineHeight: typeScale.hero + 14, fontVariant: ['tabular-nums'] }}
                  />
                </MotiView>
                <Text style={{ color: '#FFFFFFCC', fontSize: typeScale.small, fontWeight: '700', marginTop: 0 }}>
                  {i18n.t('merchant.redeemed').toLowerCase()}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: '#FFFFFFA8', fontSize: typeScale.micro, fontWeight: '900', letterSpacing: 1.6 }}>
                  {i18n.t('merchant.revenue').toUpperCase()}
                </Text>
                <MotiView
                  key={`eur-${pulseKey}`}
                  from={{ scale: 1.18 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 10, stiffness: 280 }}
                  style={{ marginTop: space.xs }}
                >
                  <AnimatedNumber
                    value={(stats.revenue_cents ?? 0) / 100}
                    format={n => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }).format(n)}
                    style={{ color: '#fff', fontSize: typeScale.display - 4, fontWeight: '900', letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}
                  />
                </MotiView>
                {/* "Customers saved €X" subline removed — the revenue
                    number is the only metric the merchant cares about
                    on their own dashboard. */}
              </View>
            </View>

            {/* Mini funnel: Generated → Accepted → Redeemed bars */}
            <View style={{ gap: space.sm - 2 }}>
              <FunnelRow label={i18n.t('merchant.generated')}  value={stats.generated} max={Math.max(stats.generated, 1)} />
              <FunnelRow label={i18n.t('merchant.accepted')}   value={stats.accepted}  max={Math.max(stats.generated, 1)} />
              <FunnelRow label={i18n.t('merchant.redeemed')}   value={stats.redeemed}  max={Math.max(stats.generated, 1)} />
            </View>
          </LinearGradient>
        </View>

        {/* Payone density chip intentionally hidden on the merchant side —
            the signal still drives offer scoring server-side and surfaces in
            the customer's why-screen, but adds noise to the merchant view. */}

        {/* SPARKLINE — minimal, no card chrome around it */}
        {(stats.weekly?.length ?? 0) > 0 && (() => {
          const totalGenerated = (stats.weekly ?? []).reduce((s, b) => s + (b.generated ?? 0), 0);
          const allZero = totalGenerated === 0;
          return (
            <View style={{ paddingHorizontal: space['2xl'], marginTop: space['2xl'] }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space.sm }}>
                <Text style={{ color: theme.text, fontSize: typeScale.body, fontWeight: '700' }}>
                  {i18n.t('merchant.weekly_rate')}
                </Text>
                <Text style={{ color: allZero ? theme.textMuted : theme.primary, fontSize: typeScale.title - 2, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
                  {allZero ? '·' : `${Math.round((lastWeek?.rate ?? 0) * 100)}%`}
                </Text>
              </View>
              {allZero ? (
                <View style={{
                  height: 64, borderRadius: radius.md, backgroundColor: theme.bgMuted,
                  alignItems: 'center', justifyContent: 'center', gap: space.xs,
                  borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed',
                }}>
                  <Text style={{ color: theme.textMuted, fontSize: typeScale.small, fontWeight: '700' }}>
                    📊 {i18n.t('merchant.no_data_yet')}
                  </Text>
                </View>
              ) : (
                <Sparkline values={(stats.weekly ?? []).map(b => b.rate * 100)} width={width - space['2xl'] * 2} height={64} />
              )}
            </View>
          );
        })()}

        {/* TOP ITEMS · the merchant's actual best-redeemed menu items.
            Live-driven from offer_item_links ⋈ offers (status='redeemed') ⋈
            menu_items. Empty until the first redemption. */}
        {topItems.length > 0 && (
          <View style={{ paddingHorizontal: space['2xl'], marginTop: space['2xl'] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space.sm }}>
              {/* TODO: i18n key — merchant.top_items_title */}
              <Text style={{ color: theme.text, fontSize: typeScale.body, fontWeight: '900', letterSpacing: 0.4 }}>
                🏆 TOP ITEMS
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: typeScale.caption, fontWeight: '700' }}>
                live · redeemed
              </Text>
            </View>
            <View style={{ gap: space.sm }}>
              {topItems.map((item, i) => (
                <View key={item.id}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: space.md,
                    backgroundColor: theme.surface, borderRadius: radius.md,
                    paddingHorizontal: space.md, paddingVertical: space.md - 2,
                    borderWidth: 1, borderColor: theme.border,
                    shadowColor: theme.primary, shadowOpacity: 0.08,
                    shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
                  }}>
                  <View style={{
                    width: 28, height: 28, borderRadius: radius.pill,
                    backgroundColor: i === 0 ? theme.primary : theme.bgMuted,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: i === 0 ? 0 : 1, borderColor: theme.border,
                  }}>
                    <Text style={{
                      color: i === 0 ? theme.textOnPrimary : theme.text,
                      fontSize: typeScale.small, fontWeight: '900', fontVariant: ['tabular-nums'],
                    }}>
                      {i + 1}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: typeScale.body, fontWeight: '700' }} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.price_cents != null && (
                      <Text style={{ color: theme.textMuted, fontSize: typeScale.caption, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: 1 }}>
                        {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }).format(item.price_cents / 100)}
                      </Text>
                    )}
                  </View>
                  <View style={{
                    backgroundColor: theme.success + '18',
                    borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.xs,
                    flexDirection: 'row', alignItems: 'baseline', gap: 3,
                  }}>
                    <Text style={{ color: theme.success, fontSize: typeScale.small, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
                      {item.redemptions}×
                    </Text>
                    <Text style={{ color: theme.success, fontSize: typeScale.caption, fontWeight: '700' }}>
                      redeemed
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* QUICK ACTIONS — 3-up tile row, varied tile shapes */}
        <View style={{ flexDirection: 'row', paddingHorizontal: space.md, marginTop: space['2xl'], gap: space.sm + 2 }}>
          <ActionTile
            onPress={goToPreview}
            emoji="👁"
            title={i18n.t('merchant.preview')}
            sub={i18n.t('merchant.preview_sub')}
            tone="primary"
          />
          <ActionTile
            onPress={() => router.push('/(merchant)/flash-sale')}
            emoji="🔥"
            title={i18n.t('merchant.flash')}
            sub={i18n.t('merchant.flash_sub')}
          />
          <ActionTile
            onPress={goToMenu}
            emoji="📋"
            title={i18n.t('merchant.menu_tile')}
            sub={menuCount != null ? `${menuCount} ${i18n.t('common.items').toLowerCase()}` : i18n.t('common.items')}
            badge={menuCount}
          />
        </View>

        {/* Secondary stats — split into pairs, NOT all in same grid */}
        <View style={{ paddingHorizontal: space.md, marginTop: space.lg, flexDirection: 'row', gap: space.sm + 2 }}>
          <SecondaryStat
            label={i18n.t('merchant.accept_short')}
            big={`${acceptPct}%`}
            sub={`${stats.accepted} / ${stats.generated}`}
            pulseKey={pulseKey}
          />
          <SecondaryStat
            label={i18n.t('merchant.redeemed')}
            big={`${redemptionPct}%`}
            sub={`${stats.redeemed} / ${stats.accepted}`}
            pulseKey={pulseKey}
            tone="celebrate"
          />
        </View>

        {/* TIMELINE FEED — connector line + dot per event */}
        <View style={{ paddingHorizontal: space['2xl'], marginTop: space['3xl'] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md + 2 }}>
            <MotiView
              from={{ scale: 0.9, opacity: 0.4 }}
              animate={{ scale: 1.4, opacity: 1 }}
              transition={{ type: 'timing', duration: 1100, loop: true }}
              style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.success }}
            />
            <Text style={{ color: theme.text, fontSize: typeScale.body, fontWeight: '700' }}>
              Live · Activity
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: typeScale.small, fontWeight: '700' }}>
              {feed.length > 0 ? `${feed.length} recent` : '·'}
            </Text>
          </View>

          {feed.length === 0 ? (
            <View style={{ paddingVertical: space['2xl'], alignItems: 'center', gap: space.xs + 2 }}>
              <Text style={{ fontSize: 36, opacity: 0.4 }}>👋</Text>
              <Text style={{ color: theme.textMuted, fontSize: typeScale.body, fontWeight: '700', textAlign: 'center' }}>
                Waiting for the first customer.
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: typeScale.small, fontWeight: '700', textAlign: 'center', maxWidth: 260 }}>
                As soon as someone nearby sees an offer, it pops up here.
              </Text>
            </View>
          ) : (
            <View style={{ position: 'relative', paddingLeft: space['2xl'] - 2 }}>
              <View style={{
                position: 'absolute', left: 9, top: 6, bottom: 6, width: 2,
                backgroundColor: theme.border,
              }} />
              {feed.map((item, i) => (
                <MotiView
                  key={i}
                  from={{ opacity: 0, translateX: -8 }}
                  animate={{ opacity: 1, translateX: 0 }}
                  transition={{ type: 'spring', damping: 16, stiffness: 200, delay: i === 0 ? 0 : 30 }}
                  style={{ marginBottom: space.md, flexDirection: 'row', alignItems: 'flex-start', gap: space.md + 2 }}
                >
                  <View style={{
                    position: 'absolute', left: -(space['2xl'] - 2), top: 4,
                    width: 20, height: 20, borderRadius: 10,
                    backgroundColor: theme.bg,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <View style={{
                      width: 10, height: 10, borderRadius: 5,
                      backgroundColor: eventDot(item.type),
                      borderWidth: 2, borderColor: theme.bg,
                    }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 }}>
                      <Text style={{ fontSize: typeScale.small + 1 }}>{eventEmoji(item.type)}</Text>
                      <Text style={{ color: theme.text, fontSize: typeScale.body, fontWeight: '700' }}>
                        {eventLabel(item.type)}
                      </Text>
                      {(() => {
                        // On redemption events, show the merchant's revenue
                        // (positive — the customer-paid amount). Earlier-stage
                        // events (shown/accepted) have no revenue yet, so we
                        // fall back to the offer's discount as a hint of size.
                        const isRedeemed = item.type === 'offer.redeemed';
                        const revenue = item.revenue_amount_cents;
                        if (isRedeemed && typeof revenue === 'number' && revenue > 0) {
                          return (
                            <Text style={{ color: theme.success, fontSize: typeScale.small, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
                              +{new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }).format(revenue / 100)}
                            </Text>
                          );
                        }
                        if (!isRedeemed && item.discount_amount_cents) {
                          return (
                            <Text style={{ color: theme.textMuted, fontSize: typeScale.small, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
                              {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }).format(item.discount_amount_cents / 100)} discount
                            </Text>
                          );
                        }
                        return null;
                      })()}
                    </View>
                    <Text style={{ color: theme.textMuted, fontSize: typeScale.caption, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: 1 }}>
                      {item.ts}
                    </Text>
                  </View>
                </MotiView>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* STICKY FAB-style scan button — thumb-zone primary CTA */}
      <View style={{
        position: 'absolute', bottom: space.lg, left: space.lg, right: space.lg,
      }}>
        <Pressable
          onPress={() => router.push('/(merchant)/scan')}
          style={({ pressed }) => ({
            backgroundColor: theme.primary,
            borderRadius: radius.xl,
            paddingVertical: space.lg + 2, paddingHorizontal: space['2xl'],
            alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: space.sm + 2,
            transform: [{ scale: pressed ? 0.98 : 1 }],
            shadowColor: theme.primary,
            shadowOpacity: pressed ? 0.25 : 0.45,
            shadowRadius: pressed ? 10 : 18,
            shadowOffset: { width: 0, height: pressed ? 4 : 10 },
            elevation: pressed ? 4 : 10,
          })}
        >
          <Text style={{ fontSize: typeScale.title + 2 }}>📷</Text>
          <Text style={{ color: theme.textOnPrimary, fontSize: typeScale.bodyL + 1, fontWeight: '900', letterSpacing: 0.3 }}>
            {i18n.t('merchant.scan_qr')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function FunnelRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 }}>
      <Text style={{ color: '#FFFFFFCC', fontSize: typeScale.caption, fontWeight: '700', width: 76 }}>{label}</Text>
      <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF22', overflow: 'hidden' }}>
        <MotiView
          from={{ width: '0%' }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'timing', duration: 700 }}
          style={{ height: '100%', backgroundColor: '#FFFFFF', borderRadius: 4 }}
        />
      </View>
      <Text style={{ color: '#fff', fontSize: typeScale.small + 1, fontWeight: '900', minWidth: 26, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

function ActionTile({
  onPress, emoji, title, sub, tone, badge,
}: { onPress: () => void; emoji: string; title: string; sub: string; tone?: 'primary' | 'muted'; badge?: number | null }) {
  const isPrimary = tone === 'primary';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: isPrimary ? theme.primaryWash : theme.surface,
        borderRadius: radius.xl, padding: space.md + 2,
        borderWidth: 1, borderColor: isPrimary ? theme.primary + '55' : theme.border,
        gap: space.sm, minHeight: 110,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        position: 'relative',
        // Soft brand-tinted lift — keeps the row visually grouped with hero
        shadowColor: theme.primary,
        shadowOpacity: pressed ? 0.04 : (isPrimary ? 0.12 : 0.07),
        shadowRadius: pressed ? 4 : 10,
        shadowOffset: { width: 0, height: pressed ? 2 : 4 },
        elevation: pressed ? 1 : 3,
      })}
    >
      <View style={{
        width: 40, height: 40, borderRadius: radius.lg - 2,
        backgroundColor: isPrimary ? theme.primary : theme.bgMuted,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: typeScale.bodyL + 2 }}>{emoji}</Text>
      </View>
      {badge != null && badge > 0 && (
        <View style={{
          position: 'absolute', top: space.sm + 2, right: space.sm + 2,
          backgroundColor: theme.primary, borderRadius: radius.pill,
          minWidth: 22, height: 22, paddingHorizontal: space.xs + 2,
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 2, borderColor: isPrimary ? theme.primaryWash : theme.surface,
        }}>
          <Text style={{ color: '#FFF', fontSize: typeScale.caption, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      )}
      <View>
        <Text style={{ color: isPrimary ? theme.primaryDark : theme.text, fontSize: typeScale.body + 1, fontWeight: '900', letterSpacing: -0.2 }}>
          {title}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: typeScale.caption, fontWeight: '700', marginTop: 1 }} numberOfLines={1}>
          {sub}
        </Text>
      </View>
    </Pressable>
  );
}

function SecondaryStat({
  label, big, sub, pulseKey, tone,
}: { label: string; big: string; sub: string; pulseKey: number; tone?: 'muted' | 'celebrate' }) {
  const isMuted = tone === 'muted';
  const isCelebrate = tone === 'celebrate';
  const restingBg = isMuted ? theme.bgMuted : theme.surface;
  return (
    <View style={{ flex: 1, position: 'relative' }}>
      {/* Peak-end ring — only on the celebrate (redemption) tile, fires on
          every pulse so the "Eingelöst" arrival feels rewarding. */}
      {isCelebrate && (
        <MotiView
          key={`ring-${pulseKey}`}
          from={{ opacity: 0.55, scale: 0.92 }}
          animate={{ opacity: 0, scale: 1.08 }}
          transition={{ type: 'timing', duration: 900 }}
          pointerEvents="none"
          style={{
            position: 'absolute', top: -2, left: -2, right: -2, bottom: -2,
            borderRadius: radius.lg + 2, borderWidth: 2, borderColor: theme.success,
          }}
        />
      )}
      <MotiView
        key={pulseKey}
        from={{ scale: 0.94, backgroundColor: theme.success + '55' }}
        animate={{ scale: 1, backgroundColor: restingBg }}
        transition={{
          scale: { type: 'spring', damping: 12, stiffness: 240 },
          backgroundColor: { type: 'timing', duration: 700 },
        }}
        style={{
          padding: space.md + 2, borderRadius: radius.lg,
          borderWidth: 1, borderColor: theme.border,
          shadowColor: theme.primary, shadowOpacity: 0.05,
          shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
        }}
      >
        <Text style={{ color: theme.textMuted, fontSize: typeScale.caption, fontWeight: '700', letterSpacing: 0.3 }}>
          {label}
        </Text>
        <Text style={{ color: theme.text, fontSize: typeScale.display, fontWeight: '900', letterSpacing: -0.5, marginTop: space.xs - 2, fontVariant: ['tabular-nums'] }}>
          {big}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: typeScale.caption, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{sub}</Text>
      </MotiView>
    </View>
  );
}
