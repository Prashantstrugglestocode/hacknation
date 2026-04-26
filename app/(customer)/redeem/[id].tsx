import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import CountdownRing from '../../../lib/components/CountdownRing';
import SlideToPay from '../../../lib/components/SlideToPay';
import { safeHex } from '../../../lib/colors';
import { subscribeOfferChannel } from '../../../lib/supabase/realtime';
import { notifyScanPending, notifyRedeemed } from '../../../lib/notifications';
import { theme, space, radius, type as typo } from '../../../lib/theme';
import i18n from '../../../lib/i18n';

const { width } = Dimensions.get('window');
const API = Constants.expoConfig?.extra?.apiUrl as string;
const TTL_SECONDS = 600; // QR lifetime — 10 minutes

// Six tiny confetti dots that burst out from behind the +€ pill on redeem.
// Pre-computed offsets so the layout doesn't shift between renders.
const SPARKLES: Array<{ x: number; y: number; size: number }> = [
  { x: -78, y: -54, size: 7 },
  { x:  84, y: -46, size: 6 },
  { x: -96, y:  18, size: 5 },
  { x:  98, y:  26, size: 7 },
  { x: -36, y: -78, size: 5 },
  { x:  44, y: -82, size: 6 },
];

interface OfferData {
  widget_spec?: {
    merchant?: { name?: string; distance_m?: number };
    pressure?: { kind: 'time' | 'stock'; value: string } | null;
    discount?: { kind: string; value: number; constraint?: string | null };
    palette?: { bg: string; fg: string; accent: string };
    base_amount_cents?: number;
  };
  context_state?: {
    fired_triggers?: string[];
    weather?: { temp_c: number; condition: string };
    merchant_payone?: { density: 'low' | 'medium' | 'high'; label: string };
  };
  discount_amount_cents?: number;
}

// Bilingual labels for the trigger ids defined in /config/default.json.
// Keep in sync with the why-screen's TRIGGER_LABELS map.
const TRIGGER_LABELS: Record<string, { de: string; en: string; emoji: string }> = {
  COZY_QUIET_NEARBY:      { de: 'Kalt & ruhig · Café-Wetter',   en: 'Cold & quiet · café weather',  emoji: '☕' },
  EVENT_DEMAND_SPIKE:     { de: 'Event in der Nähe',            en: 'Event nearby',                  emoji: '🎫' },
  LATE_AFTERNOON_BROWSE:  { de: 'Bummelzeit am Nachmittag',     en: 'Late-afternoon browsing',       emoji: '👀' },
  CLOSING_SOON_INVENTORY: { de: 'Bald geschlossen · Restbestand', en: 'Closing soon · stock left',   emoji: '⏱' },
  BAD_WEATHER_INDOOR:     { de: 'Schlechtes Wetter · drinnen',  en: 'Bad weather · indoors',         emoji: '🌧' },
  LUNCHTIME_QUIET:        { de: 'Mittag · ruhige Stunde',       en: 'Lunchtime · quiet hour',        emoji: '🥪' },
};

