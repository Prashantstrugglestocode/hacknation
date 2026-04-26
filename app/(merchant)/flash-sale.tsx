import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable, Alert } from 'react-native';
import FallbackImage from '../../lib/components/FallbackImage';
import { itemImageUrl } from '../../lib/images';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { MotiView, AnimatePresence } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../lib/theme';

const API = Constants.expoConfig?.extra?.apiUrl as string;

interface MenuItem {
  id: string;
  name: string;
  price_cents: number | null;
  category: string | null;
  tags?: string[];
  active?: boolean;
}

interface FlashState {
  active: boolean;
  menu_item_ids?: string[];
  items?: MenuItem[];
  pct?: number;
  minutes_left?: number;
}

const fmtPrice = (cents: number | null | undefined) =>
  cents == null ? '' : `${(cents / 100).toFixed(2).replace('.', ',')} €`;

export default function FlashSale() {
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [maxDiscount, setMaxDiscount] = useState(30);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pct, setPct] = useState(20);
  const [duration, setDuration] = useState(60);
  const [current, setCurrent] = useState<FlashState>({ active: false });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadCurrent = useCallback(async (id: string) => {
    try {
      const r = await fetch(`${API}/api/merchant/${id}/flash`);
      if (r.ok) setCurrent(await r.json());
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      const id = await AsyncStorage.getItem('merchant_id');
      if (!id) { router.replace('/(merchant)/setup'); return; }
      setMerchantId(id);
      try {
        const [merchantRes, menuRes] = await Promise.all([
          fetch(`${API}/api/merchant/${id}`),
          fetch(`${API}/api/merchant/${id}/menu`),
        ]);
        if (merchantRes.ok) {
          const m = await merchantRes.json();
          setMaxDiscount(m.max_discount_pct ?? 30);
          setPct(Math.min(20, m.max_discount_pct ?? 20));
        }
        if (menuRes.ok) {
          const data = await menuRes.json();
          const list = Array.isArray(data) ? data : [];
          setItems(list.filter((it: MenuItem) => it.active !== false));
        }
      } catch {}
      await loadCurrent(id);
      setLoading(false);
    })();
  }, [loadCurrent]);

  // Tick remaining time every 30s while a flash is active.
  useEffect(() => {
    if (!current.active || !merchantId) return;
    const t = setInterval(() => loadCurrent(merchantId), 30_000);
    return () => clearInterval(t);
  }, [current.active, merchantId, loadCurrent]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      Haptics.selectionAsync();
      return next;
    });
  };

  const startFlash = async () => {
    if (!merchantId || selected.size === 0) {
      Alert.alert('Auswahl fehlt', 'Wähle mindestens einen Posten für die Flash-Sale.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/merchant/${merchantId}/flash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_item_ids: Array.from(selected),
          pct,
          duration_min: duration,
        }),
      });
      if (res.ok) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCurrent(await res.json());
        setSelected(new Set());
      } else {
        Alert.alert('Fehler', 'Konnte nicht gestartet werden.');
      }
    } catch {
      Alert.alert('Fehler', 'Netzwerkfehler.');
    } finally {
      setSubmitting(false);
    }
  };

  const stopFlash = async () => {
    if (!merchantId) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await fetch(`${API}/api/merchant/${merchantId}/flash`, { method: 'DELETE' }).catch(() => {});
    setCurrent({ active: false });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 16, paddingBottom: 40 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text style={{ color: theme.primary, fontSize: 15, fontWeight: '700' }}>← Zurück</Text>
        </TouchableOpacity>

        <View>
          <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>
            FLASH-SALE
          </Text>
          <Text style={{ color: theme.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.6 }}>
            🔥 Sofort-Aktion
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
            Wähle Posten aus deiner Karte. Die KI baut daraus dringliche Angebote für Kunden in der Nähe.
          </Text>
        </View>

        <AnimatePresence>
          {current.active && (
            <MotiView
              key="active"
              from={{ opacity: 0, translateY: -10 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring' }}
              style={{ borderRadius: 18, overflow: 'hidden' }}
            >
              <LinearGradient
                colors={['#F97316', '#E11D48'] as any}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ padding: 16, gap: 10 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MotiView
                    from={{ scale: 0.9, opacity: 0.6 }}
                    animate={{ scale: 1.3, opacity: 1 }}
                    transition={{ type: 'timing', duration: 800, loop: true }}
                    style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' }}
                  />
                  <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 }}>
                    AKTIV · {current.pct} % · noch {current.minutes_left} Min
                  </Text>
                </View>
                <View style={{ gap: 4 }}>
                  {(current.items ?? []).map(it => (
                    <View key={it.id} style={{
                      flexDirection: 'row', alignItems: 'center', gap: 8,
                      backgroundColor: '#FFFFFF22', borderRadius: 10,
                      paddingHorizontal: 10, paddingVertical: 6,
                    }}>
                      <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800', flex: 1 }} numberOfLines={1}>
                        {it.name}
                      </Text>
                      {it.price_cents != null && (
                        <Text style={{ color: '#FFFFFFCC', fontSize: 12, fontWeight: '700' }}>
                          {fmtPrice(it.price_cents)}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
                <TouchableOpacity onPress={stopFlash}
                  style={{
                    backgroundColor: '#FFFFFF', borderRadius: 12,
                    paddingVertical: 10, alignItems: 'center', marginTop: 4,
                  }}>
                  <Text style={{ color: '#E11D48', fontSize: 13, fontWeight: '900' }}>
                    Flash beenden
                  </Text>
                </TouchableOpacity>
              </LinearGradient>
            </MotiView>
          )}
        </AnimatePresence>

        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
            POSTEN AUSWÄHLEN
          </Text>
          {loading ? (
            <Text style={{ color: theme.textMuted, fontSize: 13, paddingVertical: 12, textAlign: 'center' }}>
              Lade Speisekarte…
            </Text>
          ) : items.length === 0 ? (
            <View style={{
              backgroundColor: theme.surface, borderRadius: 14, padding: 16,
              alignItems: 'center', gap: 8, borderWidth: 1, borderColor: theme.border,
            }}>
              <Text style={{ fontSize: 32 }}>📋</Text>
              <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700', textAlign: 'center' }}>
                Noch keine Posten in der Karte
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center', maxWidth: 260 }}>
                Geh zur Speisekarte und scanne deine Karte mit der Kamera oder füge Posten manuell hinzu.
              </Text>
              <TouchableOpacity onPress={() => merchantId && router.push({ pathname: '/(merchant)/menu', params: { id: merchantId } })}
                style={{
                  backgroundColor: theme.primary, borderRadius: 12,
                  paddingHorizontal: 20, paddingVertical: 10, marginTop: 4,
                }}>
                <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800' }}>Zur Speisekarte</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {items.map(item => {
                const active = selected.has(item.id);
                return (
                  <Pressable key={item.id} onPress={() => toggle(item.id)}>
                    <MotiView
                      animate={{
                        scale: active ? 1 : 0.99,
                        backgroundColor: active ? theme.primary : theme.surface,
                      }}
                      transition={{ type: 'timing', duration: 160 }}
                      style={{
                        borderRadius: 14, padding: 14,
                        borderWidth: 1.5, borderColor: active ? theme.primary : theme.border,
                        flexDirection: 'row', alignItems: 'center', gap: 12,
                      }}
                    >
                      <View style={{
                        width: 44, height: 44, borderRadius: 10, overflow: 'hidden',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <FallbackImage
                          uri={itemImageUrl(item.name, item.category, 100, 100)}
                          style={{ width: 44, height: 44 }}
                          fallbackEmoji={item.category === 'drink' ? '🥤' : item.category === 'dessert' ? '🍰' : '🍽'}
                        />
                        {active && (
                          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFFCC' }}>
                            <Text style={{ fontSize: 18 }}>🔥</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{
                          color: active ? '#FFF' : theme.text,
                          fontSize: 15, fontWeight: '800',
                        }} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {item.category ? (
                          <Text style={{
                            color: active ? '#FFFFFFCC' : theme.textMuted,
                            fontSize: 11, marginTop: 1,
                          }} numberOfLines={1}>
                            {item.category}
                          </Text>
                        ) : null}
                      </View>
                      {item.price_cents != null && (
                        <Text style={{
                          color: active ? '#FFF' : theme.primary,
                          fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'],
                        }}>
                          {fmtPrice(item.price_cents)}
                        </Text>
                      )}
                    </MotiView>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
            RABATT — <Text style={{ color: theme.primary }}>{pct} %</Text>
            <Text style={{ color: theme.textMuted, fontSize: 10 }}>  (max {maxDiscount} %)</Text>
          </Text>
          <Slider
            minimumValue={5}
            maximumValue={Math.max(5, maxDiscount)}
            step={5}
            value={pct}
            onValueChange={setPct}
            minimumTrackTintColor={theme.primary}
            maximumTrackTintColor={theme.border}
            thumbTintColor={theme.primary}
          />
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
            DAUER — <Text style={{ color: theme.primary }}>{duration} Min</Text>
          </Text>
          <Slider
            minimumValue={15}
            maximumValue={120}
            step={15}
            value={duration}
            onValueChange={setDuration}
            minimumTrackTintColor={theme.primary}
            maximumTrackTintColor={theme.border}
            thumbTintColor={theme.primary}
          />
        </View>

        <TouchableOpacity onPress={startFlash} disabled={submitting || selected.size === 0}
          style={{
            backgroundColor: (submitting || selected.size === 0) ? theme.primaryWash : theme.primary,
            borderRadius: 16, paddingVertical: 17, alignItems: 'center', marginTop: 6,
            shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
          }}
        >
          <Text style={{ color: theme.textOnPrimary, fontSize: 16, fontWeight: '900', letterSpacing: 0.3 }}>
            {submitting ? 'Wird gestartet…' : `🔥 Flash starten · ${selected.size} Posten`}
          </Text>
        </TouchableOpacity>

        <Text style={{ color: theme.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
          Die KI baut für Kunden in der Nähe ein dringliches Angebot mit dem ausgewählten Posten.
          Du musst keinen Text schreiben.
        </Text>
      </ScrollView>
    </View>
  );
}
