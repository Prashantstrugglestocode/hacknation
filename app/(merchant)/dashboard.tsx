import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { subscribeMerchantChannel, MerchantEvent } from '../../lib/supabase/realtime';
import { theme } from '../../lib/theme';
import i18n from '../../lib/i18n';

const API = Constants.expoConfig?.extra?.apiUrl as string;
const { width } = Dimensions.get('window');

interface Stats {
  generated: number;
  accepted: number;
  redeemed: number;
  accept_rate: number;
  eur_moved: number;
  delta?: {
    generated: number;
    accepted: number;
    redeemed: number;
    accept_rate: number;
    eur_moved: number;
  };
}

interface FeedItem {
  type: MerchantEvent['type'];
  ts: string;
  discount_amount_cents?: number;
  headline?: string;
  context_summary?: string;
}

export default function MerchantDashboard() {
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ generated: 0, accepted: 0, redeemed: 0, accept_rate: 0, eur_moved: 0 });
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [pulseKey, setPulseKey] = useState(0);

  const fetchStats = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API}/api/merchant/${id}/stats`);
      if (res.ok) setStats(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      let id = await AsyncStorage.getItem('merchant_id');
      if (!id) { router.replace('/(merchant)/setup'); return; }
      setMerchantId(id);
      fetchStats(id);

      const unsub = subscribeMerchantChannel(id, (event) => {
        setFeed(prev => [{
          type: event.type,
          ts: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
          discount_amount_cents: event.discount_amount_cents,
          headline: event.headline,
          context_summary: event.context_summary,
        }, ...prev].slice(0, 10));
        setPulseKey(k => k + 1);
        fetchStats(id!);
      });

      return unsub;
    })();
  }, []);

  const eventLabel = (type: MerchantEvent['type']) => {
    switch (type) {
      case 'offer.shown': return 'Angebot angezeigt';
      case 'offer.accepted': return 'Angebot akzeptiert ✓';
      case 'offer.declined': return 'Angebot abgelehnt';
      case 'offer.redeemed': return 'Eingelöst ✅';
    }
  };

  const eventColor = (type: MerchantEvent['type']) => {
    switch (type) {
      case 'offer.shown': return theme.primary;
      case 'offer.accepted': return theme.success;
      case 'offer.declined': return theme.warn;
      case 'offer.redeemed': return theme.success;
    }
  };

  const statCards = [
    { 
      label: i18n.t('merchant.generated'), 
      value: stats.generated,
      delta: stats.delta?.generated,
      isPositiveGood: true
    },
    { 
      label: i18n.t('merchant.accepted'), 
      value: stats.accepted,
      delta: stats.delta?.accepted,
      isPositiveGood: true
    },
    { 
      label: i18n.t('merchant.redeemed'), 
      value: stats.redeemed,
      delta: stats.delta?.redeemed,
      isPositiveGood: true
    },
    { 
      label: i18n.t('merchant.accept_rate'), 
      value: `${Math.round(stats.accept_rate * 100)} %`,
      delta: stats.delta?.accept_rate !== undefined ? `${stats.delta.accept_rate > 0 ? '+' : ''}${Math.round(stats.delta.accept_rate * 100)}%` : undefined,
      isPositiveGood: true,
      rawDelta: stats.delta?.accept_rate
    },
    { 
      label: i18n.t('merchant.eur_moved'), 
      value: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(stats.eur_moved / 100),
      delta: stats.delta?.eur_moved !== undefined ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', signDisplay: 'always' }).format(stats.delta.eur_moved / 100) : undefined,
      isPositiveGood: true,
      rawDelta: stats.delta?.eur_moved
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 8 }}>
          <View>
            <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>HÄNDLER-DASHBOARD</Text>
            <Text style={{ color: theme.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>
              {i18n.t('merchant.dashboard_title')}
            </Text>
          </View>
          <TouchableOpacity onPress={() => merchantId && router.push('/(merchant)/rules')}
            style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: theme.primary, fontSize: 14, fontWeight: '700' }}>Regeln ✏️</Text>
          </TouchableOpacity>
        </View>

        {/* Quick action: menu */}
        <TouchableOpacity onPress={() => merchantId && router.push(`/(merchant)/menu?id=${merchantId}`)}
          style={{
            backgroundColor: theme.bgMuted, borderRadius: 16, padding: 14,
            flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16,
            borderWidth: 1, borderColor: theme.border,
          }}>
          <View style={{
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: theme.primary,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 20 }}>📋</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800' }}>
              Speisekarte & KI-Insights
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
              Karte fotografieren · sehen, was nicht läuft
            </Text>
          </View>
          <Text style={{ color: theme.primary, fontSize: 18, fontWeight: '800' }}>›</Text>
        </TouchableOpacity>

        {/* Stat cards grid */}
        <MotiView key={pulseKey} from={{ scale: 1.02 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
            {statCards.map((card, i) => (
              <View
                key={i}
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: 16, padding: 16,
                  width: (width - 42) / 2, gap: 6,
                  borderWidth: 1, borderColor: theme.border,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>
                    {card.label.toUpperCase()}
                  </Text>
                  {card.delta !== undefined && card.delta !== 0 && card.rawDelta !== 0 && (
                    <View style={{ 
                      backgroundColor: ((card.rawDelta ?? card.delta) as number) > 0 ? theme.success + '22' : theme.danger + '22',
                      paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4
                    }}>
                      <Text style={{ 
                        color: ((card.rawDelta ?? card.delta) as number) > 0 ? theme.success : theme.danger, 
                        fontSize: 10, fontWeight: '800' 
                      }}>
                        {typeof card.delta === 'number' ? (card.delta > 0 ? `+${card.delta}` : card.delta) : card.delta}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: theme.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }}>
                  {card.value}
                </Text>
              </View>
            ))}
          </View>
        </MotiView>

        {/* Live feed */}
        <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginBottom: 10 }}>
          LIVE FEED
        </Text>
        {feed.length === 0 ? (
          <View style={{
            backgroundColor: theme.bgMuted, borderRadius: 14, paddingVertical: 28,
            alignItems: 'center', borderWidth: 1, borderColor: theme.border,
            borderStyle: 'dashed',
          }}>
            <Text style={{ color: theme.textMuted, fontSize: 14 }}>
              Noch keine Ereignisse. Warte auf Kunden…
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {feed.map((item, i) => (
              <MotiView
                key={i}
                from={{ opacity: 0, translateY: -12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300 }}
                style={{
                  backgroundColor: theme.surface, borderRadius: 12,
                  paddingHorizontal: 14, paddingVertical: 12,
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
                  borderWidth: 1, borderColor: theme.border,
                  borderLeftWidth: 4, borderLeftColor: eventColor(item.type),
                }}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>{eventLabel(item.type)}</Text>
                  {item.headline ? (
                    <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>{item.headline}</Text>
                  ) : null}
                  {item.context_summary ? (
                    <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2, fontStyle: 'italic' }}>{item.context_summary}</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end', minWidth: 60 }}>
                  <Text style={{ color: theme.textMuted, fontSize: 12 }}>{item.ts}</Text>
                  {item.discount_amount_cents ? (
                    <Text style={{ color: theme.success, fontSize: 12, fontWeight: '800', marginTop: 2 }}>
                      {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
                        .format(item.discount_amount_cents / 100)}
                    </Text>
                  ) : null}
                </View>
              </MotiView>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Sticky scan button */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: 16, backgroundColor: theme.bg,
        borderTopWidth: 1, borderTopColor: theme.border,
      }}>
        <TouchableOpacity
          onPress={() => router.push('/(merchant)/scan')}
          style={{
            backgroundColor: theme.primary, borderRadius: 18,
            paddingVertical: 18, alignItems: 'center',
            shadowColor: theme.primary, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
          }}
        >
          <Text style={{ color: theme.textOnPrimary, fontSize: 17, fontWeight: '800', letterSpacing: 0.3 }}>
            {i18n.t('merchant.scan_qr')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
