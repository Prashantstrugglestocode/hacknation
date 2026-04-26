import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import FallbackImage from '../../lib/components/FallbackImage';
import { itemImageUrl } from '../../lib/images';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
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

const CATEGORIES = ['drink', 'food', 'dessert', 'special'] as const;

export default function MenuScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const [merchantId, setMerchantId] = useState<string | null>(params.id ?? null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [perf, setPerf] = useState<ItemPerf[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Inline-add form state
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategory, setNewCategory] = useState<typeof CATEGORIES[number]>('food');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const submitNew = async () => {
    setAddError(null);
    // Always read the live merchant id — never trust possibly-stale state.
    const mid = (await AsyncStorage.getItem(MERCHANT_ID_KEY)) ?? merchantId;
    if (!mid) {
      setAddError('Kein Geschäft eingerichtet.');
      return;
    }
    if (!newName.trim()) {
      setAddError('Bitte einen Namen eingeben.');
      return;
    }
    setAdding(true);
    const name = newName.trim();
    const priceCents = newPrice ? Math.round(parseFloat(newPrice.replace(',', '.')) * 100) : null;
    const cat = newCategory;
    try {
      const res = await fetch(`${API}/api/merchant/${mid}/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price_cents: priceCents, category: cat }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => '');
        setAddError(`HTTP ${res.status}${msg ? ' · ' + msg.slice(0, 80) : ''}`);
        return;
      }
      const created = await res.json().catch(() => null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNewName(''); setNewPrice('');
      setJustAdded(name);
      setTimeout(() => setJustAdded(null), 2200);
      // Optimistic insert — show the item at the top immediately.
      if (created?.id) {
        setItems(prev => [created as MenuItem, ...prev]);
      }
      // Background re-sync so we pick up server-side normalization.
      load();
    } catch (e: any) {
      setAddError(`Netzwerk: ${e?.message ?? 'Verbindung fehlgeschlagen'}`);
    } finally {
      setAdding(false);
    }
  };

  const load = useCallback(async () => {
    const mid = (await AsyncStorage.getItem(MERCHANT_ID_KEY)) ?? params.id ?? null;
    if (!mid) { setLoading(false); return; }
    setMerchantId(mid);
    // Menu items render immediately (fast DB query). Insights call an LLM
    // in the background — should not block the item list visibility.
    try {
      const menuRes = await fetch(`${API}/api/merchant/${mid}/menu`);
      const menuData = await menuRes.json();
      setItems(Array.isArray(menuData) ? menuData : []);
    } catch (e) {
      console.warn('menu load failed', e);
    } finally {
      setLoading(false);
    }
    // Background — never blocks the UI.
    fetch(`${API}/api/merchant/${mid}/insights`)
      .then(r => r.ok ? r.json() : null)
      .then(insData => {
        if (!insData) return;
        setPerf(insData.items_perf ?? []);
        setInsights(insData.insights ?? []);
      })
      .catch(() => {});
  }, [params.id]);

  // Keep a stable ref to load so neither effect re-registers when load
  // identity changes (which previously caused repeated re-fetches).
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => { loadRef.current(); }, []);

  // Re-fetch on focus so a merchant switch (via picker) shows the right list.
  useFocusEffect(useCallback(() => { loadRef.current(); }, []));

  const onDelete = async (item: MenuItem) => {
    Alert.alert('Löschen?', item.name, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          // Use live merchant_id from AsyncStorage — state can be stale.
          const mid = (await AsyncStorage.getItem(MERCHANT_ID_KEY)) ?? merchantId;
          if (!mid) return;
          // Optimistic remove.
          setItems(prev => prev.filter(i => i.id !== item.id));
          try {
            const res = await fetch(`${API}/api/merchant/${mid}/menu/${item.id}`, { method: 'DELETE' });
            if (!res.ok) {
              Alert.alert('Fehler', `Löschen fehlgeschlagen (${res.status})`);
              load(); // re-sync to undo optimistic remove
            }
          } catch {
            Alert.alert('Fehler', 'Netzwerkfehler beim Löschen');
            load();
          }
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  };

  const onDeleteAll = async () => {
    Alert.alert(
      'Alle Posten löschen?',
      'Das löscht ALLE Speisekarte-Posten. Diese Aktion kann nicht rückgängig gemacht werden.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Alle löschen',
          style: 'destructive',
          onPress: async () => {
            const mid = (await AsyncStorage.getItem(MERCHANT_ID_KEY)) ?? merchantId;
            if (!mid) return;
            const before = items;
            setItems([]); // optimistic
            try {
              const res = await fetch(`${API}/api/merchant/${mid}/menu`, { method: 'DELETE' });
              if (!res.ok) {
                setItems(before);
                Alert.alert('Fehler', `Konnte nicht löschen (${res.status})`);
              } else {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch {
              setItems(before);
              Alert.alert('Fehler', 'Netzwerkfehler');
            }
          },
        },
      ]
    );
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text style={{ color: theme.primary, fontSize: 15, fontWeight: '700' }}>← Zurück</Text>
        </TouchableOpacity>
        {items.length > 0 ? (
          <TouchableOpacity onPress={onDeleteAll} hitSlop={10}>
            <Text style={{ color: theme.danger, fontSize: 13, fontWeight: '700' }}>
              🗑  Alle löschen
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <View>
          <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>SPEISEKARTE</Text>
          <Text style={{ color: theme.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>
            {items.length} Posten
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={() => setAddOpen(o => !o)}
            style={{
              backgroundColor: addOpen ? theme.primary : theme.surface,
              borderRadius: 999, paddingHorizontal: 14, paddingVertical: 12,
              flexDirection: 'row', alignItems: 'center', gap: 4,
              borderWidth: 1, borderColor: theme.primary,
            }}>
            <Text style={{ color: addOpen ? theme.textOnPrimary : theme.primary, fontSize: 16, fontWeight: '900' }}>
              {addOpen ? '×' : '+'}
            </Text>
            <Text style={{ color: addOpen ? theme.textOnPrimary : theme.primary, fontWeight: '800', fontSize: 13 }}>
              {addOpen ? 'Schließen' : 'Posten'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push(`/(merchant)/menu-scan?id=${merchantId}`)}
            style={{
              backgroundColor: theme.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 12,
              flexDirection: 'row', alignItems: 'center', gap: 4,
              shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
            }}>
            <Text style={{ fontSize: 14 }}>📷</Text>
            <Text style={{ color: theme.textOnPrimary, fontWeight: '800', fontSize: 13 }}>Scannen</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Inline add form */}
      {addOpen && (
        <MotiView
          from={{ opacity: 0, translateY: -6 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 220 }}
          style={{
            backgroundColor: theme.surface, borderRadius: 14, padding: 14, gap: 10,
            borderWidth: 1.5, borderColor: theme.primary,
          }}
        >
          <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>
            NEUER POSTEN
          </Text>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="z.B. Cappuccino"
            placeholderTextColor={theme.textMuted}
            style={{
              backgroundColor: theme.bg, borderRadius: 10, padding: 12,
              color: theme.text, fontSize: 15, borderWidth: 1, borderColor: theme.border,
            }}
            autoFocus
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={newPrice}
              onChangeText={setNewPrice}
              placeholder="3,50"
              placeholderTextColor={theme.textMuted}
              keyboardType="decimal-pad"
              style={{
                flex: 1, backgroundColor: theme.bg, borderRadius: 10, padding: 12,
                color: theme.text, fontSize: 15, borderWidth: 1, borderColor: theme.border,
              }}
            />
            <Text style={{ alignSelf: 'center', color: theme.textMuted, fontSize: 14, fontWeight: '700' }}>€</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {CATEGORIES.map(c => {
              const active = newCategory === c;
              return (
                <TouchableOpacity key={c} onPress={() => setNewCategory(c)}
                  style={{
                    backgroundColor: active ? theme.primary : theme.bg,
                    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
                    borderWidth: 1, borderColor: active ? theme.primary : theme.border,
                  }}>
                  <Text style={{
                    color: active ? theme.textOnPrimary : theme.text,
                    fontSize: 12, fontWeight: active ? '800' : '600',
                  }}>
                    {c === 'drink' ? '🥤' : c === 'food' ? '🍽' : c === 'dessert' ? '🍰' : '⭐'} {c}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity onPress={submitNew} disabled={adding || !newName.trim()}
            style={{
              backgroundColor: (adding || !newName.trim()) ? theme.primaryWash : theme.primary,
              borderRadius: 12, paddingVertical: 13, alignItems: 'center',
            }}>
            <Text style={{ color: theme.textOnPrimary, fontSize: 14, fontWeight: '900' }}>
              {adding ? 'Wird gespeichert…' : '+ Posten hinzufügen'}
            </Text>
          </TouchableOpacity>
          {addError ? (
            <View style={{
              backgroundColor: theme.danger + '11', borderRadius: 10, padding: 10,
              borderWidth: 1, borderColor: theme.danger + '44',
            }}>
              <Text style={{ color: theme.danger, fontSize: 12, fontWeight: '700' }}>⚠ {addError}</Text>
            </View>
          ) : null}
        </MotiView>
      )}

      {justAdded ? (
        <MotiView
          from={{ opacity: 0, translateY: -6 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 18 }}
          style={{
            backgroundColor: theme.success + '22', borderRadius: 12, padding: 12,
            flexDirection: 'row', alignItems: 'center', gap: 8,
            borderWidth: 1, borderColor: theme.success + '44',
          }}>
          <Text style={{ fontSize: 16 }}>✅</Text>
          <Text style={{ color: theme.success, fontSize: 13, fontWeight: '800', flex: 1 }} numberOfLines={1}>
            "{justAdded}" hinzugefügt
          </Text>
        </MotiView>
      ) : null}

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
            <Text style={{ color: theme.textOnPrimary, fontSize: 13, fontWeight: '800', letterSpacing: 1 }}>INSIGHTS</Text>
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
                backgroundColor: theme.surface, borderRadius: 14, padding: 10,
                borderWidth: 1, borderColor: theme.border,
                flexDirection: 'row', alignItems: 'center', gap: 12,
              }}>
                <FallbackImage
                  uri={itemImageUrl(item.name, item.category, 120, 120)}
                  style={{ width: 56, height: 56, borderRadius: 10 }}
                  fallbackEmoji={item.category === 'drink' ? '🥤' : item.category === 'dessert' ? '🍰' : '🍽'}
                />
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
