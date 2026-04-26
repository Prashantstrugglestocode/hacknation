import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Slider from '@react-native-community/slider';
import { MotiView } from 'moti';
import LangToggle from '../lib/components/LangToggle';
import { forgetMe } from '../lib/privacy/intent-encoder';
import { usePrefs } from '../lib/preferences';
import { playChime } from '../lib/sounds';
import { theme, space, radius, type } from '../lib/theme';

interface Row {
  emoji: string;
  label: string;
  value: string;
}

const SOURCES: Row[] = [
  { emoji: '🌧', label: 'Wetterdaten', value: 'DWD Brightsky' },
  { emoji: '🗺', label: 'Standorte (POIs)', value: 'OpenStreetMap · Overpass' },
  { emoji: '🎫', label: 'Events', value: 'Ticketmaster Discovery' },
  { emoji: '💳', label: 'Transaktions-Dichte', value: 'Payone (simuliert)' },
  { emoji: '🤖', label: 'Angebots-KI', value: 'Ollama gemma3:4b lokal' },
  { emoji: '👁', label: 'Karten-Vision-KI', value: 'Ollama llava:7b lokal' },
];

export default function Settings() {
  const [forgotDone, setForgotDone] = useState(false);
  const { prefs, toggleSound, toggleHaptics, setRadius } = usePrefs();

  const handleForgetMe = async () => {
    await forgetMe();
    if (prefs.haptics) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setForgotDone(true);
    setTimeout(() => setForgotDone(false), 4000);
  };

  const handleToggleSound = async () => {
    await toggleSound();
    // Demo the new state immediately (only if just turned ON).
    if (!prefs.sound) playChime().catch(() => {});
  };

  const handleToggleHaptics = async () => {
    await toggleHaptics();
    if (!prefs.haptics) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space['4xl'] }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text style={{ color: theme.primary, fontSize: type.body, fontWeight: '700' }}>← Zurück</Text>
        </TouchableOpacity>

        <View>
          <Text style={{ color: theme.primary, fontSize: type.caption, fontWeight: '800', letterSpacing: 1.2 }}>
            EINSTELLUNGEN
          </Text>
          <Text style={{ color: theme.text, fontSize: type.display, fontWeight: '900', letterSpacing: -0.6 }}>
            ⚙️ App
          </Text>
        </View>

        {/* Language */}
        <Section title="SPRACHE">
          <View style={{ alignItems: 'flex-start' }}>
            <LangToggle variant="dark" />
          </View>
          <Text style={{ color: theme.textMuted, fontSize: type.small, marginTop: space.sm }}>
            Bestimmt die Sprache für KI-Angebote, Beschreibungen und Hinweise.
          </Text>
        </Section>

        {/* App-Verhalten */}
        <Section title="APP-VERHALTEN">
          <ToggleRow
            emoji="🔊"
            label="Sound bei Annahme"
            sub="Chime wenn ein Angebot angenommen oder QR gescannt wird"
            value={prefs.sound}
            onToggle={handleToggleSound}
          />
          <ToggleRow
            emoji="📳"
            label="Haptisches Feedback"
            sub="Vibration bei Tap und Erfolg"
            value={prefs.haptics}
            onToggle={handleToggleHaptics}
          />
          <View style={{ gap: 6, marginTop: space.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: theme.text, fontSize: type.body, fontWeight: '700' }}>
                🎯 Such-Radius
              </Text>
              <Text style={{ color: theme.primary, fontSize: type.body, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
                {prefs.radius_m < 1000 ? `${prefs.radius_m} m` : `${(prefs.radius_m / 1000).toFixed(1).replace('.', ',')} km`}
              </Text>
            </View>
            <Slider
              minimumValue={250}
              maximumValue={2000}
              step={250}
              value={prefs.radius_m}
              onValueChange={(v) => setRadius(v)}
              minimumTrackTintColor={theme.primary}
              maximumTrackTintColor={theme.border}
              thumbTintColor={theme.primary}
            />
            <Text style={{ color: theme.textMuted, fontSize: type.small }}>
              Wie weit die App nach Geschäften und Karte sucht.
            </Text>
          </View>
        </Section>

        {/* Privacy */}
        <Section title="DATENSCHUTZ">
          <Row
            emoji="📍"
            label="Standort-Genauigkeit"
            value="Geohash 6 (~1,2 km Zelle)"
          />
          <Row emoji="🆔" label="Geräte-Hash" value="Anonym, rotierbar" />
          <Row emoji="💾" label="Verlauf" value="Nur lokal gespeichert" />
          {forgotDone ? (
            <View style={{
              backgroundColor: theme.success + '22', borderRadius: radius.md, padding: space.md,
              alignItems: 'center', borderWidth: 1, borderColor: theme.success + '66', marginTop: space.sm,
            }}>
              <Text style={{ color: theme.success, fontSize: type.body, fontWeight: '800' }}>
                ✓ Verlauf gelöscht · Hash rotiert
              </Text>
            </View>
          ) : (
            <TouchableOpacity onPress={handleForgetMe}
              style={{
                backgroundColor: theme.danger + '11', borderRadius: radius.md,
                paddingVertical: space.md, alignItems: 'center', marginTop: space.sm,
                borderWidth: 1, borderColor: theme.danger + '44',
              }}>
              <Text style={{ color: theme.danger, fontSize: type.body, fontWeight: '800' }}>
                🗑  Vergiss mich (löscht Verlauf, rotiert Hash)
              </Text>
            </TouchableOpacity>
          )}
        </Section>

        {/* Datenquellen */}
        <Section title="ECHTE DATENQUELLEN">
          {SOURCES.map(s => (
            <Row key={s.label} emoji={s.emoji} label={s.label} value={s.value} />
          ))}
        </Section>

        {/* About */}
        <Section title="ÜBER">
          <Row emoji="🏷" label="Version" value="1.0.0 · Hackathon" />
          <Row emoji="🏛" label="Brief" value="DSV Gruppe / MIT Club" />
          <Row emoji="💳" label="Stack" value="Expo · Hono · Supabase · Ollama" />
        </Section>
      </ScrollView>
    </View>
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
      <Text style={{ color: theme.textMuted, fontSize: type.caption, fontWeight: '800', letterSpacing: 1, marginBottom: space.xs }}>
        {title}
      </Text>
      {children}
    </MotiView>
  );
}

function ToggleRow({
  emoji, label, sub, value, onToggle,
}: { emoji: string; label: string; sub?: string; value: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs }}
    >
      <View style={{
        width: 32, height: 32, borderRadius: radius.sm,
        backgroundColor: theme.bgMuted, alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: type.bodyL }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontSize: type.body, fontWeight: '700' }}>{label}</Text>
        {sub ? (
          <Text style={{ color: theme.textMuted, fontSize: type.small, marginTop: 1 }}>{sub}</Text>
        ) : null}
      </View>
      <View style={{
        width: 48, height: 28, borderRadius: 14,
        backgroundColor: value ? theme.primary : theme.border,
        padding: 3, justifyContent: 'center',
        alignItems: value ? 'flex-end' : 'flex-start',
      }}>
        <View style={{
          width: 22, height: 22, borderRadius: 11,
          backgroundColor: '#FFFFFF',
          shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
        }} />
      </View>
    </Pressable>
  );
}

function Row({ emoji, label, value }: Row) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{
        width: 32, height: 32, borderRadius: radius.sm,
        backgroundColor: theme.bgMuted,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: type.bodyL }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontSize: type.body, fontWeight: '700' }}>{label}</Text>
      </View>
      <Text style={{ color: theme.textMuted, fontSize: type.small, fontWeight: '700' }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