export default function RedeemScreen() {
  const { id, bg, fg, accent } = useLocalSearchParams<{
    id: string; bg?: string; fg?: string; accent?: string;
  }>();
  const insets = useSafeAreaInsets();
  const [token, setToken] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(TTL_SECONDS);
  const [offer, setOffer] = useState<OfferData | null>(null);
  // (processingCashback state removed alongside the cashback path.)
  // null = QR is live; 'awaiting_confirm' = merchant scanned, customer must
  // slide to commit; { kind, cents } = redemption complete → receipt shows.
  const [redemption, setRedemption] = useState<
    | null
    | { phase: 'awaiting_confirm'; baseCents: number | null; discountCents: number | null; merchantName: string | null }
    | { phase: 'done'; kind: 'qr' | 'cashback'; cents: number | null }
  >(null);

  // One signed QR per redeem session — no regenerate. The 10-min TTL is the
  // single dead-line; if it expires the user goes back and re-accepts the offer.
  const loadToken = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/offer/${id}/qr`, { method: 'POST' });
      if (r.ok) {
        const data = await r.json();
        if (data?.token) {
          setToken(data.token);
          setSecondsLeft(TTL_SECONDS);
        }
      }
    } catch {}
  }, [id]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      loadToken(),
      fetch(`${API}/api/offer/${id}`)
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([_, offerData]) => {
      if (!alive) return;
      if (offerData) setOffer(offerData);
    });
    return () => { alive = false; };
  }, [id, loadToken]);

  useEffect(() => {
    if (!token || redemption) return;
    const t = setInterval(() => {
      setSecondsLeft(s => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [token, redemption]);

  // Live channel: two events drive the flow.
  //   offer.scan_pending → merchant just scanned. Swap QR for slide-to-pay
  //                        confirmation prompt with the real amount.
  //   offer.redeemed     → final commit (slide finished or cashback path used).
  //                        Show the payment receipt.
  useEffect(() => {
    if (!id) return;
    const unsub = subscribeOfferChannel(id, (event: any) => {
      if (event.offer_id !== id) return;
      if (event.type === 'offer.scan_pending') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        notifyScanPending(event.merchant_name ?? null);
        setRedemption({
          phase: 'awaiting_confirm',
          baseCents: event.base_amount_cents ?? null,
          discountCents: event.discount_amount_cents ?? null,
          merchantName: event.merchant_name ?? null,
        });
      } else if (event.type === 'offer.redeemed') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        notifyRedeemed(merchant?.name ?? null, event.discount_amount_cents ?? null);
        setRedemption({
          phase: 'done',
          kind: event.redemption_kind ?? 'qr',
          cents: event.discount_amount_cents ?? null,
        });
      }
    });
    return unsub;
  }, [id]);

  // Customer-side confirm of a merchant-scanned QR: slide-to-pay → POST
  // /confirm-payment → server broadcasts offer.redeemed → receipt phase.
  const confirmScannedPayment = async () => {
    try {
      const r = await fetch(`${API}/api/offer/${id}/confirm-payment`, { method: 'POST' });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        Alert.alert('Zahlung fehlgeschlagen', err.error ?? 'Bitte erneut versuchen.');
        return;
      }
      const data = await r.json().catch(() => ({}));
      // Optimistic: don't wait for the broadcast (which usually arrives in
      // <500ms but can lag on a slow network).
      setRedemption({
        phase: 'done',
        kind: 'qr',
        cents: typeof data?.discount_amount_cents === 'number' ? data.discount_amount_cents : null,
      });
    } catch {
      Alert.alert('Netzwerkfehler', 'Zahlung konnte nicht bestätigt werden.');
    }
  };

  const palette = useMemo(() => ({
    bg: safeHex(bg ? `#${bg}` : offer?.widget_spec?.palette?.bg, theme.primary),
    fg: safeHex(fg ? `#${fg}` : offer?.widget_spec?.palette?.fg, '#FFFFFF'),
    accent: safeHex(accent ? `#${accent}` : offer?.widget_spec?.palette?.accent, theme.primary),
  }), [bg, fg, accent, offer]);

  // Cashback / "pay before merchant scans" path removed by user request:
  // the slider must NOT be tappable before the merchant has actually scanned
  // the QR. The only commit path now is /confirm-payment via the
  // awaiting_confirm phase wired in subscribeOfferChannel.

  const merchant = offer?.widget_spec?.merchant;
  const pressure = offer?.widget_spec?.pressure;
  const discount = offer?.widget_spec?.discount;
  const expired = secondsLeft === 0;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  const formatDiscount = () => {
    if (!discount) return '';
    if (discount.kind === 'pct') return `−${discount.value} %`;
    if (discount.kind === 'eur') return `−${discount.value.toFixed(2).replace('.', ',')} €`;
    return discount.constraint ?? '';
  };

  const distance = merchant?.distance_m
    ? merchant.distance_m < 1000
      ? `${Math.round(merchant.distance_m)} m`
      : `${(merchant.distance_m / 1000).toFixed(1).replace('.', ',')} km`
    : '';

  return (
    <View style={{
      flex: 1, backgroundColor: palette.bg,
      paddingHorizontal: space.md,
      paddingTop: insets.top + space.sm,
      paddingBottom: Math.max(insets.bottom, space.lg),
    }}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={16}
        style={{
          alignSelf: 'flex-start',
          paddingVertical: space.sm, paddingHorizontal: space.md,
          marginLeft: -space.md, marginBottom: space.xs,
        }}>
        <Text style={{ color: palette.fg, fontSize: typo.bodyL, fontWeight: '800' }}>
          ← {i18n.t('common.back')}
        </Text>
      </TouchableOpacity>

      {/* Brand band — gradient + identity */}
      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 18, stiffness: 220 }}
        style={{ borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: 'hidden' }}
      >
        <LinearGradient
          colors={[palette.bg, palette.accent] as any}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ padding: space.xl, gap: space.xs }}
        >
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <Text style={{
              color: palette.fg + 'BB', fontSize: typo.caption,
              fontWeight: '800', letterSpacing: 1.6,
            }}>
              STADTPULS · ANGEBOT
            </Text>
            {/* GDPR mark — on-device intent only */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: palette.fg + '1F', borderRadius: radius.pill,
              paddingHorizontal: 8, paddingVertical: 2,
            }}>
              <Text style={{ fontSize: 10 }}>🇪🇺</Text>
              <Text style={{
                color: palette.fg, fontSize: 10, fontWeight: '900', letterSpacing: 0.8,
              }}>
                GDPR
              </Text>
            </View>
          </View>
          <Text style={{
            color: palette.fg, fontSize: typo.display - 2,
            fontWeight: '900', letterSpacing: -0.6,
          }} numberOfLines={1}>
            {merchant?.name ?? '·'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xs }}>
            {distance ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                <Text style={{ fontSize: typo.caption }}>📍</Text>
                <Text style={{ color: palette.fg + 'DD', fontSize: typo.small, fontWeight: '700' }}>
                  {distance}
                </Text>
              </View>
            ) : null}
            {discount ? (
              <Text style={{ color: palette.fg, fontSize: typo.body, fontWeight: '900' }}>
                {formatDiscount()}
              </Text>
            ) : null}
          </View>
          {pressure ? (
            <MotiView
              from={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', delay: 220, damping: 14 }}
              style={{
                alignSelf: 'flex-start', marginTop: space.sm,
                backgroundColor: palette.fg + '22', borderRadius: radius.sm,
                paddingHorizontal: space.md, paddingVertical: space.xs,
                flexDirection: 'row', alignItems: 'center', gap: space.xs,
              }}
            >
              <Text style={{ fontSize: typo.caption }}>{pressure.kind === 'time' ? '⏱' : '📦'}</Text>
              <Text style={{ color: palette.fg, fontSize: typo.caption, fontWeight: '800' }}>
                {pressure.value}
              </Text>
            </MotiView>
          ) : null}
        </LinearGradient>
      </MotiView>

      <Perforations color={palette.bg} />

      {/* QR ticket — dies the moment the merchant scans it. No regenerate
          option: the 10-min TTL is the single dead-line. */}
      <MotiView
        from={{ opacity: 0, scale: 0.88, translateY: 8 }}
        animate={{ opacity: 1, scale: 1, translateY: 0 }}
        transition={{ type: 'spring', delay: 120, damping: 16, stiffness: 220 }}
        style={{
          backgroundColor: '#FFFFFF', alignItems: 'center',
          paddingTop: space['2xl'], paddingBottom: space.xl, gap: space.md,
        }}
      >
        {redemption?.phase === 'awaiting_confirm' ? (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 16, stiffness: 200 }}
            style={{ width: '100%', paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.lg }}
          >
            <View style={{ alignItems: 'center', gap: space.sm }}>
              {/* Pulsing scan-ring header — urgent-but-warm, no shouting */}
              <View style={{
                width: 88, height: 88, alignItems: 'center', justifyContent: 'center',
              }}>
                <MotiView
                  from={{ scale: 1, opacity: 0.55 }}
                  animate={{ scale: 1.55, opacity: 0 }}
                  transition={{ type: 'timing', duration: 1600, loop: true, repeatReverse: false }}
                  style={{
                    position: 'absolute', width: 88, height: 88, borderRadius: 44,
                    borderWidth: 2, borderColor: palette.accent,
                  }}
                />
                <MotiView
                  from={{ scale: 1, opacity: 0.4 }}
                  animate={{ scale: 1.85, opacity: 0 }}
                  transition={{ type: 'timing', duration: 1600, loop: true, repeatReverse: false, delay: 400 }}
                  style={{
                    position: 'absolute', width: 88, height: 88, borderRadius: 44,
                    borderWidth: 2, borderColor: palette.accent,
                  }}
                />
                <View style={{
                  width: 64, height: 64, borderRadius: 32,
                  backgroundColor: palette.accent + '18',
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: palette.accent, shadowOpacity: 0.28,
                  shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
                }}>
                  <Text style={{ fontSize: 30 }}>📷</Text>
                </View>
              </View>
              <Text style={{
                color: theme.text, fontSize: typo.title, fontWeight: '900',
                letterSpacing: -0.4, textAlign: 'center',
              }}>
                {redemption.merchantName ? `${redemption.merchantName} hat gescannt` : 'Händler hat gescannt'}
              </Text>
              <Text style={{
                color: theme.textMuted, fontSize: typo.small, fontWeight: '700',
                textAlign: 'center', maxWidth: 280, lineHeight: 18,
              }}>
                Schiebe unten zum Bezahlen, um die Zahlung freizugeben.
              </Text>
            </View>
            <SlideToPay
              amountCents={
                (redemption.baseCents != null && redemption.discountCents != null)
                  ? Math.max(0, redemption.baseCents - redemption.discountCents)
                  : redemption.discountCents
              }
              label={i18n.t('customer.slide_to_pay')}
              processingLabel={i18n.t('customer.processing_payment')}
              confirmedLabel={i18n.t('customer.payment_confirmed')}
              accent={palette.accent}
              onConfirm={confirmScannedPayment}
            />
          </MotiView>
        ) : redemption?.phase === 'done' ? (
          // Quiet "ready" line — the real peak (+€ receipt) lives in the
          // cashback stub directly below. Keeps eyes flowing down the ticket.
          <MotiView
            from={{ opacity: 0, translateY: 4 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18, stiffness: 220 }}
            style={{ alignItems: 'center', gap: space.xs, paddingVertical: space.sm }}
          >
            <View style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: theme.success + '14',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 28 }}>✓</Text>
            </View>
            <Text style={{ color: theme.textMuted, fontSize: typo.caption, fontWeight: '900', letterSpacing: 1.4 }}>
              {(redemption.kind === 'qr' ? 'BEZAHLT BEI' : 'CASHBACK VON').toUpperCase()}
            </Text>
            <Text style={{ color: theme.text, fontSize: typo.body, fontWeight: '900', letterSpacing: -0.2 }}>
              {merchant?.name ?? '·'}
            </Text>
          </MotiView>
        ) : token && !expired ? (
          <>
            <View style={{ width: 240, height: 240, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ position: 'absolute' }}>
                <CountdownRing
                  size={240}
                  strokeWidth={8}
                  progress={secondsLeft / TTL_SECONDS}
                  warn={secondsLeft < 60}
                />
              </View>
              <View style={{ padding: 12, backgroundColor: '#FFFFFF', borderRadius: 14 }}>
                <QRCode value={token} size={184} color="#1F1F23" backgroundColor="#FFFFFF" />
              </View>
            </View>
            <View style={{ alignItems: 'center', gap: 2 }}>
              <Text style={{
                color: secondsLeft < 60 ? theme.danger : theme.text,
                fontSize: typo.display + 4, fontWeight: '900',
                fontVariant: ['tabular-nums'], letterSpacing: -0.6,
                lineHeight: typo.display + 8,
              }}>
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </Text>
              <Text style={{
                color: theme.textMuted, fontSize: typo.caption,
                fontWeight: '800', letterSpacing: 1.6,
              }}>
                ZEIT ZUM EINLÖSEN · 10 MIN
              </Text>
            </View>
          </>
        ) : (
          <View style={{
            alignItems: 'center', justifyContent: 'center',
            gap: space.md, paddingVertical: space.xl, paddingHorizontal: space.xl,
          }}>
            <View style={{
              width: 88, height: 88, borderRadius: 44,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: token ? theme.danger + '14' : theme.bgMuted,
            }}>
              <Text style={{ fontSize: 40 }}>{token ? '⌛' : '⏳'}</Text>
            </View>
            <Text style={{
              color: token ? theme.danger : theme.textMuted,
              fontSize: typo.bodyL, fontWeight: '900', letterSpacing: -0.2,
            }}>
              {token ? i18n.t('customer.expired') : 'Lade…'}
            </Text>
            {token && (
              <>
                <Text style={{
                  color: theme.textMuted, fontSize: typo.small, fontWeight: '700',
                  textAlign: 'center', maxWidth: 260, lineHeight: 18,
                }}>
                  Das Angebot lief nach 10 Minuten ab. Geh zurück und nimm es neu an.
                </Text>
                <TouchableOpacity onPress={() => router.back()}
                  activeOpacity={0.85}
                  style={{
                    marginTop: space.xs,
                    backgroundColor: theme.text, borderRadius: radius.pill,
                    paddingHorizontal: 32, paddingVertical: 12,
                    shadowColor: palette.accent, shadowOpacity: 0.25,
                    shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
                  }}>
                  <Text style={{ color: '#FFFFFF', fontSize: typo.body, fontWeight: '900' }}>
                    ← {i18n.t('common.back')}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </MotiView>

      <Perforations color={palette.bg} />

      {/* Cashback stub */}
      <MotiView
        from={{ opacity: 0, translateY: 18 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', delay: 240, damping: 18, stiffness: 200 }}
        style={{
          backgroundColor: '#FFFFFF',
          borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl,
          padding: space.lg, gap: space.sm,
        }}
      >
        {redemption?.phase === 'done' ? (
          // Payment-portal receipt — THE peak moment per the design brief.
          // Three layers: accent halo → +€ pill (springy + pulsing) → sparkles.
          <MotiView
            from={{ opacity: 0, translateY: 6 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 14, stiffness: 220 }}
            style={{ alignItems: 'center', gap: space.md, paddingTop: space.lg, paddingBottom: space.xl }}
          >
            <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 }}>
              {i18n.t('customer.payment_portal')}
            </Text>

            {/* Halo + pill + sparkles, stacked. */}
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: space.sm }}>
              {/* Soft accent halo behind the pill. */}
              <MotiView
                pointerEvents="none"
                from={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', damping: 16, stiffness: 140, delay: 60 }}
                style={{
                  position: 'absolute',
                  width: 240, height: 160, borderRadius: 120,
                  backgroundColor: palette.accent + '14',
                }}
              />

              {/* Sparkle confetti — six tiny dots in brand accents. */}
              {SPARKLES.map((s, i) => (
                <MotiView
                  key={i}
                  pointerEvents="none"
                  from={{ translateX: 0, translateY: 0, opacity: 0, scale: 0 }}
                  animate={{
                    translateX: s.x,
                    translateY: s.y,
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0.4],
                  }}
                  transition={{
                    type: 'timing', duration: 1100,
                    delay: 240 + i * 70,
                  }}
                  style={{
                    position: 'absolute',
                    width: s.size, height: s.size, borderRadius: s.size / 2,
                    backgroundColor: i % 2 === 0 ? palette.accent : theme.success,
                  }}
                />
              ))}

              {/* The +€X.XX pill. Punchy spring, then a subtle breathing pulse. */}
              <MotiView
                from={{ scale: 0.55, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 8, stiffness: 180, delay: 120 }}
                style={{
                  paddingHorizontal: space.xl, paddingVertical: space.md,
                  borderRadius: radius.xl,
                  backgroundColor: theme.success + '14',
                  borderWidth: 1, borderColor: theme.success + '55',
                  shadowColor: theme.success, shadowOpacity: 0.32,
                  shadowRadius: 28, shadowOffset: { width: 0, height: 10 },
                }}
              >
                <MotiView
                  from={{ scale: 1 }}
                  animate={{ scale: 1.035 }}
                  transition={{
                    type: 'timing', duration: 1400, loop: true,
                    repeatReverse: true, delay: 900,
                  }}
                >
                  <Text style={{
                    color: theme.success, fontSize: typo.hero + 8, fontWeight: '900',
                    fontVariant: ['tabular-nums'], letterSpacing: -1.4,
                    lineHeight: typo.hero + 14,
                  }}>
                    {redemption.cents != null && redemption.cents > 0
                      ? `+${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(redemption.cents / 100)}`
                      : discount?.kind === 'pct'
                        ? `−${discount.value}%`
                        : '✓'}
                  </Text>
                </MotiView>
              </MotiView>
            </View>

            <MotiView
              from={{ opacity: 0, translateY: 6 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 320, delay: 380 }}
              style={{ alignItems: 'center', gap: 2 }}
            >
              <Text style={{
                color: theme.text, fontSize: typo.body, fontWeight: '900',
                textAlign: 'center', letterSpacing: -0.2,
              }}>
                {redemption.kind === 'qr'
                  ? i18n.t('customer.discount_booked')
                  : i18n.t('customer.cashback_redeemed')}
              </Text>
              {merchant?.name ? (
                <Text style={{
                  color: theme.textMuted, fontSize: typo.small, fontWeight: '700',
                  textAlign: 'center',
                }}>
                  {merchant.name}
                </Text>
              ) : null}
            </MotiView>

            {/* Fertig CTA — pushed into the thumb zone with accent-tinted shadow. */}
            <MotiView
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', damping: 18, stiffness: 220, delay: 460 }}
              style={{ marginTop: space.md, width: '100%', alignItems: 'center' }}
            >
              <TouchableOpacity onPress={() => router.back()}
                activeOpacity={0.85}
                style={{
                  backgroundColor: theme.text, borderRadius: radius.pill,
                  paddingHorizontal: 56, paddingVertical: 16,
                  shadowColor: palette.accent, shadowOpacity: 0.32,
                  shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
                }}>
                <Text style={{
                  color: '#FFFFFF', fontSize: typo.bodyL, fontWeight: '900',
                  letterSpacing: 0.3,
                }}>
                  {i18n.t('common.done')}
                </Text>
              </TouchableOpacity>
            </MotiView>
          </MotiView>
        ) : redemption?.phase === 'awaiting_confirm' ? null : (
          // Pre-scan state: just a quiet hint that the merchant must scan
          // first. The slide-to-pay only appears once the scan_pending event
          // fires (see the awaiting_confirm branch above). Without this
          // gate, the customer could "pay" without the merchant even
          // confirming the order — the user explicitly flagged that bug.
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: space.sm,
            paddingVertical: space.sm,
          }}>
            <Text style={{ fontSize: 18 }}>📷</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: typo.small, fontWeight: '900', letterSpacing: 0.4 }}>
                Warten auf Händler-Scan
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: typo.small, fontWeight: '700', marginTop: 2 }}>
                Zeige dem Händler den QR-Code oben. Danach erscheint hier dein Bezahl-Slider.
              </Text>
            </View>
          </View>
        )}
      </MotiView>

      {/* "Why now" footer — reads context_state.fired_triggers from the
          server-persisted offer. Demonstrates real DB-driven personalisation
          ("we picked this because: bad weather + lunch quiet + payone-low"). */}
      {(() => {
        const triggers = offer?.context_state?.fired_triggers ?? [];
        const merchantPayone = offer?.context_state?.merchant_payone;
        const locale = i18n.locale === 'en' ? 'en' : 'de';
        const labelled = triggers.map(t => TRIGGER_LABELS[t]).filter(Boolean) as Array<{ de: string; en: string; emoji: string }>;
        if (labelled.length === 0 && !merchantPayone) return null;
        return (
          <MotiView
            from={{ opacity: 0, translateY: 6 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 320, delay: 320 }}
            style={{
              marginTop: space.md,
              backgroundColor: palette.fg + '14',
              borderRadius: radius.lg,
              padding: space.md,
              gap: space.sm,
            }}
          >
            <Text style={{
              color: palette.fg + 'CC', fontSize: 11, fontWeight: '900', letterSpacing: 1.6,
            }}>
              {i18n.t('customer.context_signals').toUpperCase()}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {labelled.map((l, i) => (
                <View key={i} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: palette.fg + '1F',
                  borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5,
                }}>
                  <Text style={{ fontSize: 11 }}>{l.emoji}</Text>
                  <Text style={{ color: palette.fg, fontSize: 11, fontWeight: '800', letterSpacing: 0.2 }}>
                    {locale === 'en' ? l.en : l.de}
                  </Text>
                </View>
              ))}
              {merchantPayone && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: palette.fg + '1F',
                  borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5,
                }}>
                  <Text style={{ fontSize: 11 }}>💳</Text>
                  <Text style={{ color: palette.fg, fontSize: 11, fontWeight: '800', letterSpacing: 0.2 }}>
                    Payone: {merchantPayone.density === 'low' ? (locale === 'en' ? 'quiet' : 'ruhig')
                      : merchantPayone.density === 'high' ? (locale === 'en' ? 'busy' : 'voll')
                      : (locale === 'en' ? 'normal' : 'normal')}
                  </Text>
                </View>
              )}
            </View>
          </MotiView>
        );
      })()}
    </View>
  );
}

// Ticket-stub perforation row — small dots in palette.bg color
// punched through the white card edge to read as wallet-pass tear.
function Perforations({ color }: { color: string }) {
  const dotCount = Math.floor((width - 28) / 18);
  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 6, height: 14, backgroundColor: '#FFFFFF',
    }}>
      {Array.from({ length: dotCount }).map((_, i) => (
        <View key={i} style={{
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: color,
        }} />
      ))}
    </View>
  );
}
