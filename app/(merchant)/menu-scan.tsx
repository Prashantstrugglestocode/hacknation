import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { MotiView } from 'moti';
import { theme } from '../../lib/theme';

const API = Constants.expoConfig?.extra?.apiUrl as string;

export default function MenuScan() {
  const params = useLocalSearchParams<{ id: string }>();
  const merchantId = params.id;
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const [capturing, setCapturing] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const capture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.6, skipProcessing: true });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setExtracting(true);
      const dataUrl = `data:image/jpeg;base64,${photo.base64}`;
      const res = await fetch(`${API}/api/merchant/${merchantId}/menu/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_data_url: dataUrl }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const count = (data.items ?? []).length;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Erkannt', `${count} Menüposten extrahiert.`, [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Fehler', 'Karte konnte nicht erkannt werden. Versuche es erneut.');
    } finally {
      setCapturing(false);
      setExtracting(false);
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

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />

      {/* Top bar */}
      <View style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}
          style={{ backgroundColor: '#00000088', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Abbrechen</Text>
        </TouchableOpacity>
      </View>

      {/* Frame guide */}
      <View pointerEvents="none" style={{
        position: 'absolute', top: '20%', left: '8%', right: '8%', bottom: '25%',
        borderWidth: 2, borderColor: '#FFFFFFAA', borderRadius: 18,
        borderStyle: 'dashed',
      }} />
      <View pointerEvents="none" style={{
        position: 'absolute', top: '15%', left: 0, right: 0, alignItems: 'center',
      }}>
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', backgroundColor: '#00000088', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
          Karte vollständig im Rahmen
        </Text>
      </View>

      {/* Capture button */}
      <View style={{ position: 'absolute', bottom: insets.bottom + 20, left: 0, right: 0, alignItems: 'center' }}>
        {extracting ? (
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              backgroundColor: theme.primary, borderRadius: 18,
              paddingHorizontal: 24, paddingVertical: 18,
              flexDirection: 'row', alignItems: 'center', gap: 12,
            }}>
            <ActivityIndicator color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>KI liest die Karte…</Text>
          </MotiView>
        ) : (
          <TouchableOpacity onPress={capture} disabled={capturing}
            style={{
              width: 76, height: 76, borderRadius: 38,
              backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
              borderWidth: 4, borderColor: theme.primary,
            }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: theme.primary }} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
