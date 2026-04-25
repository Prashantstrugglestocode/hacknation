import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { MotiView } from 'moti';
import { theme } from '../../lib/theme';

const API = Constants.expoConfig?.extra?.apiUrl as string;
const SAVED_KEY = 'cw_saved_offers_v1';

interface SavedOffer {
  id: string;
  merchant_name: string;
  headline: string;
  discount_label: string;
  expires_at: string | null;
  status: string;
}

export default function SavedScreen() {
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [offers, setOffers] = useState<SavedOffer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await AsyncStorage.getItem(SAVED_KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      setSavedIds(ids);

      if (ids.length === 0) { setOffers([]); setLoading(false); return; }

      const fetched = await Promise.all(
        ids.map(async id => {
          try {
            const res = await fetch(`${API}/api/offer/${id}`);
            if (!res.ok) return null;
            const data = await res.json();
            const spec = data.widget_spec ?? {};
            const d = spec.discount ?? {};
            const discount_label =
              d.kind === 'pct' ? `${d.value} %` :
              d.kind === 'eur' ? `${d.value.toFixed(2).replace('.', ',')} €` :
              (d.constraint ?? '');
            return {
              id,
              merchant_name: spec.merchant?.name ?? 'Geschäft',
              headline: spec.headline ?? '',
              discount_label,
              expires_at: data.expires_at,
              status: data.status ?? 'shown',
            };
          } catch { return null; }
        })
      );
      setOffers(fetched.filter((x): x is SavedOffer => !!x));
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    const next = savedIds.filter(x => x !== id);
    await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(next));
    setSavedIds(next);
    setOffers(offers.filter(o => o.id !== id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const cashback = async (id: string) => {
    try {
      const res = await fetch(`${API}/api/offer/${id}/redeem-cashback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Cashback eingelöst', 'Wir merken dir dein Guthaben gut.', [
          { text: 'OK', onPress: () => remove(id) },
        ]);
      } else {
        throw new Error();
      }
    } catch {
      Alert.alert('Fehler', 'Cashback konnte nicht eingelöst werden.');
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ marginBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>GESPEICHERT</Text>
          <Text style={{ color: theme.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>
            {offers.length} Angebot{offers.length === 1 ? '' : 'e'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: theme.primary, fontSize: 15, fontWeight: '700' }}>Schließen</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={{ color: theme.textMuted, textAlign: 'center', padding: 30 }}>Lädt…</Text>
      ) : offers.length === 0 ? (
        <View style={{ alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 }}>
          <Text style={{ fontSize: 56 }}>🤍</Text>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
            Noch keine Favoriten
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 14, textAlign: 'center', maxWidth: 280, lineHeight: 20 }}>
            Tippe das Herz auf einem Angebot, um es hier zu speichern und später per Cashback einzulösen.
          </Text>
        </View>
      ) : (
        offers.map((o, i) => (
          <MotiView
            key={o.id}
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: i * 60 }}
            style={{
              backgroundColor: theme.surface, borderRadius: 16, padding: 14,
              borderWidth: 1, borderColor: theme.border,
              flexDirection: 'row', alignItems: 'center', gap: 12,
            }}
          >
            <View style={{
              width: 44, height: 44, borderRadius: 12,
              backgroundColor: theme.primary,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 18 }}>❤️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800' }} numberOfLines={1}>
                {o.merchant_name}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 13 }} numberOfLines={1}>
                {o.headline}
              </Text>
              {o.discount_label ? (
                <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700', marginTop: 2 }}>
                  {o.discount_label} Rabatt
                </Text>
              ) : null}
            </View>
            <View style={{ gap: 6 }}>
              <TouchableOpacity onPress={() => cashback(o.id)}
                style={{ backgroundColor: theme.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
                <Text style={{ color: theme.textOnPrimary, fontSize: 12, fontWeight: '800' }}>Cashback</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => remove(o.id)}
                style={{ paddingHorizontal: 12, paddingVertical: 4, alignItems: 'center' }}>
                <Text style={{ color: theme.textMuted, fontSize: 11 }}>Entfernen</Text>
              </TouchableOpacity>
            </View>
          </MotiView>
        ))
      )}
    </ScrollView>
  );
}
