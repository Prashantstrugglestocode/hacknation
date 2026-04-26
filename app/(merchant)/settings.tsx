import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { MotiView } from 'moti';
import LangToggle from '../../lib/components/LangToggle';
import LocationPicker, { PickedLocation } from '../../lib/components/LocationPicker';
import i18n, { useLocaleVersion } from '../../lib/i18n';
import { theme, space, radius, type as typo } from '../../lib/theme';

const API = Constants.expoConfig?.extra?.apiUrl as string;

const HOURS_KEY_PREFIX = 'cw_business_hours:'; // per-merchant local pref

interface BusinessHours { open: number; close: number }

const DEFAULT_HOURS: BusinessHours = { open: 9, close: 22 };

export default function MerchantSettings() {
  useLocaleVersion();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchant, setMerchant] = useState<any>(null);
  const [hours, setHours] = useState<BusinessHours>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationSaved, setLocationSaved] = useState(false);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    const id = await AsyncStorage.getItem('merchant_id');
    if (!id) { router.replace('/(merchant)/setup'); return; }
    setMerchantId(id);
    try {
      const r = await fetch(`${API}/api/merchant/${id}`);
      if (r.ok) {
        const m = await r.json();
        setMerchant(m);
        // Seed the LocationPicker with the merchant's current coords so the
        // map preview shows where the shop is right now.
        if (typeof m?.lat === 'number' && typeof m?.lng === 'number') {
          setLocation({ lat: m.lat, lng: m.lng, address: m.address ?? `${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}` });
        }
      }
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

  const saveLocation = async () => {
    if (!merchantId || !location) return;
    setSavingLocation(true);
    setLocationSaved(false);
    try {
      const r = await fetch(`${API}/api/merchant/${merchantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: location.lat, lng: location.lng }),
      });
      if (!r.ok) {
        Alert.alert('Fehler', 'Standort konnte nicht gespeichert werden.');
        return;
      }
      const updated = await r.json().catch(() => null);
      if (updated) {
        setMerchant(updated);
        // Re-seed the picker from the freshly-persisted server state so the
        // next render sees server-canonical coords (not the optimistic ones).
        if (typeof updated.lat === 'number' && typeof updated.lng === 'number') {
          setLocation({
            lat: updated.lat, lng: updated.lng,
            address: updated.address ?? `${updated.lat.toFixed(4)}, ${updated.lng.toFixed(4)}`,
          });
        }
      }
      setLocationSaved(true);
      setTimeout(() => setLocationSaved(false), 3500);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      Alert.alert('Fehler', 'Netzwerkfehler beim Speichern.');
    } finally {
      setSavingLocation(false);
    }
  };

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
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{
      padding: space.lg, gap: space.md, paddingBottom: 60,
      paddingTop: Math.max(insets.top + space.sm, space['2xl']),
    }}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={16}
        style={{
          alignSelf: 'flex-start',
          paddingVertical: space.sm, paddingHorizontal: space.md,
          marginLeft: -space.md, marginBottom: space.xs,
        }}>
        <Text style={{ color: theme.primary, fontSize: typo.bodyL, fontWeight: '800' }}>← {i18n.t('common.back')}</Text>
      </TouchableOpacity>

      <View>
        <Text style={{ color: theme.primary, fontSize: typo.caption, fontWeight: '800', letterSpacing: 1.2 }}>
          {i18n.t('merchant.merchant_settings_title')}
        </Text>
        <Text style={{ color: theme.text, fontSize: typo.display, fontWeight: '900', letterSpacing: -0.6 }}>
          🏪 {merchant?.name ?? i18n.t('merchant.your_shop')}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: typo.small, marginTop: 4 }}>
          {merchant?.type ?? ''}
        </Text>
      </View>

      {/* Location section. Lets the merchant move the shop pin so cross-device
          demos work even when the two phones are in different cities. The
          Save button is always visible when a location is set — easier to
          discover than a conditional "only-when-different" reveal. */}
      <Section title={i18n.t('merchant.location_section')}>
        {/* autoFetchOnMount=false: the DB-loaded location is authoritative.
            Without this, GPS would race the async fetch and overwrite the
            saved shop pin every time the merchant opens settings. */}
        <LocationPicker value={location} onChange={setLocation} autoFetchOnMount={false} />
        {location && (
          <TouchableOpacity onPress={saveLocation} disabled={savingLocation}
            style={{
              backgroundColor: savingLocation ? theme.primaryWash : theme.primary,
              borderRadius: radius.md, paddingVertical: space.md,
              alignItems: 'center', marginTop: space.sm,
            }}>
            <Text style={{ color: theme.textOnPrimary, fontSize: typo.body, fontWeight: '900' }}>
              {savingLocation ? i18n.t('merchant.saving_location') : i18n.t('merchant.save_location')}
            </Text>
          </TouchableOpacity>
        )}
        {locationSaved && (
          <MotiView
            from={{ opacity: 0, translateY: -4 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 220 }}
            style={{
              backgroundColor: theme.success + '18',
              borderWidth: 1, borderColor: theme.success + '55',
              borderRadius: radius.md, paddingVertical: space.sm,
              paddingHorizontal: space.md, marginTop: space.sm,
              flexDirection: 'row', alignItems: 'center', gap: space.sm,
            }}
          >
            <Text style={{ fontSize: typo.bodyL }}>✅</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.success, fontSize: typo.body, fontWeight: '900' }}>
                {i18n.t('merchant.location_saved')}
              </Text>
              <Text style={{ color: theme.text, fontSize: typo.small, fontWeight: '700', marginTop: 2 }}>
                {merchant?.lat?.toFixed(4)}, {merchant?.lng?.toFixed(4)} · Cell {merchant?.geohash6 ?? ''}
              </Text>
            </View>
          </MotiView>
        )}
      </Section>

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
              Posten hinzufügen, scannen, Insights
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
        <Pressable onPress={() => router.push('/(merchant)/combos')}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: space.md,
            paddingVertical: space.sm,
          }}>
          <Text style={{ fontSize: typo.bodyL }}>🎁</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: typo.body, fontWeight: '700' }}>Combos verwalten</Text>
            <Text style={{ color: theme.textMuted, fontSize: typo.small }}>
              Bündele 2-4 Posten zu einem Festpreis
            </Text>
          </View>
          <Text style={{ color: theme.primary, fontSize: typo.bodyL }}>›</Text>
        </Pressable>
      </Section>

      {/* App-wide settings inlined here to avoid nested-modal glitches.
          (Pushing /settings — itself a modal — on top of this modal caused
          a re-presenting loop on some devices.) */}
      <Section title="APP · SPRACHE">
        <View style={{ alignItems: 'flex-start' }}>
          <LangToggle variant="dark" />
        </View>
        <Text style={{ color: theme.textMuted, fontSize: typo.small, marginTop: space.sm }}>
          Bestimmt die Sprache für Angebote, Beschreibungen und Hinweise.
        </Text>
      </Section>

      {/* Danger zone */}
      <Section title="GEFAHRENZONE">
        <Pressable
          onPress={() => Alert.alert(
            'Alle Angebote löschen?',
            'Das löscht ALLE Angebote dieses Geschäfts (gezeigt, akzeptiert, eingelöst). Statistik startet bei 0. Diese Aktion kann nicht rückgängig gemacht werden.',
            [
              { text: 'Abbrechen', style: 'cancel' },
              {
                text: 'Alle löschen',
                style: 'destructive',
                onPress: async () => {
                  if (!merchantId) return;
                  try {
                    const r = await fetch(`${API}/api/merchant/${merchantId}/offers`, { method: 'DELETE' });
                    if (r.ok) {
                      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      Alert.alert('Erledigt', 'Alle Angebote gelöscht.');
                    } else {
                      Alert.alert('Fehler', 'Konnte nicht löschen.');
                    }
                  } catch {
                    Alert.alert('Fehler', 'Netzwerkfehler.');
                  }
                },
              },
            ]
          )}
          style={{
            backgroundColor: theme.danger + '11', borderRadius: radius.md,
            paddingVertical: space.md, alignItems: 'center',
            borderWidth: 1, borderColor: theme.danger + '44',
          }}>
          <Text style={{ color: theme.danger, fontSize: typo.body, fontWeight: '900' }}>
            🗑  Alle Angebote löschen
          </Text>
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
