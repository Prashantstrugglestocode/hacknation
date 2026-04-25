import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { MotiView } from 'moti';
import WidgetRenderer from '../../lib/generative/renderer';
import { theme } from '../../lib/theme';

const API = Constants.expoConfig?.extra?.apiUrl as string;
const { height } = Dimensions.get('window');

export default function MerchantPreview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [spec, setSpec] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [iter, setIter] = useState(0);

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/merchant/${id}/preview`);
      const data = await res.json();
      setSpec(data.widget_spec);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.warn(e);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchPreview(); }, [fetchPreview, iter]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text style={{ color: theme.primary, fontSize: 15, fontWeight: '700' }}>← Zurück</Text>
        </TouchableOpacity>
        <View>
          <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textAlign: 'right' }}>VORSCHAU</Text>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 }}>So sehen Kunden dich</Text>
        </View>
      </View>

      <View style={{ flex: 1, minHeight: height * 0.62 }}>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <ActivityIndicator color={theme.primary} size="large" />
            <Text style={{ color: theme.textMuted, fontSize: 14, fontWeight: '600' }}>
              KI generiert ein Live-Beispiel…
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: 12 }}>
              gemma3:4b · max ~15 Sek.
            </Text>
          </View>
        ) : spec ? (
          <MotiView
            key={iter}
            from={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 16 }}
            style={{ flex: 1 }}
          >
            <WidgetRenderer
              spec={spec}
              onAccept={() => Haptics.selectionAsync()}
              onDecline={() => Haptics.selectionAsync()}
            />
          </MotiView>
        ) : null}
      </View>

      <TouchableOpacity
        onPress={() => setIter(i => i + 1)}
        disabled={loading}
        style={{
          backgroundColor: theme.primary, borderRadius: 16, paddingVertical: 16,
          alignItems: 'center', marginTop: 14,
          shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
        }}
      >
        <Text style={{ color: theme.textOnPrimary, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 }}>
          ↻ Anderes Beispiel generieren
        </Text>
      </TouchableOpacity>
      <Text style={{ color: theme.textMuted, fontSize: 11, textAlign: 'center', marginTop: 8 }}>
        Beispiel wird nicht gespeichert. Echte Angebote nur, wenn ein Kunde in der Nähe ist.
      </Text>
    </View>
  );
}
