import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Pressable, Alert,
  KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { MotiView } from 'moti';
import { theme, space, radius, type as typo } from '../../lib/theme';

const API = Constants.expoConfig?.extra?.apiUrl as string;

interface MenuItem {
  id: string;
  name: string;
  price_cents: number | null;
  category: string | null;
}
interface ComboItem extends MenuItem {}
interface Combo {
  id: string;
  name: string;
  menu_item_ids: string[];
  combo_price_cents: number;
  items: ComboItem[];
  base_total_cents: number;
  savings_cents: number;
}

const fmt = (cents: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);

export default function CombosScreen() {
  const insets = useSafeAreaInsets();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // New-combo form state.
  const [draftName, setDraftName] = useState('');
  const [draftItems, setDraftItems] = useState<string[]>([]);
  const [draftPriceEur, setDraftPriceEur] = useState('');

  const load = useCallback(async () => {
    const id = await AsyncStorage.getItem('merchant_id');
    if (!id) { router.replace('/(merchant)/setup'); return; }
    setMerchantId(id);
    try {
      const [cR, mR] = await Promise.all([
        fetch(`${API}/api/merchant/${id}/combos`),
        fetch(`${API}/api/merchant/${id}/menu`),
      ]);
      if (cR.ok) {
        const d = await cR.json();
        setCombos(Array.isArray(d?.combos) ? d.combos : []);
      }
      if (mR.ok) {
        const d = await mR.json();
        setMenu(Array.isArray(d) ? d : []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleDraftItem = (id: string) => {
    setDraftItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 4 ? [...prev, id] : prev);
    Haptics.selectionAsync().catch(() => {});
  };

  const draftBaseSum = draftItems.reduce((s, id) => {
    const it = menu.find(m => m.id === id);
    return s + (it?.price_cents ?? 0);
  }, 0);
  const parsedPriceCents = (() => {
    const norm = draftPriceEur.trim().replace(',', '.');
    const n = parseFloat(norm);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  })();
  const draftSavings = Math.max(0, draftBaseSum - parsedPriceCents);
  const draftValid = draftItems.length >= 2 && parsedPriceCents > 0 && parsedPriceCents < draftBaseSum;

  const createCombo = async () => {
    if (!merchantId || !draftValid) return;
    setCreating(true);
    try {
      const r = await fetch(`${API}/api/merchant/${merchantId}/combos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draftName.trim() || 'Combo',
          menu_item_ids: draftItems,
          combo_price_cents: parsedPriceCents,
        }),
      });
      if (!r.ok) {
        Alert.alert('Fehler', 'Combo konnte nicht erstellt werden.');
        return;
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setDraftName('');
      setDraftItems([]);
      setDraftPriceEur('');
      await load();
    } catch {
      Alert.alert('Netzwerkfehler', 'Bitte erneut versuchen.');
    } finally {
      setCreating(false);
    }
  };

  const removeCombo = async (comboId: string) => {
    if (!merchantId) return;
    try {
      await fetch(`${API}/api/merchant/${merchantId}/combos/${comboId}`, { method: 'DELETE' });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      await load();
    } catch {}
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{
        padding: space.lg, gap: space.lg,
        paddingTop: Math.max(insets.top + space.sm, space['2xl']),
        paddingBottom: 200,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity onPress={() => router.back()} hitSlop={16}
        style={{
          alignSelf: 'flex-start',
          paddingVertical: space.sm, paddingHorizontal: space.md,
          marginLeft: -space.md,
        }}>
        <Text style={{ color: theme.primary, fontSize: typo.bodyL, fontWeight: '800' }}>← Zurück</Text>
      </TouchableOpacity>

      <View>
        <Text style={{ color: theme.primary, fontSize: typo.caption, fontWeight: '900', letterSpacing: 1.2 }}>
          BUNDLE-DEALS
        </Text>
        <Text style={{ color: theme.text, fontSize: typo.display, fontWeight: '900', letterSpacing: -0.6 }}>
          🎁 Combos
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: typo.small, fontWeight: '700', marginTop: space.xs }}>
          Bündele 2-4 Posten zu einem Festpreis. Stadtpuls bevorzugt Combos beim Generieren.
        </Text>
      </View>

      {/* Existing combos */}
      {combos.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Text style={{ color: theme.textMuted, fontSize: typo.caption, fontWeight: '900', letterSpacing: 1 }}>
            AKTIVE COMBOS · {combos.length}
          </Text>
          {combos.map(co => (
            <MotiView
              key={co.id}
              from={{ opacity: 0, translateY: 6 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 240 }}
              style={{
                backgroundColor: theme.surface, borderRadius: radius.lg,
                padding: space.md, gap: space.sm,
                borderWidth: 1, borderColor: theme.border,
                shadowColor: theme.primary, shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
              }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: typo.bodyL, fontWeight: '900' }} numberOfLines={1}>
                    {co.name}
                  </Text>
                  <Text style={{ color: theme.textMuted, fontSize: typo.small, fontWeight: '700', marginTop: 2 }} numberOfLines={2}>
                    {co.items.map(it => it.name).join(' · ')}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeCombo(co.id)} hitSlop={12}
                  style={{
                    backgroundColor: theme.danger + '14',
                    borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.xs,
                    borderWidth: 1, borderColor: theme.danger + '44',
                  }}>
                  <Text style={{ color: theme.danger, fontSize: typo.small, fontWeight: '900' }}>
                    Löschen
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'baseline' }}>
                <View>
                  <Text style={{ color: theme.textMuted, fontSize: typo.micro, fontWeight: '900', letterSpacing: 1 }}>
                    EINZELN
                  </Text>
                  <Text style={{ color: theme.textMuted, fontSize: typo.body, fontWeight: '700', textDecorationLine: 'line-through' }}>
                    {fmt(co.base_total_cents)}
                  </Text>
                </View>
                <View>
                  <Text style={{ color: theme.primary, fontSize: typo.micro, fontWeight: '900', letterSpacing: 1 }}>
                    COMBO
                  </Text>
                  <Text style={{ color: theme.text, fontSize: typo.bodyL, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
                    {fmt(co.combo_price_cents)}
                  </Text>
                </View>
                <View style={{ marginLeft: 'auto' }}>
                  <Text style={{ color: theme.success, fontSize: typo.micro, fontWeight: '900', letterSpacing: 1 }}>
                    KUNDE SPART
                  </Text>
                  <Text style={{ color: theme.success, fontSize: typo.bodyL, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
                    {fmt(co.savings_cents)}
                  </Text>
                </View>
              </View>
            </MotiView>
          ))}
        </View>
      )}

      {/* Create combo */}
      <View style={{
        backgroundColor: theme.surface, borderRadius: radius.lg,
        padding: space.lg, gap: space.md,
        borderWidth: 1, borderColor: theme.border,
      }}>
        <Text style={{ color: theme.textMuted, fontSize: typo.caption, fontWeight: '900', letterSpacing: 1 }}>
          NEUE COMBO
        </Text>

        {menu.length < 2 ? (
          <Text style={{ color: theme.textMuted, fontSize: typo.small, fontWeight: '700' }}>
            Mindestens 2 Posten in der Speisekarte nötig. Speisekarte verwalten ›
          </Text>
        ) : (
          <>
            <View style={{ gap: 6 }}>
              <Text style={{ color: theme.textMuted, fontSize: typo.small, fontWeight: '700' }}>
                Name (z.B. „Frühstücks-Set")
              </Text>
              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                placeholder="Frühstücks-Set"
                placeholderTextColor={theme.textMuted}
                style={{
                  backgroundColor: theme.bg, borderRadius: radius.md, padding: space.md,
                  color: theme.text, fontSize: typo.body, fontWeight: '700',
                  borderWidth: 1, borderColor: theme.border,
                }}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ color: theme.textMuted, fontSize: typo.small, fontWeight: '700' }}>
                Posten wählen · {draftItems.length}/4
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                {menu.map(it => {
                  const active = draftItems.includes(it.id);
                  return (
                    <Pressable key={it.id} onPress={() => toggleDraftItem(it.id)}
                      style={{
                        backgroundColor: active ? theme.primary : theme.surface,
                        borderRadius: radius.pill,
                        paddingHorizontal: space.md, paddingVertical: space.xs + 1,
                        borderWidth: 1, borderColor: active ? theme.primary : theme.border,
                      }}>
                      <Text style={{
                        color: active ? theme.textOnPrimary : theme.text,
                        fontSize: typo.small, fontWeight: '800',
                      }}>
                        {it.name}{it.price_cents != null ? ` · ${fmt(it.price_cents)}` : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ color: theme.textMuted, fontSize: typo.small, fontWeight: '700' }}>
                Combo-Preis (€)
              </Text>
              <TextInput
                value={draftPriceEur}
                onChangeText={setDraftPriceEur}
                placeholder={draftBaseSum > 0 ? `weniger als ${fmt(draftBaseSum)}` : '4,50'}
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: theme.bg, borderRadius: radius.md, padding: space.md,
                  color: theme.text, fontSize: typo.body, fontWeight: '700',
                  borderWidth: 1, borderColor: theme.border,
                }}
              />
            </View>

            {draftItems.length >= 2 && parsedPriceCents > 0 && (
              <View style={{
                backgroundColor: draftValid ? theme.success + '12' : theme.warn + '12',
                borderRadius: radius.md, padding: space.sm,
                borderWidth: 1, borderColor: draftValid ? theme.success + '55' : theme.warn + '55',
              }}>
                <Text style={{
                  color: draftValid ? theme.success : theme.warn,
                  fontSize: typo.small, fontWeight: '900',
                }}>
                  {draftValid
                    ? `Kunde spart ${fmt(draftSavings)} (statt ${fmt(draftBaseSum)})`
                    : `Combo-Preis muss kleiner sein als ${fmt(draftBaseSum)}`}
                </Text>
              </View>
            )}

            <TouchableOpacity onPress={createCombo} disabled={!draftValid || creating}
              style={{
                backgroundColor: draftValid && !creating ? theme.primary : theme.primaryWash,
                borderRadius: radius.md, paddingVertical: space.md,
                alignItems: 'center', marginTop: space.xs,
                shadowColor: theme.primary, shadowOpacity: draftValid ? 0.3 : 0,
                shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
              }}>
              <Text style={{ color: theme.textOnPrimary, fontSize: typo.body, fontWeight: '900' }}>
                {creating ? 'Wird gespeichert...' : '✓ Combo erstellen'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
    </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
