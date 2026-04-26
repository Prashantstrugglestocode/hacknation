import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { encodeGeohash6 } from '../context/geohash';
import { SavingsStats } from '../savings';
import AnimatedNumber from './AnimatedNumber';
import i18n, { useLocaleVersion } from '../i18n';
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

function fmtEur(eur: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }).format(eur);
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
  useLocaleVersion(); // Re-render on language change so i18n.t() refreshes

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

      {/* Row 2 — savings number stack (left) + streak + heart (right).
          alignItems flex-end keeps the display number's baseline tied to the
          bottom of the 44pt icon row — don't switch to center. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ gap: space.xs }}>
          <Text style={{
            color: theme.textMuted, fontSize: type.caption, fontWeight: '700',
            letterSpacing: 1, textTransform: 'uppercase',
          }}>
            {i18n.t('common.saved_label')}
          </Text>
          <AnimatedNumber
            value={stats.total_eur}
            format={fmtEur}
            style={{
              color: theme.text, fontSize: type.display, fontWeight: '900',
              letterSpacing: -0.8, lineHeight: type.display + 4,
              fontVariant: ['tabular-nums'],
            }}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          {showStreak && (
            <MotiView
              from={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 14 }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: space.xs,
                backgroundColor: theme.primary, borderRadius: radius.pill,
                paddingHorizontal: space.md, paddingVertical: space.xs,
                shadowColor: theme.primary, shadowOpacity: 0.28,
                shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
              }}
            >
              <Text style={{ fontSize: type.body }}>🔥</Text>
              <Text style={{
                color: theme.textOnPrimary, fontSize: type.small, fontWeight: '900',
                fontVariant: ['tabular-nums'],
              }}>
                {stats.count_this_week}
              </Text>
            </MotiView>
          )}
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
