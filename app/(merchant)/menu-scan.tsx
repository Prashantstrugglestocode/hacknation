import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { MotiView, AnimatePresence } from 'moti';
import LlmStatusPill from '../../lib/components/LlmStatusPill';
import { theme } from '../../lib/theme';

const API = Constants.expoConfig?.extra?.apiUrl as string;

interface ExtractedItem {
  name: string;
  price_cents?: number;
  category?: string;
}

type Phase =
  | { kind: 'capture' }
  | { kind: 'processing' }
  | { kind: 'review'; items: ExtractedItem[] }
  | { kind: 'error'; message: string };

export default function MenuScan() {
  const params = useLocalSearchParams<{ id: string }>();
  const merchantId = params.id;
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'capture' });
  const insets = useSafeAreaInsets();

  const capture = async () => {
    if (!cameraRef.current || phase.kind === 'processing') return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true, quality: 0.6, skipProcessing: false,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setPhase({ kind: 'processing' });
      const dataUrl = `data:image/jpeg;base64,${photo.base64}`;
      const res = await fetch(`${API}/api/merchant/${merchantId}/menu/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_data_url: dataUrl }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items: ExtractedItem[] = data.items ?? [];
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase({ kind: 'review', items });
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setPhase({ kind: 'error', message: 'Karte konnte nicht erkannt werden. Versuch noch mal mit besserem Licht.' });
    }
  };

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  }
  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
        <Text style={{ fontSize: 64 }}>📷</Text>
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800', textAlign: 'center' }}>
          Kamera-Zugriff gebraucht
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 14, textAlign: 'center', maxWidth: 280, lineHeight: 20 }}>
          Wir analysieren das Foto lokal mit KI und extrahieren Posten.
        </Text>
        <TouchableOpacity onPress={requestPermission}
          style={{ backgroundColor: theme.primary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 }}>
          <Text style={{ color: theme.textOnPrimary, fontWeight: '800' }}>Zugriff erlauben</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Review screen — fullscreen on top of black, no camera underneath
  if (phase.kind === 'review') {
    return <ReviewScreen items={phase.items} onCaptureAgain={() => setPhase({ kind: 'capture' })} merchantId={merchantId} />;
  }
  if (phase.kind === 'error') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        <Text style={{ fontSize: 56 }}>⚠️</Text>
        <Text style={{ color: theme.danger, fontSize: 16, textAlign: 'center', maxWidth: 300, fontWeight: '600' }}>
          {phase.message}
        </Text>
        <TouchableOpacity onPress={() => setPhase({ kind: 'capture' })}
          style={{ backgroundColor: theme.primary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 }}>
          <Text style={{ color: theme.textOnPrimary, fontWeight: '800' }}>Erneut versuchen</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: theme.textMuted, fontSize: 13 }}>Abbrechen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Capture screen
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />

      <View style={{
        position: 'absolute', top: insets.top + 8, left: 16, right: 16,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}
          style={{ backgroundColor: '#00000088', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Abbrechen</Text>
        </TouchableOpacity>
        <View style={{ backgroundColor: theme.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
          <Text style={{ color: theme.textOnPrimary, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 }}>
            SPEISEKARTE
          </Text>
        </View>
      </View>

      {/* Frame guide with corner brackets */}
      <View pointerEvents="none" style={{
        position: 'absolute', top: '20%', left: '8%', right: '8%', bottom: '25%',
      }}>
        <Corner pos="tl" />
        <Corner pos="tr" />
        <Corner pos="bl" />
        <Corner pos="br" />
      </View>
      <View pointerEvents="none" style={{
        position: 'absolute', top: '15%', left: 0, right: 0, alignItems: 'center',
      }}>
        <Text style={{
          color: '#fff', fontSize: 13, fontWeight: '700',
          backgroundColor: '#00000099', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
        }}>
          Karte vollständig im Rahmen
        </Text>
      </View>

      {/* Bottom: capture or processing pill */}
      <View style={{ position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center', gap: 14 }}>
        <AnimatePresence>
          {phase.kind === 'processing' ? (
            <MotiView
              key="proc"
              from={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring' }}
            >
              <LlmStatusPill brand="KI liest die Karte" />
            </MotiView>
          ) : (
            <MotiView
              key="cap"
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring' }}
            >
              <TouchableOpacity onPress={capture} disabled={phase.kind !== 'capture'}
                style={{
                  width: 80, height: 80, borderRadius: 40,
                  backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
                  borderWidth: 5, borderColor: theme.primary,
                  shadowColor: theme.primary, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
                }}>
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: theme.primary }} />
              </TouchableOpacity>
            </MotiView>
          )}
        </AnimatePresence>
      </View>
    </View>
  );
}

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base = { position: 'absolute' as const, width: 30, height: 30, borderColor: '#fff', borderWidth: 0 };
  const variants = {
    tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 },
    tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 },
    bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 },
    br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 18 },
  };
  return <View style={{ ...base, ...variants[pos] }} />;
}

function ReviewScreen({ items, onCaptureAgain, merchantId }: {
  items: ExtractedItem[]; onCaptureAgain: () => void; merchantId: string;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 12 }}>
        <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>
          ERKANNT · llava-7b
        </Text>
        <Text style={{ color: theme.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginTop: 2 }}>
          {items.length} {items.length === 1 ? 'Posten' : 'Posten'} erkannt
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
          Diese Posten wurden aus deinem Foto extrahiert. Du kannst sie jederzeit in der Speisekarte bearbeiten.
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 8 }}>
        {items.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 40, gap: 10 }}>
            <Text style={{ fontSize: 48 }}>🤷</Text>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>Nichts erkannt</Text>
            <Text style={{ color: theme.textMuted, fontSize: 13, textAlign: 'center', maxWidth: 280 }}>
              Versuch noch mal mit besserer Beleuchtung und voller Karte im Rahmen.
            </Text>
          </View>
        ) : (
          items.map((it, i) => (
            <MotiView
              key={i}
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 280, delay: i * 50 }}
              style={{
                backgroundColor: theme.surface, borderRadius: 14,
                padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
                borderWidth: 1, borderColor: theme.border,
              }}
            >
              <View style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: theme.primaryWash,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '900' }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
                  {it.name}
                </Text>
                {it.category ? (
                  <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                    {it.category}
                  </Text>
                ) : null}
              </View>
              {it.price_cents != null ? (
                <Text style={{ color: theme.primary, fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
                  {(it.price_cents / 100).toFixed(2).replace('.', ',')} €
                </Text>
              ) : null}
            </MotiView>
          ))
        )}
      </ScrollView>

      <View style={{
        flexDirection: 'row', gap: 10, padding: 16,
        borderTopWidth: 1, borderColor: theme.border, backgroundColor: theme.bg,
      }}>
        <TouchableOpacity onPress={onCaptureAgain}
          style={{
            flex: 1, backgroundColor: theme.surface, borderRadius: 14,
            paddingVertical: 14, alignItems: 'center',
            borderWidth: 1, borderColor: theme.border,
          }}>
          <Text style={{ color: theme.primary, fontSize: 14, fontWeight: '800' }}>↻ Noch ein Foto</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace({ pathname: '/(merchant)/menu', params: { id: merchantId } })}
          style={{
            flex: 1.4, backgroundColor: theme.primary, borderRadius: 14,
            paddingVertical: 14, alignItems: 'center',
            shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
          }}>
          <Text style={{ color: theme.textOnPrimary, fontSize: 14, fontWeight: '800' }}>Zur Speisekarte →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
