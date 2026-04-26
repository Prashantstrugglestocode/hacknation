import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Dimensions, Pressable } from 'react-native';
import { router } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { subscribeMerchantChannel, MerchantEvent } from '../../lib/supabase/realtime';
import Sparkline from '../../lib/components/Sparkline';
import AnimatedNumber from '../../lib/components/AnimatedNumber';
import RoleSwitch from '../../lib/components/RoleSwitch';
import LangToggle from '../../lib/components/LangToggle';
import FallbackImage from '../../lib/components/FallbackImage';
import { shopImageUrl } from '../../lib/images';
import { theme } from '../../lib/theme';

const API = Constants.expoConfig?.extra?.apiUrl as string;
const { width } = Dimensions.get('window');

interface Stats {
  generated: number;
  accepted: number;
  redeemed: number;
  accept_rate: number;
  eur_moved: number;
  weekly?: Array<{ day: string; generated: number; accepted: number; rate: number }>;
}

interface FeedItem {
  type: MerchantEvent['type'];
  ts: string;
  discount_amount_cents?: number;
}

interface Merchant {
  id: string;
  name: string;
  type: string;
  goal: string;
}

function greetingFor(hour: number): { hi: string; emoji: string } {
  if (hour < 5)  return { hi: 'Gute Nacht', emoji: '🌙' };
  if (hour < 11) return { hi: 'Guten Morgen', emoji: '☀️' };
  if (hour < 14) return { hi: 'Mahlzeit', emoji: '🥪' };
  if (hour < 18) return { hi: 'Schönen Nachmittag', emoji: '☕' };
  if (hour < 22) return { hi: 'Guten Abend', emoji: '🌆' };
  return { hi: 'Späte Stunde', emoji: '🌙' };
}

