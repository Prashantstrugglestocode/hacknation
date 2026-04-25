import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Dimensions, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { MotiView } from 'moti';
import Constants from 'expo-constants';
import { encodeGeohash6 } from '../../lib/context/geohash';
import { theme } from '../../lib/theme';

const API = Constants.expoConfig?.extra?.apiUrl as string;
const { width } = Dimensions.get('window');

interface Merchant {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  goal?: string;
  inventory_tags?: string[];
}

function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function typeEmoji(type: string): string {
  const k = type.toLowerCase();
  if (k.includes('café') || k.includes('cafe')) return '☕';
  if (k.includes('bakery') || k.includes('bäckerei')) return '🥐';
  if (k.includes('book')) return '📚';
  if (k.includes('rest')) return '🍽';
  if (k.includes('bar')) return '🍺';
  return '🏪';
}

export default function MapScreen() {
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLoading(false); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = loc.coords;
      setCenter({ lat, lng });
      const gh = encodeGeohash6(lat, lng);
      const res = await fetch(`${API}/api/merchants/nearby?geohash6=${gh}&radius_m=500`);
      if (res.ok) {
        const data = await res.json();
        const list: Merchant[] = Array.isArray(data) ? data : [];
        list.sort((a, b) => distanceM(lat, lng, a.lat, a.lng) - distanceM(lat, lng, b.lat, b.lng));
        setMerchants(list);
      }
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Build static OSM map URL with multiple red pins
  const mapUrl = (() => {
    if (!center) return null;
    const w = Math.round(width - 32);
    const h = 280;
    const markers = [
      `${center.lat},${center.lng},red-pushpin`,
      ...merchants.map(m => `${m.lat},${m.lng},red`),
    ].join('|');
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${center.lat},${center.lng}&zoom=15&size=${w}x${h}&markers=${markers}`;
  })();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>KARTE</Text>
          <Text style={{ color: theme.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>
            {merchants.length} in der Nähe
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text style={{ color: theme.primary, fontSize: 15, fontWeight: '700' }}>Schließen</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ height: 280, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : mapUrl ? (
        <View style={{
          borderRadius: 18, overflow: 'hidden',
          borderWidth: 1, borderColor: theme.border,
          shadowColor: theme.primary, shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
        }}>
          <Image
            source={{ uri: mapUrl }}
            style={{ width: '100%', height: 280 }}
            resizeMode="cover"
          />
        </View>
      ) : null}

      {merchants.length === 0 ? (
        <View style={{
          alignItems: 'center', padding: 28,
          backgroundColor: theme.bgMuted, borderRadius: 14,
          borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed',
        }}>
          <Text style={{ fontSize: 40 }}>🗺️</Text>
          <Text style={{ color: theme.text, fontWeight: '700', marginTop: 8 }}>Kein Geschäft in 500 m</Text>
          <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center', maxWidth: 280 }}>
            Werde Händler oder bewege dich in der Stadt — neue Angebote tauchen automatisch auf.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>GESCHÄFTE</Text>
          {merchants.map((m, i) => {
            const dist = center ? Math.round(distanceM(center.lat, center.lng, m.lat, m.lng)) : 0;
            return (
              <MotiView
                key={m.id}
                from={{ opacity: 0, translateY: 6 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 280, delay: i * 50 }}
              >
                <TouchableOpacity
                  onPress={() => router.replace('/(customer)/home')}
                  style={{
                    backgroundColor: theme.surface, borderRadius: 14, padding: 14,
                    borderWidth: 1, borderColor: theme.border,
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                  }}
                >
                  <View style={{
                    width: 44, height: 44, borderRadius: 12,
                    backgroundColor: theme.primaryWash,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 22 }}>{typeEmoji(m.type)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800' }} numberOfLines={1}>
                      {m.name}
                    </Text>
                    <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
                      {m.type} · {dist < 1000 ? `${dist} m` : `${(dist / 1000).toFixed(1).replace('.', ',')} km`}
                    </Text>
                  </View>
                  <Text style={{ color: theme.primary, fontSize: 18, fontWeight: '800' }}>›</Text>
                </TouchableOpacity>
              </MotiView>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
