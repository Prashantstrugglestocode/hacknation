import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MotiView } from 'moti';
import { theme } from '../../lib/theme';

const API = Constants.expoConfig?.extra?.apiUrl as string;
const MERCHANT_ID_KEY = 'merchant_id';

interface MenuItem {
  id: string;
  name: string;
  price_cents: number | null;
  category: string;
  tags: string[];
  active: boolean;
}

interface ItemPerf {
  item_id: string;
  name: string;
  shown: number;
  accepted: number;
  accept_rate: number;
}

interface Insight {
  item_id: string;
  observation: string;
  suggestion: string;
  confidence: 'low' | 'medium' | 'high';
}

function fmtPrice(cents: number | null): string {
  if (cents == null) return '—';
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

export default function MenuScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const [merchantId, setMerchantId] = useState<string | null>(params.id ?? null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [perf, setPerf] = useState<ItemPerf[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    let mid = merchantId;
    if (!mid) {
      mid = await AsyncStorage.getItem(MERCHANT_ID_KEY);
      if (!mid) { setLoading(false); return; }
      setMerchantId(mid);
    }
    try {
      const [menuRes, insRes] = await Promise.all([
        fetch(`${API}/api/merchant/${mid}/menu`),
        fetch(`${API}/api/merchant/${mid}/insights`),
      ]);
      const menuData = await menuRes.json();
      const insData = await insRes.json();
      setItems(Array.isArray(menuData) ? menuData : []);
      setPerf(insData.items_perf ?? []);
      setInsights(insData.insights ?? []);
    } catch (e) {
      console.warn('menu load failed', e);
    } finally {
      setLoading(false);
    }
  }, [merchantId]);

  useEffect(() => { load(); }, [load]);

  const onDelete = async (item: MenuItem) => {
    Alert.alert('Löschen?', item.name, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          await fetch(`${API}/api/merchant/${merchantId}/menu/${item.id}`, { method: 'DELETE' });
          setItems(items.filter(i => i.id !== item.id));
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!merchantId) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Text style={{ fontSize: 64 }}>📋</Text>
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
          Erst Geschäft anlegen
        </Text>
        <TouchableOpacity onPress={() => router.replace('/(merchant)/setup')}
          style={{ backgroundColor: theme.primary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 }}>
          <Text style={{ color: theme.textOnPrimary, fontWeight: '800' }}>Zur Einrichtung</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={theme.primary} />
      }
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <View>
          <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>SPEISEKARTE</Text>
          <Text style={{ color: theme.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>
            {items.length} Posten
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push(`/(merchant)/menu-scan?id=${merchantId}`)}
          style={{
            backgroundColor: theme.primary, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12,
            flexDirection: 'row', alignItems: 'center', gap: 6,
            shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
          }}>
          <Text style={{ fontSize: 16 }}>📷</Text>
          <Text style={{ color: theme.textOnPrimary, fontWeight: '800', fontSize: 14 }}>Karte scannen</Text>
        </TouchableOpacity>
      </View>

      {/* Insights card */}
      {insights.length > 0 && (
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500 }}
          style={{
            backgroundColor: theme.primary, borderRadius: 18, padding: 16, gap: 10,
            shadowColor: theme.primary, shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 14 }}>🧠</Text>
            <Text style={{ color: theme.textOnPrimary, fontSize: 13, fontWeight: '800', letterSpacing: 1 }}>KI-INSIGHTS</Text>
          </View>
          {insights.map((i, idx) => {
            const item = items.find(x => x.id === i.item_id);
            return (
              <View key={idx} style={{ paddingTop: 4 }}>
                <Text style={{ color: theme.textOnPrimary, fontSize: 15, fontWeight: '800' }}>
                  {item?.name ?? '—'}
                </Text>
                <Text style={{ color: '#FFFFFFCC', fontSize: 13, marginTop: 2, lineHeight: 18 }}>
                  {i.observation}
                </Text>
                <Text style={{ color: theme.textOnPrimary, fontSize: 13, fontWeight: '700', marginTop: 4 }}>
                  → {i.suggestion}
                </Text>
              </View>
            );
          })}
        </MotiView>
      )}

      {/* Items */}
      {items.length === 0 ? (
        <View style={{ alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 }}>
          <Text style={{ fontSize: 56 }}>📷</Text>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
            Noch keine Speisekarte gescannt
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 14, textAlign: 'center', maxWidth: 260, lineHeight: 20 }}>
            Fotografiere deine gedruckte Karte. KI erkennt Posten und Preise automatisch.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {items.map(item => {
            const p = perf.find(x => x.item_id === item.id);
            const rate = p ? Math.round(p.accept_rate * 100) : 0;
            const colored = p && p.shown >= 3;
            return (
              <View key={item.id} style={{
                backgroundColor: theme.surface, borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: theme.border,
                flexDirection: 'row', alignItems: 'center', gap: 12,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{item.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <Text style={{ color: theme.textMuted, fontSize: 13 }}>{fmtPrice(item.price_cents)}</Text>
                    <Text style={{ color: theme.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>·  {item.category}</Text>
                  </View>
                  {colored && (
                    <Text style={{
                      color: rate >= 50 ? theme.success : rate >= 20 ? theme.warn : theme.danger,
                      fontSize: 12, fontWeight: '700', marginTop: 4,
                    }}>
                      {rate}% Annahme · {p!.shown} gezeigt
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => onDelete(item)} hitSlop={8}>
                  <Text style={{ fontSize: 16, color: theme.textMuted }}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