const eventLabel = (t: MerchantEvent['type']) => ({
  'offer.shown': 'Angebot angezeigt',
  'offer.accepted': 'Akzeptiert',
  'offer.declined': 'Abgelehnt',
  'offer.redeemed': 'Eingelöst',
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

export default function MerchantDashboard() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [stats, setStats] = useState<Stats>({ generated: 0, accepted: 0, redeemed: 0, accept_rate: 0, eur_moved: 0 });
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [pulseKey, setPulseKey] = useState(0);
  const [eventToast, setEventToast] = useState<{ key: number; type: MerchantEvent['type']; cents?: number } | null>(null);
  const [menuCount, setMenuCount] = useState<number | null>(null);
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

  useEffect(() => {
    (async () => {
      const id = await AsyncStorage.getItem('merchant_id');
      if (!id) { router.replace('/(merchant)/setup'); return; }
      try {
        const r = await fetch(`${API}/api/merchant/${id}`);
        if (r.ok) setMerchant(await r.json());
      } catch {}
      fetchStats(id);
      fetchMenuCount(id);

      const unsub = subscribeMerchantChannel(id, (event) => {
        setFeed(prev => [{
          type: event.type,
          ts: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
          discount_amount_cents: event.discount_amount_cents,
        }, ...prev].slice(0, 12));
        setPulseKey(k => k + 1);
        const key = Date.now();
        setEventToast({ key, type: event.type, cents: event.discount_amount_cents });
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setEventToast(null), 2000);
        fetchStats(id);
      });
      return () => {
        unsub();
        if (toastTimer.current) clearTimeout(toastTimer.current);
      };
    })();
  }, []);

  const greeting = greetingFor(new Date().getHours());
  const lastWeek = stats.weekly?.[stats.weekly.length - 1];
  const acceptPct = Math.round(stats.accept_rate * 100);
  const redemptionPct = stats.accepted > 0 ? Math.round((stats.redeemed / stats.accepted) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <AnimatePresence>
        {eventToast && (
          <MotiView
            key={eventToast.key}
            from={{ opacity: 0, translateY: -16, scale: 0.9 }}
            animate={{ opacity: 1, translateY: 0, scale: 1 }}
            exit={{ opacity: 0, translateY: -8 }}
            transition={{ type: 'spring', damping: 14, stiffness: 220 }}
            style={{
              position: 'absolute', top: 64, left: 0, right: 0,
              alignItems: 'center', zIndex: 100, pointerEvents: 'none',
            }}
          >
            <View style={{
              backgroundColor: eventToastBg(eventToast.type),
              borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10,
              flexDirection: 'row', alignItems: 'center', gap: 8,
              shadowColor: eventToastBg(eventToast.type), shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
            }}>
              <Text style={{ fontSize: 16 }}>{eventEmoji(eventToast.type)}</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.3 }}>
                {eventLabel(eventToast.type)}
              </Text>
              {eventToast.cents != null && eventToast.cents > 0 && (
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '900' }}>
                  · {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(eventToast.cents / 100)}
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
        <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
          <RoleSwitch active="merchant" />
        </View>

        {/* HERO BAND — warm greeting + identity over a soft red wash */}
        <View style={{
          marginHorizontal: 14, marginTop: 8, borderRadius: 28, overflow: 'hidden',
          shadowColor: theme.primary, shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
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
            style={{ padding: 22, gap: 18 }}
          >
            {/* Top row: greeting + role/avatar buttons */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Pressable onPress={() => router.push('/(merchant)/picker')} hitSlop={8} style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFFCC', fontSize: 13, fontWeight: '700', letterSpacing: 0.3 }}>
                  {greeting.hi} {greeting.emoji}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: -0.6 }} numberOfLines={1}>
                    {merchant?.name ?? 'Dein Geschäft'}
                  </Text>
                  <Text style={{ color: '#FFFFFFCC', fontSize: 14, fontWeight: '900' }}>▾</Text>
                </View>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <LangToggle variant="light" />
                <Pressable onPress={() => merchant && router.push('/(merchant)/rules')}
                  hitSlop={8}
                  style={{
                    width: 38, height: 38, borderRadius: 19,
                    backgroundColor: '#FFFFFF22', alignItems: 'center', justifyContent: 'center',
                  }}>
                  <Text style={{ fontSize: 16 }}>📐</Text>
                </Pressable>
                <Pressable onPress={() => router.push('/settings' as any)}
                  hitSlop={8}
                  style={{
                    width: 38, height: 38, borderRadius: 19,
                    backgroundColor: '#FFFFFF22', alignItems: 'center', justifyContent: 'center',
                  }}>
                  <Text style={{ fontSize: 16 }}>⚙️</Text>
                </Pressable>
              </View>
            </View>

            {/* Hero stat: today's redeemed + EUR moved */}
            <View style={{ flexDirection: 'row', gap: 18, alignItems: 'baseline' }}>
              <View>
                <Text style={{ color: '#FFFFFFAA', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>HEUTE</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <MotiView
                    key={`redeemed-${pulseKey}`}
                    from={{ scale: 1.22 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 9, stiffness: 280 }}
                  >
                    <AnimatedNumber
                      value={stats.redeemed}
                      style={{ color: '#fff', fontSize: 56, fontWeight: '900', letterSpacing: -2, lineHeight: 60 }}
                    />
                  </MotiView>
                  <Text style={{ color: '#FFFFFFCC', fontSize: 14, fontWeight: '700' }}>eingelöst</Text>
                </View>
              </View>
              <View style={{ flex: 1 }} />
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: '#FFFFFFAA', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>UMSATZ</Text>
                <MotiView
                  key={`eur-${pulseKey}`}
                  from={{ scale: 1.18 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 10, stiffness: 280 }}
                >
                  <AnimatedNumber
                    value={stats.eur_moved / 100}
                    format={n => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)}
                    style={{ color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}
                  />
                </MotiView>
              </View>
            </View>

            {/* Mini funnel: Generated → Accepted → Redeemed bars */}
            <View style={{ gap: 5 }}>
              <FunnelRow label="Generiert"  value={stats.generated} max={Math.max(stats.generated, 1)} />
              <FunnelRow label="Akzeptiert" value={stats.accepted}  max={Math.max(stats.generated, 1)} />
              <FunnelRow label="Eingelöst"  value={stats.redeemed}  max={Math.max(stats.generated, 1)} />
            </View>
          </LinearGradient>
        </View>

        {/* SPARKLINE — minimal, no card chrome around it */}
        {(stats.weekly?.length ?? 0) > 0 && (() => {
          const totalGenerated = (stats.weekly ?? []).reduce((s, b) => s + (b.generated ?? 0), 0);
          const allZero = totalGenerated === 0;
          return (
            <View style={{ paddingHorizontal: 22, marginTop: 22 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <Text style={{ color: theme.text, fontSize: 14, fontWeight: '800' }}>
                  Annahmequote letzte 7 Tage
                </Text>
                <Text style={{ color: allZero ? theme.textMuted : theme.primary, fontSize: 18, fontWeight: '900' }}>
                  {allZero ? '—' : `${Math.round((lastWeek?.rate ?? 0) * 100)}%`}
                </Text>
              </View>
              {allZero ? (
                <View style={{
                  height: 64, borderRadius: 12, backgroundColor: theme.bgMuted,
                  alignItems: 'center', justifyContent: 'center', gap: 4,
                  borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed',
                }}>
                  <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '700' }}>
                    📊 Noch keine Daten · wartet auf erstes Angebot
                  </Text>
                </View>
              ) : (
                <Sparkline values={(stats.weekly ?? []).map(b => b.rate * 100)} width={width - 44} height={64} />
              )}
            </View>
          );
        })()}

        {/* QUICK ACTIONS — 3-up tile row, varied tile shapes */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 14, marginTop: 22, gap: 10 }}>
          <ActionTile
            onPress={() => merchant && router.push(`/(merchant)/preview?id=${merchant.id}`)}
            emoji="👁"
            title="Vorschau"
            sub="Live-Beispiel"
            tone="primary"
          />
          <ActionTile
            onPress={() => router.push('/(merchant)/flash-sale')}
            emoji="🔥"
            title="Flash"
            sub="Sofort-Aktion"
          />
          <ActionTile
            onPress={() => merchant && router.push(`/(merchant)/menu?id=${merchant.id}`)}
            emoji="📋"
            title="Karte"
            sub={menuCount != null ? `${menuCount} Posten` : 'Posten & KI'}
            badge={menuCount}
          />
        </View>

        {/* Secondary stats — split into pairs, NOT all in same grid */}
        <View style={{ paddingHorizontal: 14, marginTop: 18, flexDirection: 'row', gap: 10 }}>
          <SecondaryStat
            label="Annahme"
            big={`${acceptPct}%`}
            sub={`${stats.accepted} / ${stats.generated}`}
            pulseKey={pulseKey}
          />
          <SecondaryStat
            label="Eingelöst"
            big={`${redemptionPct}%`}
            sub={`${stats.redeemed} von akzeptiert`}
            pulseKey={pulseKey}
            tone="muted"
          />
        </View>

        {/* TIMELINE FEED — connector line + dot per event */}
        <View style={{ paddingHorizontal: 22, marginTop: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <MotiView
              from={{ scale: 0.9, opacity: 0.4 }}
              animate={{ scale: 1.4, opacity: 1 }}
              transition={{ type: 'timing', duration: 1100, loop: true }}
              style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.success }}
            />
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: '800' }}>
              Live · Aktivität
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: 12 }}>
              {feed.length > 0 ? `${feed.length} aktuell` : '—'}
            </Text>
          </View>

          {feed.length === 0 ? (
            <View style={{ paddingVertical: 24, alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 36, opacity: 0.4 }}>👋</Text>
              <Text style={{ color: theme.textMuted, fontSize: 14, fontWeight: '600', textAlign: 'center' }}>
                Warte auf den ersten Kunden.
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center', maxWidth: 260 }}>
                Sobald jemand in der Nähe das Angebot sieht, ploppt es hier auf.
              </Text>
            </View>
          ) : (
            <View style={{ position: 'relative', paddingLeft: 22 }}>
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
                  style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}
                >
                  <View style={{
                    position: 'absolute', left: -22, top: 4,
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 13 }}>{eventEmoji(item.type)}</Text>
                      <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>
                        {eventLabel(item.type)}
                      </Text>
                      {item.discount_amount_cents ? (
                        <Text style={{ color: theme.success, fontSize: 12, fontWeight: '800' }}>
                          −{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
                              .format(item.discount_amount_cents / 100)}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={{ color: theme.textMuted, fontSize: 11, fontVariant: ['tabular-nums'] }}>
                      {item.ts}
                    </Text>
                  </View>
                </MotiView>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* STICKY FAB-style scan button */}
      <View style={{
        position: 'absolute', bottom: 16, left: 16, right: 16,
      }}>
        <Pressable
          onPress={() => router.push('/(merchant)/scan')}
          style={({ pressed }) => ({
            backgroundColor: theme.primary,
            borderRadius: 22,
            paddingVertical: 18, paddingHorizontal: 24,
            alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10,
            transform: [{ scale: pressed ? 0.98 : 1 }],
            shadowColor: theme.primary, shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
          })}
        >
          <Text style={{ fontSize: 22 }}>📷</Text>
          <Text style={{ color: theme.textOnPrimary, fontSize: 17, fontWeight: '900', letterSpacing: 0.3 }}>
            Kunden-QR scannen
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function FunnelRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={{ color: '#FFFFFFCC', fontSize: 11, fontWeight: '700', width: 76 }}>{label}</Text>
      <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF22', overflow: 'hidden' }}>
        <MotiView
          from={{ width: '0%' }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'timing', duration: 700 }}
          style={{ height: '100%', backgroundColor: '#FFFFFF', borderRadius: 4 }}
        />
      </View>
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', minWidth: 26, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
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
        borderRadius: 22, padding: 14,
        borderWidth: 1, borderColor: isPrimary ? theme.primary + '55' : theme.border,
        gap: 8, minHeight: 110,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        position: 'relative',
      })}
    >
      <View style={{
        width: 40, height: 40, borderRadius: 14,
        backgroundColor: isPrimary ? theme.primary : theme.bgMuted,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 18 }}>{emoji}</Text>
      </View>
      {badge != null && badge > 0 && (
        <View style={{
          position: 'absolute', top: 10, right: 10,
          backgroundColor: theme.primary, borderRadius: 999,
          minWidth: 22, height: 22, paddingHorizontal: 6,
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 2, borderColor: isPrimary ? theme.primaryWash : theme.surface,
        }}>
          <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      )}
      <View>
        <Text style={{ color: isPrimary ? theme.primaryDark : theme.text, fontSize: 15, fontWeight: '800' }}>
          {title}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
          {sub}
        </Text>
      </View>
    </Pressable>
  );
}

function SecondaryStat({
  label, big, sub, pulseKey, tone,
}: { label: string; big: string; sub: string; pulseKey: number; tone?: 'muted' }) {
  const isMuted = tone === 'muted';
  const restingBg = isMuted ? theme.bgMuted : theme.surface;
  return (
    <MotiView
      key={pulseKey}
      from={{ scale: 0.94, backgroundColor: theme.success + '55' }}
      animate={{ scale: 1, backgroundColor: restingBg }}
      transition={{
        scale: { type: 'spring', damping: 12, stiffness: 240 },
        backgroundColor: { type: 'timing', duration: 700 },
      }}
      style={{
        flex: 1, padding: 14, borderRadius: 18,
        borderWidth: 1, borderColor: theme.border,
      }}
    >
      <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '700' }}>{label}</Text>
      <Text style={{ color: theme.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginTop: 2 }}>
        {big}
      </Text>
      <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '600' }}>{sub}</Text>
    </MotiView>
  );
}
