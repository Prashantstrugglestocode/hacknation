import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Pressable } from 'react-native';
import { router } from 'expo-router';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { MotiView } from 'moti';
import { theme, space, radius, type as typo } from '../../lib/theme';

const API = Constants.expoConfig?.extra?.apiUrl as string;

const HOURS_KEY_PREFIX = 'cw_business_hours:'; // per-merchant local pref

interface BusinessHours { open: number; close: number }

const DEFAULT_HOURS: BusinessHours = { open: 9, close: 22 };

export default function MerchantSettings() {
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchant, setMerchant] = useState<any>(null);
  const [hours, setHours] = useState<BusinessHours>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const id = await AsyncStorage.getItem('merchant_id');
    if (!id) { router.replace('/(merchant)/setup'); return; }
    setMerchantId(id);
    try {
      const r = await fetch(`${API}/api/merchant/${id}`);
      if (r.ok) setMerchant(await r.json());
    } catch {}
    // Local-only business hours preference (no schema migration).
    try {
      const raw = await AsyncStorage.getItem(HOURS_KEY_PREFIX + id);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.open === 'number' && typeof parsed.close === 'number') {
          setHours(parsed);
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveHours = async () => {
    if (!merchantId) return;
    setSaving(true);
    try {
      await AsyncStorage.setItem(HOURS_KEY_PREFIX + merchantId, JSON.stringify(hours));
      // Also encode into the merchant's time_windows so the offer engine
      // can use it via the existing time-of-day rules.
      const tag = `hours:${String(hours.open).padStart(2, '0')}-${String(hours.close).padStart(2, '0')}`;
      const cur: string[] = Array.isArray(merchant?.time_windows) ? merchant.time_windows : [];
      const next = [tag, ...cur.filter((t: string) => !t.startsWith('hours:'))];
      await fetch(`${API}/api/merchant/${merchantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time_windows: next }),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Fehler', 'Konnte Öffnungszeiten nicht speichern.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 60 }}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
        <Text style={{ color: theme.primary, fontSize: typo.body, fontWeight: '700' }}>← Zurück</Text>
      </TouchableOpacity>

      <View>
        <Text style={{ color: theme.primary, fontSize: typo.caption, fontWeight: '800', letterSpacing: 1.2 }}>
          GESCHÄFTS-EINSTELLUNGEN
        </Text>
        <Text style={{ color: theme.text, fontSize: typo.display, fontWeight: '900', letterSpacing: -0.6 }}>
          🏪 {merchant?.name ?? 'Mein Geschäft'}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: typo.small, marginTop: 4 }}>
          {merchant?.type ?? 'Geschäft'}
        </Text>
      </View>

      {/* Business hours */}
      <Section title="ÖFFNUNGSZEITEN">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={{ color: theme.text, fontSize: typo.body, fontWeight: '700' }}>Geöffnet</Text>
          <Text style={{ color: theme.primary, fontSize: typo.bodyL, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
            {String(hours.open).padStart(2, '0')}:00 – {String(hours.close).padStart(2, '0')}:00
          </Text>
        </View>

        <View style={{ marginTop: space.sm }}>
          <Text style={{ color: theme.textMuted, fontSize: typo.small, fontWeight: '700' }}>
            Öffnen · {String(hours.open).padStart(2, '0')}:00
          </Text>
          <Slider
            minimumValue={0} maximumValue={23} step={1}
            value={hours.open}
            onValueChange={(v) => {
              const open = Math.round(v);
              setHours({ open, close: Math.max(open + 1, hours.close) });
            }}
            minimumTrackTintColor={theme.primary}
            maximumTrackTintColor={theme.border}
            thumbTintColor={theme.primary}
          />
          <Text style={{ color: theme.textMuted, fontSize: typo.small, fontWeight: '700' }}>
            Schließen · {String(hours.close).padStart(2, '0')}:00
          </Text>
          <Slider
            minimumValue={Math.min(23, hours.open + 1)} maximumValue={24} step={1}
            value={hours.close}
            onValueChange={(v) => setHours({ ...hours, close: Math.round(v) })}
            minimumTrackTintColor={theme.primary}
            maximumTrackTintColor={theme.border}
            thumbTintColor={theme.primary}
          />
        </View>

        <TouchableOpacity onPress={saveHours} disabled={saving}
          style={{
            backgroundColor: saving ? theme.primaryWash : theme.primary,
            borderRadius: radius.md, paddingVertical: space.md,
            alignItems: 'center', marginTop: space.sm,
          }}>
          <Text style={{ color: theme.textOnPrimary, fontSize: typo.body, fontWeight: '900' }}>
            {saving ? 'Wird gespeichert…' : '✓ Öffnungszeiten speichern'}
          </Text>
        </TouchableOpacity>
      </Section>

      {/* Quick links to other merchant tools */}
      <Section title="ZIEL & RABATTE">
        <Pressable onPress={() => router.push('/(merchant)/rules')}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: space.md,
            paddingVertical: space.sm,
          }}>
          <Text style={{ fontSize: typo.bodyL }}>📐</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: typo.body, fontWeight: '700' }}>Regeln bearbeiten</Text>
            <Text style={{ color: theme.textMuted, fontSize: typo.small }}>
              Ziel und maximalen Rabatt anpassen
            </Text>
          </View>
          <Text style={{ color: theme.primary, fontSize: typo.bodyL }}>›</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/(merchant)/menu')}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: space.md,
            paddingVertical: space.sm,
          }}>
          <Text style={{ fontSize: typo.bodyL }}>📋</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: typo.body, fontWeight: '700' }}>Speisekarte verwalten</Text>
            <Text style={{ color: theme.textMuted, fontSize: typo.small }}>
              Posten hinzufügen, scannen, KI-Insights
            </Text>
          </View>
          <Text style={{ color: theme.primary, fontSize: typo.bodyL }}>›</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/(merchant)/flash-sale')}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: space.md,
            paddingVertical: space.sm,
          }}>
          <Text style={{ fontSize: typo.bodyL }}>🔥</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: typo.body, fontWeight: '700' }}>Flash-Sale starten</Text>
            <Text style={{ color: theme.textMuted, fontSize: typo.small }}>
              Sofort-Aktion auf einzelne Posten
            </Text>
          </View>
          <Text style={{ color: theme.primary, fontSize: typo.bodyL }}>›</Text>
        </Pressable>
      </Section>

      {/* App-wide settings link */}
      <Section title="APP">
        <Pressable onPress={() => router.push('/settings' as any)}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: space.md,
            paddingVertical: space.sm,
          }}>
          <Text style={{ fontSize: typo.bodyL }}>⚙️</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: typo.body, fontWeight: '700' }}>App-Einstellungen</Text>
            <Text style={{ color: theme.textMuted, fontSize: typo.small }}>
              Sprache, Sound, Haptik, Such-Radius, Datenschutz
            </Text>
          </View>
          <Text style={{ color: theme.primary, fontSize: typo.bodyL }}>›</Text>
        </Pressable>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 280 }}
      style={{
        backgroundColor: theme.surface, borderRadius: radius.lg,
        padding: space.lg, gap: space.sm,
        borderWidth: 1, borderColor: theme.border,
      }}
    >
      <Text style={{ color: theme.textMuted, fontSize: typo.caption, fontWeight: '800', letterSpacing: 1, marginBottom: space.xs }}>
        {title}
      </Text>
      {children}
    </MotiView>
  );
}
