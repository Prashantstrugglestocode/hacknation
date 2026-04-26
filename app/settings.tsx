import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Slider from '@react-native-community/slider';
import { MotiView } from 'moti';
import { forgetMe } from '../lib/privacy/intent-encoder';
import { usePrefs } from '../lib/preferences';
import { playChime } from '../lib/sounds';
import { speak } from '../lib/tts';
import i18n, { useLocaleVersion } from '../lib/i18n';
import { theme, space, radius, type } from '../lib/theme';

interface Row {
  emoji: string;
  label: string;
  value: string;
}

export default function Settings() {
  useLocaleVersion(); // re-render section labels when language flips
  const [forgotDone, setForgotDone] = useState(false);
  const { prefs, toggleSound, toggleHaptics, toggleTts, setRadius } = usePrefs();
  const insets = useSafeAreaInsets();

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

  const handleToggleTts = async () => {
    await toggleTts();
    // Demo the new state when turning ON.
    if (!prefs.tts) speak('Read-aloud is now active.', { force: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{
        padding: space.lg, gap: space.md, paddingBottom: space['4xl'],
        paddingTop: Math.max(insets.top + space.sm, space['2xl']),
      }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={16}
          style={{
            alignSelf: 'flex-start',
            paddingVertical: space.sm, paddingHorizontal: space.md,
            marginLeft: -space.md, marginBottom: space.xs,
          }}>
          <Text style={{ color: theme.primary, fontSize: type.bodyL, fontWeight: '800' }}>← {i18n.t('common.back')}</Text>
        </TouchableOpacity>

        <View>
          <Text style={{ color: theme.primary, fontSize: type.caption, fontWeight: '800', letterSpacing: 1.2 }}>
            {i18n.t('settings.title').toUpperCase()}
          </Text>
          <Text style={{ color: theme.text, fontSize: type.display, fontWeight: '900', letterSpacing: -0.6 }}>
            ⚙️ App
          </Text>
        </View>

        {/* App behavior — language toggle removed; English-only build. */}
        <Section title={i18n.t('settings.behavior').toUpperCase()}>
          <ToggleRow
            emoji="🔊"
            label={i18n.t('settings.sound_label')}
            sub={i18n.t('settings.sound_sub')}
            value={prefs.sound}
            onToggle={handleToggleSound}
          />
          <ToggleRow
            emoji="📳"
            label={i18n.t('settings.haptics_label')}
            sub={i18n.t('settings.haptics_sub')}
            value={prefs.haptics}
            onToggle={handleToggleHaptics}
          />
          <ToggleRow
            emoji="🗣"
            label="🗣  TTS"
            sub="Read headlines aloud (accessibility)"
            value={prefs.tts}
            onToggle={handleToggleTts}
          />
          <TouchableOpacity
            onPress={() => speak('Stadtpuls read-aloud is working. This is a test of the voice output.', { force: true })}
            style={{
              alignSelf: 'flex-start', marginTop: -space.xs,
              backgroundColor: theme.bgMuted, borderRadius: 10,
              paddingHorizontal: 12, paddingVertical: 6,
              borderWidth: 1, borderColor: theme.border,
            }}>
            <Text style={{ color: theme.primary, fontSize: type.small, fontWeight: '800' }}>
              ▶  Test Sprache
            </Text>
          </TouchableOpacity>
          <View style={{ gap: 6, marginTop: space.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: theme.text, fontSize: type.body, fontWeight: '700' }}>
                🎯 {i18n.t('settings.radius_label')}
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
              {i18n.t('settings.radius_sub')}
            </Text>
          </View>
        </Section>

        {/* GDPR transparency — what stays local vs what we send.
            Visible to anyone who taps Settings; no need to hunt through a
            policy doc. Built from i18n.t() so it flips with the language. */}
        <GdprSection />

        {/* Privacy — single user action */}
        <Section title={i18n.t('settings.privacy').toUpperCase()}>
          {forgotDone ? (
            <View style={{
              backgroundColor: theme.success + '22', borderRadius: radius.md, padding: space.md,
              alignItems: 'center', borderWidth: 1, borderColor: theme.success + '66',
            }}>
              <Text style={{ color: theme.success, fontSize: type.body, fontWeight: '800' }}>
                {i18n.t('settings.forget_me_done')}
              </Text>
            </View>
          ) : (
            <TouchableOpacity onPress={handleForgetMe}
              style={{
                backgroundColor: theme.danger + '11', borderRadius: radius.md,
                paddingVertical: space.md, alignItems: 'center',
                borderWidth: 1, borderColor: theme.danger + '44',
              }}>
              <Text style={{ color: theme.danger, fontSize: type.body, fontWeight: '800' }}>
                {i18n.t('settings.forget_me_button')}
              </Text>
            </TouchableOpacity>
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

// GDPR transparency: pipe-separated lists in i18n become real chip rows here.
// Two columns visualise the data-minimisation contract.
function GdprSection() {
  const local = i18n.t('settings.gdpr_local_items').split('|');
  const sent = i18n.t('settings.gdpr_sent_items').split('|');
  const principles = i18n.t('settings.gdpr_principles_items').split('|');
  return (
    <MotiView
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 280 }}
      style={{
        backgroundColor: theme.surface, borderRadius: radius.lg,
        padding: space.lg, gap: space.md,
        borderWidth: 1, borderColor: theme.border,
      }}
    >
      <View>
        <Text style={{ color: theme.primary, fontSize: type.caption, fontWeight: '900', letterSpacing: 1 }}>
          {i18n.t('settings.gdpr_title')}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: type.small, fontWeight: '700', marginTop: 2 }}>
          {i18n.t('settings.gdpr_subtitle')}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {/* On-device column */}
        <View style={{
          flex: 1, gap: 6,
          backgroundColor: theme.success + '0E',
          borderWidth: 1, borderColor: theme.success + '44',
          borderRadius: radius.md, padding: space.sm + 2,
        }}>
          <Text style={{ color: theme.success, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>
            🔒 {i18n.t('settings.gdpr_local_title').toUpperCase()}
          </Text>
          {local.map((item, i) => (
            <Text key={i} style={{ color: theme.text, fontSize: 11, fontWeight: '700', lineHeight: 15 }}>
              · {item.trim()}
            </Text>
          ))}
        </View>
        {/* Sent column */}
        <View style={{
          flex: 1, gap: 6,
          backgroundColor: theme.warn + '0E',
          borderWidth: 1, borderColor: theme.warn + '44',
          borderRadius: radius.md, padding: space.sm + 2,
        }}>
          <Text style={{ color: theme.warn, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>
            ☁️ {i18n.t('settings.gdpr_sent_title').toUpperCase()}
          </Text>
          {sent.map((item, i) => (
            <Text key={i} style={{ color: theme.text, fontSize: 11, fontWeight: '700', lineHeight: 15 }}>
              · {item.trim()}
            </Text>
          ))}
        </View>
      </View>

      <View style={{ gap: 4 }}>
        <Text style={{ color: theme.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }}>
          {i18n.t('settings.gdpr_principles_title').toUpperCase()}
        </Text>
        {principles.map((item, i) => (
          <Text key={i} style={{ color: theme.text, fontSize: 11, fontWeight: '700', lineHeight: 15 }}>
            ✓ {item.trim()}
          </Text>
        ))}
      </View>

      <Text style={{
        color: theme.textMuted, fontSize: 10, fontWeight: '700',
        textAlign: 'center', fontStyle: 'italic',
      }}>
        {i18n.t('settings.gdpr_legal')}
      </Text>
    </MotiView>
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
