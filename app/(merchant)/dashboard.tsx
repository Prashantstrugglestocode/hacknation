import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { subscribeMerchantChannel, MerchantEvent } from '../../lib/supabase/realtime';
import i18n from '../../lib/i18n';

const API = Constants.expoConfig?.extra?.apiUrl as string;
const { width } = Dimensions.get('window');

interface Stats {
  generated: number;
  accepted: number;
  redeemed: number;
  accept_rate: number;
  eur_moved: number;
}

interface FeedItem {
  type: MerchantEvent['type'];
  ts: string;
  discount_amount_cents?: number;
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
      case 'offer.shown': return '#6C63FF';
      case 'offer.accepted': return '#4CAF50';
      case 'offer.declined': return '#FF9800';
      case 'offer.redeemed': return '#4CAF50';
    }
  };

  const statCards = [
    { label: i18n.t('merchant.generated'), value: stats.generated },
    { label: i18n.t('merchant.accepted'), value: stats.accepted },
    { label: i18n.t('merchant.redeemed'), value: stats.redeemed },
    { label: i18n.t('merchant.accept_rate'), value: `${Math.round(stats.accept_rate * 100)} %` },
    { label: i18n.t('merchant.eur_moved'), value: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(stats.eur_moved / 100) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 8 }}>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>
            {i18n.t('merchant.dashboard_title')}
          </Text>
          <TouchableOpacity onPress={() => merchantId && router.push('/(merchant)/rules')}>
            <Text style={{ color: '#6C63FF', fontSize: 14 }}>Regeln ✏️</Text>
          </TouchableOpacity>
        </View>

        {/* Stat cards grid */}
        <MotiView key={pulseKey} from={{ scale: 1.02 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
            {statCards.map((card, i) => (
              <View
                key={i}
                style={{
                  backgroundColor: '#1A1A2E',
                  borderRadius: 16,
                  padding: 16,
                  width: (width - 42) / 2,
                  gap: 6,
                }}
              >
                <Text style={{ color: '#ffffff66', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 }}>
                  {card.label.toUpperCase()}
                </Text>
                <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>
                  {card.value}
                </Text>
              </View>
            ))}
          </View>
        </MotiView>

        {/* Live feed */}
        <Text style={{ color: '#ffffff66', fontSize: 13, fontWeight: '600', letterSpacing: 1, marginBottom: 12 }}>
          LIVE FEED
        </Text>
        {feed.length === 0 ? (
          <Text style={{ color: '#ffffff33', fontSize: 14, textAlign: 'center', paddingVertical: 20 }}>
            Noch keine Ereignisse. Warte auf Kunden…
          </Text>
        ) : (
          <View style={{ gap: 8 }}>
            {feed.map((item, i) => (
              <MotiView
                key={i}
                from={{ opacity: 0, translateY: -12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300 }}
                style={{
                  backgroundColor: '#1A1A2E', borderRadius: 12,
                  paddingHorizontal: 16, paddingVertical: 12,
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  borderLeftWidth: 3, borderLeftColor: eventColor(item.type)
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14 }}>{eventLabel(item.type)}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: '#ffffff55', fontSize: 12 }}>{item.ts}</Text>
                  {item.discount_amount_cents ? (
                    <Text style={{ color: '#4CAF50', fontSize: 12, fontWeight: '700' }}>
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
        padding: 16, backgroundColor: '#0A0A0F',
        borderTopWidth: 1, borderTopColor: '#ffffff11'
      }}>
        <TouchableOpacity
          onPress={() => router.push('/(merchant)/scan')}
          style={{
            backgroundColor: '#6C63FF', borderRadius: 18,
            paddingVertical: 20, alignItems: 'center'
          }}
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>
            {i18n.t('merchant.scan_qr')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
