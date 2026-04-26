import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { encodeGeohash6 } from '../context/geohash';
import { SavingsStats } from '../savings';
import AnimatedNumber from './AnimatedNumber';
import LangToggle from './LangToggle';
import { theme } from '../theme';

const API = Constants.expoConfig?.extra?.apiUrl as string;

interface LiveCtx {
  city: string | null;
  weather: { temp_c: number; condition: string };
  hour: number;
  minute: number;
}

interface Props {
  stats: SavingsStats;
}

function fmtEur(eur: number): string {
  return eur.toFixed(2).replace('.', ',') + ' €';
}

function conditionEmoji(c: string): string {
  const k = c.toLowerCase();
  if (k.includes('rain') || k.includes('drizzle')) return '🌧';
  if (k.includes('snow')) return '❄️';
  if (k.includes('thunder')) return '⛈';
  if (k.includes('fog') || k.includes('mist')) return '🌫';
  if (k.includes('cloud') || k.includes('overcast')) return '☁️';
  return '☀️';
}

export default function LiveHeader({ stats }: Props) {
  const [live, setLive] = useState<LiveCtx | null>(null);
  const showStreak = stats.count_this_week > 0;

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchLive = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
        const gh = encodeGeohash6(loc.coords.latitude, loc.coords.longitude);
        const res = await fetch(`${API}/api/context/live?geohash6=${gh}`);
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setLive(data);
      } catch {}
    };

    fetchLive();
    timer = setInterval(fetchLive, 30_000);
    return () => { mounted = false; if (timer) clearInterval(timer); };
  }, []);

  const tickerLabel = live
    ? `${live.city ?? '—'} · ${conditionEmoji(live.weather.condition)} ${live.weather.temp_c} °C · ${String(live.hour).padStart(2, '0')}:${String(live.minute).padStart(2, '0')}`
    : 'Wird geladen…';

  return (
    <View style={{
      borderRadius: 18, overflow: 'hidden', marginBottom: 14,
      borderWidth: 1, borderColor: theme.border,
      backgroundColor: theme.surface,
    }}>
      <BlurView intensity={30} tint="light" style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MotiView
                from={{ scale: 0.9, opacity: 0.5 }}
                animate={{ scale: 1.4, opacity: 1 }}
                transition={{ type: 'timing', duration: 1100, loop: true }}
                style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.primary }}
              />
              <Text style={{ color: theme.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 }}>
                LIVE · {tickerLabel}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
              <AnimatedNumber
                value={stats.total_eur}
                format={fmtEur}
                style={{ color: theme.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}
              />
              <Text style={{ color: theme.textMuted, fontSize: 13, fontWeight: '600' }}>gespart</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {showStreak && (
              <MotiView
                from={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 14 }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: theme.primary, borderRadius: 999,
                  paddingHorizontal: 11, paddingVertical: 6,
                }}
              >
                <Text style={{ fontSize: 13 }}>🔥</Text>
                <Text style={{ color: theme.textOnPrimary, fontSize: 13, fontWeight: '800' }}>
                  {stats.count_this_week}
                </Text>
              </MotiView>
            )}
            <TouchableOpacity
              onPress={() => router.push('/(customer)/saved')}
              hitSlop={10}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: theme.primaryWash,
                borderWidth: 1, borderColor: theme.primary + '44',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 16 }}>❤️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/(customer)/map')}
              hitSlop={10}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: theme.surface,
                borderWidth: 1, borderColor: theme.border,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 14 }}>🗺</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/(customer)/history')}
              hitSlop={10}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: theme.surface,
                borderWidth: 1, borderColor: theme.border,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 14 }}>🕐</Text>
            </TouchableOpacity>
            <LangToggle variant="dark" />
          </View>
        </View>
      </BlurView>
    </View>
  );
}
