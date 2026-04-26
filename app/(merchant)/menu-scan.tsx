import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Pressable } from 'react-native';
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
  price_cents?: number | null;
  category?: string;
  tags?: string[];
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
      // Higher quality + jpeg lossless-ish pass for better OCR. The OCR
      // accuracy delta from 0.6 → 0.9 is meaningful; bandwidth cost is fine
      // because we're only doing this once per scan.
      const photo = await cameraRef.current.takePictureAsync({
        base64: true, quality: 0.9, skipProcessing: false,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setPhase({ kind: 'processing' });
      const dataUrl = `data:image/jpeg;base64,${photo.base64}`;
      // dry_run=true → server returns extracted items WITHOUT inserting.
      // The review screen then lets the merchant edit/delete each row before
      // committing via /menu/bulk. Dramatically reduces wrong-data pollution.
      const res = await fetch(`${API}/api/merchant/${merchantId}/menu/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_data_url: dataUrl, dry_run: true }),
      });
      const data = await res.json().catch(() => ({}));
      // 503 → all vision tiers failed (rate-limit / no key / no Ollama).
      // Surface the server's actual reason so the merchant knows what to fix.
      if (!res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setPhase({
          kind: 'error',
          message: data?.error
            ?? `OCR failed (HTTP ${res.status}). Check the server's MISTRAL_API_KEY or try better lighting.`,
        });
        return;
      }
      const items: ExtractedItem[] = data.items ?? [];
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase({ kind: 'review', items });
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setPhase({ kind: 'error', message: 'Could not reach the server. Check the tunnel URL in app.json.' });
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
          Camera access required
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 14, textAlign: 'center', maxWidth: 280, lineHeight: 20 }}>
          The AI reads your menu photo and extracts items.
        </Text>
        <TouchableOpacity onPress={requestPermission}
          style={{ backgroundColor: theme.primary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 }}>
          <Text style={{ color: theme.textOnPrimary, fontWeight: '800' }}>Allow access</Text>
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
          <Text style={{ color: theme.textOnPrimary, fontWeight: '800' }}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: theme.textMuted, fontSize: 13 }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Capture screen — camera occupies the top ~62% with a rounded bottom;
  // controls + tip live in a flat panel below so the capture button doesn't
  // float over the lens, and the layout fits Pro Max → mini without the
  // bracket guide overflowing the safe area.
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Camera viewport — fixed proportional height, rounded bottom corners */}
      <View style={{
        height: '62%',
        backgroundColor: '#000',
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        overflow: 'hidden',
      }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />

        {/* Top chrome — cancel + scope chip */}
        <View style={{
          position: 'absolute', top: insets.top + 8, left: 12, right: 12,
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}
            style={{ backgroundColor: '#00000088', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Cancel</Text>
          </TouchableOpacity>
          <View style={{ backgroundColor: theme.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: theme.textOnPrimary, fontWeight: '800', fontSize: 11, letterSpacing: 0.5 }}>
              MENU
            </Text>
          </View>
        </View>

        {/* Frame guide bracketing the menu — leaves headroom for the tip pill */}
        <View pointerEvents="none" style={{
          position: 'absolute', top: '14%', left: '6%', right: '6%', bottom: '14%',
        }}>
          <Corner pos="tl" />
          <Corner pos="tr" />
          <Corner pos="bl" />
          <Corner pos="br" />
        </View>

        {/* Tip pill — sits just under the top chrome */}
        <View pointerEvents="none" style={{
          position: 'absolute', top: insets.top + 56, left: 0, right: 0, alignItems: 'center',
        }}>
          <Text style={{
            color: '#fff', fontSize: 12, fontWeight: '700',
            backgroundColor: '#00000099', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
          }}>
            Hold the menu fully inside the frame
          </Text>
        </View>
      </View>

      {/* Bottom panel — capture button + helper copy */}
      <View style={{
        flex: 1,
        alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 24, paddingBottom: insets.bottom + 8,
        gap: 14,
      }}>
        <AnimatePresence>
          {phase.kind === 'processing' ? (
            <MotiView
              key="proc"
              from={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring' }}
            >
              <LlmStatusPill brand="Reading your menu" />
            </MotiView>
          ) : (
            <MotiView
              key="cap"
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring' }}
              style={{ alignItems: 'center', gap: 10 }}
            >
              <TouchableOpacity onPress={capture} disabled={phase.kind !== 'capture'}
                style={{
                  width: 72, height: 72, borderRadius: 36,
                  backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
                  borderWidth: 4, borderColor: theme.primary,
                  shadowColor: theme.primary, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
                }}>
                <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: theme.primary }} />
              </TouchableOpacity>
              <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '700', textAlign: 'center', maxWidth: 280 }}>
                Tap to scan · keep the menu flat and well-lit
              </Text>
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

// Mutable, editable review screen. Each row is fully editable in place
// (name + price), and individual rows can be deleted before commit. The
// merchant taps "✓ Speichern" to persist the cleaned-up list via /menu/bulk.
// This single review step removes the bulk of OCR-error pollution that
// previously landed straight in the menu_items table.
function ReviewScreen({ items: initial, onCaptureAgain, merchantId }: {
  items: ExtractedItem[]; onCaptureAgain: () => void; merchantId: string;
}) {
  const [items, setItems] = useState<ExtractedItem[]>(initial);
  const [saving, setSaving] = useState(false);

  const updateItem = (i: number, patch: Partial<ExtractedItem>) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  };
  const removeItem = (i: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setItems(prev => prev.filter((_, idx) => idx !== i));
  };
  const setPriceFromText = (i: number, txt: string) => {
    const norm = txt.trim().replace(',', '.');
    if (norm === '') { updateItem(i, { price_cents: null }); return; }
    const n = parseFloat(norm);
    if (!Number.isFinite(n) || n <= 0) return;
    updateItem(i, { price_cents: Math.round(n * 100) });
  };

  const save = async () => {
    if (items.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/merchant/${merchantId}/menu/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace({ pathname: '/(merchant)/menu', params: { id: merchantId } });
    } catch (e) {
      Alert.alert('Error', 'Menu could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  // Used in the per-card category chip group.
  const CATEGORIES = [
    { id: 'food', label: 'Food', emoji: '🍽️' },
    { id: 'drink', label: 'Drink', emoji: '🥤' },
    { id: 'dessert', label: 'Dessert', emoji: '🍰' },
    { id: 'special', label: 'Special', emoji: '✨' },
  ] as const;

  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View style={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: 12,
        gap: 4,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{
            backgroundColor: theme.primaryWash, borderRadius: 999,
            paddingHorizontal: 10, paddingVertical: 4,
            flexDirection: 'row', alignItems: 'center', gap: 4,
          }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.primary }} />
            <Text style={{ color: theme.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>
              REVIEW
            </Text>
          </View>
          <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '800' }}>
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
        <Text style={{ color: theme.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.4, marginTop: 6 }}>
          Check the menu before saving
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 13, lineHeight: 18, marginTop: 2 }}>
          Edit any field, drop wrong rows. Nothing is in your menu yet — only what you keep gets saved.
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {items.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 56, gap: 12 }}>
            <Text style={{ fontSize: 56 }}>🤷</Text>
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800' }}>Nothing detected</Text>
            <Text style={{ color: theme.textMuted, fontSize: 13, textAlign: 'center', maxWidth: 280, lineHeight: 18 }}>
              Try again with brighter light, less glare, and the full menu inside the frame.
            </Text>
          </View>
        ) : (
          items.map((it, i) => (
            <MotiView
              key={`row-${i}`}
              from={{ opacity: 0, translateY: 6 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 200, delay: Math.min(i * 25, 200) }}
              style={{
                backgroundColor: theme.surface,
                borderRadius: 18,
                padding: 16,
                gap: 14,
                borderWidth: 1, borderColor: theme.border,
                shadowColor: '#000', shadowOpacity: 0.04,
                shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
              }}
            >
              {/* Top row: index pill + name input + delete */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 26, height: 26, borderRadius: 13,
                  backgroundColor: theme.primaryWash,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '900' }}>
                    {i + 1}
                  </Text>
                </View>
                <TextInput
                  value={it.name}
                  onChangeText={(t) => updateItem(i, { name: t })}
                  placeholder="Item name"
                  placeholderTextColor={theme.textMuted}
                  style={{
                    flex: 1,
                    color: theme.text, fontSize: 17, fontWeight: '800',
                    paddingVertical: 4,
                  }}
                />
                <Pressable onPress={() => removeItem(i)} hitSlop={10}
                  style={{
                    width: 32, height: 32, borderRadius: 16,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: theme.danger + '14',
                  }}>
                  <Text style={{ color: theme.danger, fontSize: 14, fontWeight: '900' }}>✕</Text>
                </Pressable>
              </View>

              {/* Category chips — full row, wrap, much bigger touch targets */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {CATEGORIES.map(cat => {
                  const active = (it.category ?? 'food') === cat.id;
                  return (
                    <Pressable key={cat.id} onPress={() => updateItem(i, { category: cat.id })}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 5,
                        paddingHorizontal: 12, paddingVertical: 8,
                        borderRadius: 999,
                        backgroundColor: active ? theme.primary : theme.bg,
                        borderWidth: 1, borderColor: active ? theme.primary : theme.border,
                      }}>
                      <Text style={{ fontSize: 13 }}>{cat.emoji}</Text>
                      <Text style={{
                        color: active ? '#FFF' : theme.textMuted,
                        fontSize: 12, fontWeight: '800', letterSpacing: 0.2,
                      }}>
                        {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Price row — clear €, big right-aligned tabular input */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                backgroundColor: theme.bg, borderRadius: 12,
                paddingHorizontal: 12, paddingVertical: 8,
                borderWidth: 1, borderColor: theme.border,
              }}>
                <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>
                  PRICE
                </Text>
                <View style={{ flex: 1 }} />
                <TextInput
                  value={it.price_cents != null ? (it.price_cents / 100).toFixed(2) : ''}
                  onChangeText={(t) => setPriceFromText(i, t)}
                  placeholder="0.00"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="decimal-pad"
                  style={{
                    minWidth: 70, textAlign: 'right',
                    color: theme.primary, fontSize: 17, fontWeight: '900',
                    paddingVertical: 2,
                    fontVariant: ['tabular-nums'],
                  }}
                />
                <Text style={{ color: theme.primary, fontSize: 15, fontWeight: '900' }}>€</Text>
              </View>
            </MotiView>
          ))
        )}
      </ScrollView>

      {/* Sticky bottom bar */}
      <View style={{
        flexDirection: 'row', gap: 10,
        paddingHorizontal: 16, paddingTop: 12,
        paddingBottom: insets.bottom + 12,
        borderTopWidth: 1, borderColor: theme.border,
        backgroundColor: theme.bg,
      }}>
        <TouchableOpacity onPress={onCaptureAgain}
          style={{
            flex: 1, backgroundColor: theme.surface, borderRadius: 14,
            paddingVertical: 14, alignItems: 'center',
            borderWidth: 1, borderColor: theme.border,
          }}>
          <Text style={{ color: theme.primary, fontSize: 14, fontWeight: '800' }}>↻ Retake</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={save} disabled={saving || items.length === 0}
          style={{
            flex: 1.5,
            backgroundColor: (saving || items.length === 0) ? theme.primaryWash : theme.primary,
            borderRadius: 14, paddingVertical: 14, alignItems: 'center',
            shadowColor: theme.primary,
            shadowOpacity: (saving || items.length === 0) ? 0 : 0.3,
            shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
          }}>
          <Text style={{ color: theme.textOnPrimary, fontSize: 15, fontWeight: '900', letterSpacing: 0.2 }}>
            {saving ? 'Saving…' : `✓ Save ${items.length} ${items.length === 1 ? 'item' : 'items'}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
