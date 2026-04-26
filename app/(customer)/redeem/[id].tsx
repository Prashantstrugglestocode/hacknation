import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import CountdownRing from '../../../lib/components/CountdownRing';
import { safeHex } from '../../../lib/colors';
import { theme, space, radius, type as typo } from '../../../lib/theme';
import i18n from '../../../lib/i18n';

const { width } = Dimensions.get('window');
const API = Constants.expoConfig?.extra?.apiUrl as string;
const TTL_SECONDS = 600; // QR lifetime — 10 minutes

interface OfferData {
  widget_spec?: {
    merchant?: { name?: string; distance_m?: number };
    pressure?: { kind: 'time' | 'stock'; value: string } | null;
    discount?: { kind: string; value: number; constraint?: string | null };
    palette?: { bg: string; fg: string; accent: string };
  };
}

export default function RedeemScreen() {
  const { id, bg, fg, accent } = useLocalSearchParams<{
    id: string; bg?: string; fg?: string; accent?: string;
  }>();
  const [token, setToken] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(TTL_SECONDS);
  const [offer, setOffer] = useState<OfferData | null>(null);
  const [cashbackDone, setCashbackDone] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Single source-of-truth for fetching a fresh signed QR token.
  const loadToken = useCallback(async () => {
    setRegenerating(true);
    try {
      const r = await fetch(`${API}/api/offer/${id}/qr`, { method: 'POST' });
      if (r.ok) {
        const data = await r.json();
        if (data?.token) {
          setToken(data.token);
          setSecondsLeft(TTL_SECONDS);
        }
      }
    } catch {} finally {
      setRegenerating(false);
    }
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
    if (!token) return;
    const t = setInterval(() => {
      setSecondsLeft(s => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [token]);

  const regenerate = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await loadToken();
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const palette = useMemo(() => ({
    bg: safeHex(bg ? `#${bg}` : offer?.widget_spec?.palette?.bg, theme.primary),
    fg: safeHex(fg ? `#${fg}` : offer?.widget_spec?.palette?.fg, '#FFFFFF'),
    accent: safeHex(accent ? `#${accent}` : offer?.widget_spec?.palette?.accent, theme.primary),
  }), [bg, fg, accent, offer]);

  const handleCashback = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await fetch(`${API}/api/offer/${id}/redeem-cashback`, { method: 'POST' }).catch(() => {});
    setCashbackDone(true);
  };

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
    <View style={{ flex: 1, backgroundColor: palette.bg, paddingHorizontal: space.md, paddingTop: space['2xl'], paddingBottom: space.lg }}>
      <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: space.md, alignSelf: 'flex-start' }}>
        <Text style={{ color: palette.fg + 'CC', fontSize: typo.body, fontWeight: '700' }}>
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
          <Text style={{
            color: palette.fg + 'BB', fontSize: typo.caption,
            fontWeight: '800', letterSpacing: 1.6,
          }}>
            STADTPULS · ANGEBOT
          </Text>
          <Text style={{
            color: palette.fg, fontSize: typo.display - 2,
            fontWeight: '900', letterSpacing: -0.6,
          }} numberOfLines={1}>
            {merchant?.name ?? '—'}
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

      {/* QR ticket */}
      <MotiView
        from={{ opacity: 0, scale: 0.88, translateY: 8 }}
        animate={{ opacity: 1, scale: 1, translateY: 0 }}
        transition={{ type: 'spring', delay: 120, damping: 16, stiffness: 220 }}
        style={{
          backgroundColor: '#FFFFFF', alignItems: 'center',
          paddingTop: space['2xl'], paddingBottom: space.xl, gap: space.md,
        }}
      >
        {token && !expired ? (
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
                ZEIT ZUM EINLÖSEN
              </Text>
            </View>
            {/* Subtle regenerate link */}
            <TouchableOpacity onPress={regenerate} disabled={regenerating} hitSlop={8}>
              <Text style={{ color: theme.textMuted, fontSize: typo.small, fontWeight: '700' }}>
                {regenerating ? '…' : '🔄  Neuen QR-Code generieren'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={{ alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 18 }}>
            <View style={{ width: 220, height: 220, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 56 }}>{token ? '⌛' : '⏳'}</Text>
            </View>
            <Text style={{ color: token ? theme.danger : theme.textMuted, fontSize: 16, fontWeight: '700' }}>
              {token ? i18n.t('customer.expired') : 'Lade…'}
            </Text>
            {token && (
              <TouchableOpacity
                onPress={regenerate}
                disabled={regenerating}
                style={{
                  backgroundColor: regenerating ? theme.primaryWash : theme.primary,
                  borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12,
                  shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
                }}>
                <Text style={{ color: theme.textOnPrimary, fontSize: 14, fontWeight: '900' }}>
                  {regenerating ? 'Wird generiert…' : '🔄  Neuen QR-Code generieren'}
                </Text>
              </TouchableOpacity>
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
        {cashbackDone ? (
          <View style={{ alignItems: 'center', gap: 6, paddingVertical: 6 }}>
            <Text style={{ fontSize: 28 }}>✅</Text>
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: '800' }}>
              {i18n.t('customer.cashback_redeemed')}
            </Text>
          </View>
        ) : (
          <>
            <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>
              ALTERNATIV
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>
                  Cashback aufs Konto
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>
                  Wenn QR scannen nicht klappt
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCashback}
                style={{
                  backgroundColor: palette.accent, borderRadius: 12,
                  paddingHorizontal: 18, paddingVertical: 10,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>
                  {i18n.t('customer.cashback')}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </MotiView>
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
