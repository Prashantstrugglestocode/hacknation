import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { theme } from '../../lib/theme';
import i18n from '../../lib/i18n';

const API = Constants.expoConfig?.extra?.apiUrl as string;
const { width } = Dimensions.get('window');

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<{ success: boolean; offer?: any; error?: string } | null>(null);
  const scanLock = useRef(false);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanLock.current || scanned) return;
    scanLock.current = true;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setScanned(true);

    try {
      // Extract offer ID from token (JWT sub claim or parse URL)
      // Token is JWT — we send it to redeem-qr
      // We need the offer_id — extract from the scanned data which might be "offerId|token"
      const parts = data.split('|');
      const offerId = parts[0];
      const token = parts[1] ?? data;

      const res = await fetch(`${API}/api/offer/${offerId}/redeem-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (res.ok) {
        const offer = await res.json();
        setResult({ success: true, offer });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        const err = await res.json().catch(() => ({}));
        setResult({ success: false, error: err.error ?? i18n.t('errors.invalid_qr') });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      setResult({ success: false, error: i18n.t('errors.redemption_failed') });
    }
  };

  if (!permission) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <Text style={{ fontSize: 56 }}>📷</Text>
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800', textAlign: 'center' }}>
          Kamerazugriff benötigt zum QR-Scannen.
        </Text>
        <TouchableOpacity onPress={requestPermission} style={{
          backgroundColor: theme.primary, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14,
          shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
        }}>
          <Text style={{ color: theme.textOnPrimary, fontWeight: '800', fontSize: 16 }}>Kamera freigeben</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (result) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', gap: 24, paddingHorizontal: 32 }}>
        <MotiView
          from={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring' }}
          style={{ alignItems: 'center', gap: 20 }}
        >
          <Text style={{ fontSize: 72 }}>{result.success ? '✅' : '❌'}</Text>
          {result.success ? (
            <>
              <Text style={{ color: theme.text, fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: -0.4 }}>
                {i18n.t('merchant.scan_success')}
              </Text>
              {result.offer?.discount_amount_cents && (
                <Text style={{ color: theme.success, fontSize: 20, fontWeight: '800' }}>
                  {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
                    .format(result.offer.discount_amount_cents / 100)} Rabatt
                </Text>
              )}
            </>
          ) : (
            <Text style={{ color: theme.danger, fontSize: 18, textAlign: 'center' }}>{result.error}</Text>
          )}
        </MotiView>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ backgroundColor: theme.primary, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 }}
        >
          <Text style={{ color: theme.textOnPrimary, fontWeight: '800', fontSize: 16 }}>Zurück</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />
      {/* Scan overlay — positioned outside CameraView to avoid children warning */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{
          width: 240, height: 240, borderRadius: 20,
          borderWidth: 3, borderColor: theme.primary,
          backgroundColor: 'transparent',
        }} />
        <Text style={{ color: '#fff', marginTop: 24, fontSize: 15, fontWeight: '600' }}>
          QR-Code des Kunden scannen
        </Text>
      </View>
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ alignItems: 'center' }}>
          <Text style={{ color: '#ffffff88', fontSize: 15 }}>Abbrechen</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
