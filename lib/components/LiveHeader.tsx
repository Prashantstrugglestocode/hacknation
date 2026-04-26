import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { encodeGeohash6 } from '../context/geohash';
import { SavingsStats } from '../savings';
import { useLocaleVersion } from '../i18n';
import { theme, space, radius, type } from '../theme';

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

function conditionEmoji(c: string): string {
  const k = c.toLowerCase();
  if (k.includes('rain') || k.includes('drizzle')) return '🌧';
  if (k.includes('snow')) return '❄️';
  if (k.includes('thunder')) return '⛈';
  if (k.includes('fog') || k.includes('mist')) return '🌫';
  if (k.includes('cloud') || k.includes('overcast')) return '☁️';
  return '☀️';
}

export default function LiveHeader({ stats: _stats }: Props) {
  const [live, setLive] = useState<LiveCtx | null>(null);
  useLocaleVersion(); // kept as a no-op tick; harmless

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

  return (
    <View style={{
      borderRadius: radius.lg, marginBottom: space.md,
      borderWidth: 1, borderColor: theme.primary + '1A',
      backgroundColor: theme.primaryWash,
      paddingVertical: space.lg, paddingHorizontal: space.lg,
      gap: space.md,
      // Soft tinted shadow — primary, not gray (per skill).
      shadowColor: theme.primary,
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    }}>
      {/* Row 1 — small live ticker (lang toggle moved to settings only) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <MotiView
          from={{ scale: 0.9, opacity: 0.5 }}
          animate={{ scale: 1.4, opacity: 1 }}
          transition={{ type: 'timing', duration: 1100, loop: true }}
          style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.primary }}
        />
        <Text
          style={{ color: theme.primary, fontSize: type.micro, fontWeight: '800', letterSpacing: 1.4, flex: 1 }}
          numberOfLines={1}
        >
          {live
            ? `LIVE · ${live.city ?? '—'} · ${conditionEmoji(live.weather.condition)} ${live.weather.temp_c}°C · ${String(live.hour).padStart(2,'0')}:${String(live.minute).padStart(2,'0')}`
            : `LIVE · syncing context…`}
        </Text>
      </View>

      {/* Row 2 — settings cog only. Savings amount + streak removed
          per product decision; the customer sees what they save in the
          Hero card / receipt, no need for a running tally on top. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Pressable
            onPress={() => router.push('/settings' as any)}
            hitSlop={12}
            style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: theme.surface,
              borderWidth: 1, borderColor: theme.primary + '22',
              alignItems: 'center', justifyContent: 'center',
              shadowColor: theme.primary, shadowOpacity: 0.06,
              shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
            }}
          >
            <Text style={{ fontSize: type.bodyL }}>⚙️</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
