import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { MotiView } from 'moti';
import QRCode from 'react-native-qrcode-svg';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { theme } from '../../../lib/theme';
import i18n from '../../../lib/i18n';

const { width } = Dimensions.get('window');
const API = Constants.expoConfig?.extra?.apiUrl as string;

export default function RedeemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [mode, setMode] = useState<'qr' | 'cashback'>('qr');
  const [cashbackDone, setCashbackDone] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch(`${API}/api/offer/${id}/qr`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        const exp = new Date(Date.now() + 5 * 60 * 1000);
        setExpiresAt(exp);
        setSecondsLeft(300);
      }
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleCashback = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await fetch(`${API}/api/offer/${id}/redeem-cashback`, { method: 'POST' });
    setCashbackDone(true);
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const expiredQR = secondsLeft === 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 40 }}>
      <View style={{
        flexDirection: 'row', backgroundColor: theme.bgMuted, borderRadius: 14,
        padding: 3, width: 240, borderWidth: 1, borderColor: theme.border,
      }}>
        {(['qr', 'cashback'] as const).map((m) => {
          const active = mode === m;
          return (
            <TouchableOpacity
              key={m}
              onPress={() => setMode(m)}
              style={{
                flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center',
                backgroundColor: active ? theme.primary : 'transparent',
              }}
            >
              <Text style={{ color: active ? theme.textOnPrimary : theme.text, fontWeight: active ? '800' : '600', fontSize: 13 }}>
                {m === 'qr' ? 'QR-Code' : i18n.t('customer.cashback')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {mode === 'qr' ? (
        <MotiView
          from={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
          style={{ alignItems: 'center', gap: 24 }}
        >
          {loading ? (
            <View style={{ width: 240, height: 240, backgroundColor: theme.bgMuted, borderRadius: 20 }} />
          ) : token && !expiredQR ? (
            <View style={{
              padding: 20, backgroundColor: '#FFFFFF', borderRadius: 22,
              borderWidth: 4, borderColor: theme.primary,
              shadowColor: theme.primary, shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
            }}>
              <QRCode value={token} size={200} color={theme.text} backgroundColor="#FFFFFF" />
            </View>
          ) : (
            <View style={{ width: 240, height: 240, backgroundColor: theme.bgMuted, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: theme.danger, fontSize: 16, fontWeight: '700' }}>{i18n.t('customer.expired')}</Text>
            </View>
          )}

          {!expiredQR && (
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Text style={{
                color: secondsLeft < 60 ? theme.danger : theme.text,
                fontSize: 32, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -0.5,
              }}>
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
                ZEIT ZUM EINLÖSEN
              </Text>
            </View>
          )}
        </MotiView>
      ) : (
        <View style={{ alignItems: 'center', gap: 20, paddingHorizontal: 32 }}>
          {cashbackDone ? (
            <MotiView
              from={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring' }}
              style={{ alignItems: 'center', gap: 16 }}
            >
              <Text style={{ fontSize: 64 }}>✅</Text>
              <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>
                {i18n.t('customer.cashback_redeemed')}
              </Text>
            </MotiView>
          ) : (
            <>
              <Text style={{ color: theme.text, fontSize: 17, textAlign: 'center', lineHeight: 24, fontWeight: '600' }}>
                Cashback wird direkt auf dein Konto gutgeschrieben.
              </Text>
              <TouchableOpacity
                onPress={handleCashback}
                style={{
                  backgroundColor: theme.primary, borderRadius: 16, paddingHorizontal: 40, paddingVertical: 18,
                  shadowColor: theme.primary, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
                }}
              >
                <Text style={{ color: theme.textOnPrimary, fontSize: 17, fontWeight: '800' }}>
                  {i18n.t('customer.cashback')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      <TouchableOpacity onPress={() => router.back()} style={{ paddingVertical: 12 }}>
        <Text style={{ color: theme.textMuted, fontSize: 15, fontWeight: '600' }}>Zurück</Text>
      </TouchableOpacity>
    </View>
  );
}
