import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { MotiView } from 'moti';
import QRCode from 'react-native-qrcode-svg';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import i18n from '../../../lib/i18n';

const { width, height } = Dimensions.get('window');
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
    <View style={{ flex: 1, backgroundColor: '#0A0A0F', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 40 }}>
      {/* Mode tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: '#1A1A2E', borderRadius: 12, padding: 3, width: 220 }}>
        {(['qr', 'cashback'] as const).map((m) => (
          <TouchableOpacity
            key={m}
            onPress={() => setMode(m)}
            style={{
              flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
              backgroundColor: mode === m ? '#6C63FF' : 'transparent',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: mode === m ? '700' : '400', fontSize: 13 }}>
              {m === 'qr' ? 'QR-Code' : i18n.t('customer.cashback')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === 'qr' ? (
        <MotiView
          from={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
          style={{ alignItems: 'center', gap: 24 }}
        >
          {loading ? (
            <View style={{ width: 240, height: 240, backgroundColor: '#1A1A2E', borderRadius: 20 }} />
          ) : token && !expiredQR ? (
            <View style={{ padding: 20, backgroundColor: '#fff', borderRadius: 20 }}>
              <QRCode value={token} size={200} />
            </View>
          ) : (
            <View style={{ width: 240, height: 240, backgroundColor: '#1A1A2E', borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#FF6B6B', fontSize: 16 }}>{i18n.t('customer.expired')}</Text>
            </View>
          )}

          {/* Countdown */}
          {!expiredQR && (
            <Text style={{ color: secondsLeft < 60 ? '#FF6B6B' : '#ffffff99', fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </Text>
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
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>
                {i18n.t('customer.cashback_redeemed')}
              </Text>
            </MotiView>
          ) : (
            <>
              <Text style={{ color: '#fff', fontSize: 18, textAlign: 'center', lineHeight: 26 }}>
                Cashback wird direkt auf dein Konto gutgeschrieben.
              </Text>
              <TouchableOpacity
                onPress={handleCashback}
                style={{ backgroundColor: '#6C63FF', borderRadius: 16, paddingHorizontal: 40, paddingVertical: 18 }}
              >
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>
                  {i18n.t('customer.cashback')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      <TouchableOpacity onPress={() => router.back()} style={{ paddingVertical: 12 }}>
        <Text style={{ color: '#ffffff55', fontSize: 15 }}>Zurück</Text>
      </TouchableOpacity>
    </View>
  );
}
