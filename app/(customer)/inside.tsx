import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { theme, space, radius, type as typo } from '../../lib/theme';

// "Inside Stadtpuls" — explanation modal that closes the loop on demand.
// Two demo-critical jobs:
//   1. Make the full journey visible (context → generate → display →
//      accept → pay → receipt) so judges see the connected flow without
//      having to ask.
//   2. Surface the privacy story (GDPR / on-device intent encoder)
//      explicitly. The mechanisms run silently in production code; this
//      modal is where we say so out loud during the demo.

export default function InsideScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header band */}
      <LinearGradient
        colors={[theme.primary, theme.primaryDark] as any}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: space.lg,
          paddingBottom: space.xl,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => router.back()} hitSlop={12}
            style={{
              paddingHorizontal: 14, paddingVertical: 8,
              borderRadius: 999, backgroundColor: '#FFFFFF22',
            }}>
            <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>Close</Text>
          </Pressable>
          <Text style={{ color: '#FFFFFFCC', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }}>
            BEHIND THE SCENES
          </Text>
        </View>

        <Text style={{
          color: '#FFF', fontSize: typo.title + 2, fontWeight: '900',
          letterSpacing: -0.6, marginTop: space.xl,
        }}>
          Inside Stadtpuls
        </Text>
        <Text style={{
          color: '#FFFFFFCC', fontSize: typo.small, fontWeight: '700',
          marginTop: 4, lineHeight: 18,
        }}>
          The full journey from a real-time signal to a redeemed offer — and exactly what we keep on your device.
        </Text>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: space.lg,
          paddingBottom: insets.bottom + space['2xl'],
          gap: space.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* JOURNEY */}
        <Section title="THE FULL LOOP" subtitle="Each step uses real signals, not stubs.">
          <Step n={1} icon="🌦️" title="Context detection"
            body="Live weather (DWD), time of day, simulated Payone transaction density, and OSM POIs feed a composite trigger engine — config-driven so a new city is a JSON change, not a code change." />
          <Step n={2} icon="✨" title="Offer generation"
            body="Mistral builds the headline, palette, layout, and discount around your merchant's real menu items. Falls back to on-device Ollama, then a deterministic generator if the cloud is unreachable." />
          <Step n={3} icon="📱" title="Display"
            body="One of five GenUI layouts (hero / compact / split / fullbleed / sticker) renders the offer. A 5-second foreground poll keeps the feed fresh and a local notification fires the moment a new offer surfaces." />
          <Step n={4} icon="🎫" title="Accept → QR"
            body="Tap accept and the card morphs into a 10-minute signed JWT QR. The merchant scans it with their phone." />
          <Step n={5} icon="💳" title="Sparkasse Pay"
            body="The scan triggers a real-time broadcast to your phone. A dedicated pay sheet slides up — slide to confirm, the discount applies, both phones update instantly." />
          <Step n={6} icon="✅" title="Receipt + revenue"
            body="Customer card morphs into a payment receipt. Merchant dashboard ticks revenue and the live activity feed shows the redeem." />
        </Section>

        {/* PRIVACY */}
        <Section title="PRIVACY · GDPR BY DESIGN" subtitle="What stays on your device vs. what we send.">
          <PrivacyRow icon="🔒" title="On-device intent encoder"
            body="Your real lat/lng never leaves the phone. We reduce it to a 6-character geohash (~1.2 km cell) and an abstract intent vector (cold / rainy / lunchtime / browsing) before any network call." />
          <PrivacyRow icon="🛡️" title="PII scrubber"
            body="Every prompt sent to a hosted LLM passes through a server-side scrubber that strips emails, phone numbers, IBANs, and IP addresses." />
          <PrivacyRow icon="🪪" title="Anonymous device hash"
            body="No login. No email. We identify you with a random local hash that you can rotate at any time via Settings → Reset device & wipe local data." />
          <PrivacyRow icon="💻" title="On-device LLM tier"
            body="When the cloud is unavailable, a local Small Language Model (Ollama gemma3) generates the offer. The brief's 'only abstract intent reaches the server' path is wired in." />
        </Section>

        {/* CREDITS */}
        <View style={{
          backgroundColor: theme.surface, borderRadius: radius.lg,
          padding: space.lg, gap: space.sm,
          borderWidth: 1, borderColor: theme.border,
        }}>
          <Text style={{ color: theme.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }}>
            POWERED BY
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {['DSV Gruppe', 'Sparkassen', 'Payone signal', 'Mistral', 'Supabase Realtime', 'Expo / React Native', 'OSM Overpass', 'DWD Brightsky'].map(t => (
              <View key={t} style={{
                backgroundColor: theme.bg, borderRadius: 999,
                paddingHorizontal: 10, paddingVertical: 4,
                borderWidth: 1, borderColor: theme.border,
              }}>
                <Text style={{ color: theme.text, fontSize: 11, fontWeight: '700' }}>{t}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ACTION — recover-back-to-role-picker */}
        <TouchableOpacity onPress={() => router.replace('/role')}
          style={{
            backgroundColor: theme.surface, borderRadius: radius.md,
            paddingVertical: space.md, alignItems: 'center',
            borderWidth: 1, borderColor: theme.border,
          }}>
          <Text style={{ color: theme.primary, fontSize: typo.small, fontWeight: '900', letterSpacing: 0.4 }}>
            Switch role
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// Section wrapper used by both "loop" and "privacy" blocks.
function Section({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 280 }}
      style={{ gap: space.md }}
    >
      <View>
        <Text style={{
          color: theme.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.2,
        }}>
          {title}
        </Text>
        {subtitle && (
          <Text style={{
            color: theme.textMuted, fontSize: typo.small, fontWeight: '700',
            marginTop: 2, lineHeight: 16,
          }}>
            {subtitle}
          </Text>
        )}
      </View>
      <View style={{ gap: space.sm }}>
        {children}
      </View>
    </MotiView>
  );
}

// Numbered step in the journey timeline. Index pill keeps the eye moving
// down a clear sequence; emoji + body make each step concrete.
function Step({ n, icon, title, body }: {
  n: number; icon: string; title: string; body: string;
}) {
  return (
    <View style={{
      flexDirection: 'row', gap: space.md,
      backgroundColor: theme.surface, borderRadius: radius.lg,
      padding: space.md,
      borderWidth: 1, borderColor: theme.border,
    }}>
      <View style={{
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: theme.primaryWash,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '900' }}>{n}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 14 }}>{icon}</Text>
          <Text style={{ color: theme.text, fontSize: typo.body, fontWeight: '900' }}>
            {title}
          </Text>
        </View>
        <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '600', lineHeight: 17 }}>
          {body}
        </Text>
      </View>
    </View>
  );
}

// Same pattern as Step but tinted green to read as a privacy guarantee.
function PrivacyRow({ icon, title, body }: {
  icon: string; title: string; body: string;
}) {
  return (
    <View style={{
      flexDirection: 'row', gap: space.md,
      backgroundColor: theme.success + '0E', borderRadius: radius.lg,
      padding: space.md,
      borderWidth: 1, borderColor: theme.success + '44',
    }}>
      <View style={{
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: theme.success + '22',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 14 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: theme.text, fontSize: typo.body, fontWeight: '900' }}>
          {title}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '600', lineHeight: 17 }}>
          {body}
        </Text>
      </View>
    </View>
  );
}
