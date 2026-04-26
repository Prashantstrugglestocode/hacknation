import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Dimensions } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { MotiView } from 'moti';
import Constants from 'expo-constants';
import { encodeGeohash6 } from '../../lib/context/geohash';
import { ShimmerBlock } from '../../lib/components/Shimmer';
import { theme } from '../../lib/theme';

const API = Constants.expoConfig?.extra?.apiUrl as string;
const { width } = Dimensions.get('window');

interface Merchant {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
}

const Z = 15; // tile zoom — z=15 covers ~1.2km, fits a 500m search radius
const TILE_HEIGHT = 280;

function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function tileWorld(lat: number, lng: number, z: number) {
  const latRad = (lat * Math.PI) / 180;
  const n = Math.pow(2, z);
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  };
}

function typeEmoji(type: string): string {
  const k = (type ?? '').toLowerCase();
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
  const [tileState, setTileState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [tileNonce, setTileNonce] = useState(0);

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

  // Compute the centered tile + everyone's fractional position inside it.
  const mapData = (() => {
    if (!center) return null;
    const cw = tileWorld(center.lat, center.lng, Z);
    const tx = Math.floor(cw.x);
    const ty = Math.floor(cw.y);
    const tileUrl = `https://tile.openstreetmap.org/${Z}/${tx}/${ty}.png`;
    const userPin = { fracX: cw.x - tx, fracY: cw.y - ty };
    const merchantPins = merchants.map(m => {
      const w = tileWorld(m.lat, m.lng, Z);
      return {
        merchant: m,
        fracX: w.x - tx,
        fracY: w.y - ty,
        // visible only if it falls within this tile
        inTile: (w.x - tx) >= 0 && (w.x - tx) <= 1 && (w.y - ty) >= 0 && (w.y - ty) <= 1,
      };
    });
    return { tileUrl, userPin, merchantPins };
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

      {/* Map preview block — always reserves space; shows shimmer while loading */}
      <View style={{
        height: TILE_HEIGHT,
        borderRadius: 18, overflow: 'hidden',
        borderWidth: 1, borderColor: theme.border,
        backgroundColor: theme.bgMuted,
        position: 'relative',
        shadowColor: theme.primary, shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
      }}>
        <ShimmerBlock height={TILE_HEIGHT} style={{ borderRadius: 0 }} />

        {mapData && tileState !== 'error' && (
          <Image
            key={tileNonce}
            source={{ uri: mapData.tileUrl }}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              opacity: tileState === 'loaded' ? 1 : 0,
            }}
            resizeMode="cover"
            onLoadStart={() => setTileState('loading')}
            onLoad={() => setTileState('loaded')}
            onError={() => setTileState('error')}
          />
        )}

        {(!loading && !center) && (
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16,
          }}>
            <Text style={{ fontSize: 28 }}>📍</Text>
            <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>
              Standort nicht freigegeben
            </Text>
          </View>
        )}

        {tileState === 'error' && (
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            alignItems: 'center', justifyContent: 'center', gap: 8,
            backgroundColor: theme.bgMuted,
          }}>
            <Text style={{ fontSize: 28 }}>🗺</Text>
            <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>
              Karte konnte nicht geladen werden
            </Text>
            <TouchableOpacity onPress={() => { setTileState('loading'); setTileNonce(n => n + 1); }}
              style={{
                backgroundColor: theme.primary, borderRadius: 10,
                paddingHorizontal: 14, paddingVertical: 7,
              }}>
              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>↻ Erneut versuchen</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* User pin (blue) */}
        {tileState === 'loaded' && mapData && (
          <MotiView
            from={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 14 }}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: `${mapData.userPin.fracX * 100}%`,
              top: `${mapData.userPin.fracY * 100}%`,
              marginLeft: -10, marginTop: -10,
            }}>
            <View style={{
              width: 20, height: 20, borderRadius: 10,
              backgroundColor: '#2563EB',
              borderWidth: 3, borderColor: '#FFF',
              shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
            }} />
          </MotiView>
        )}

        {/* Merchant pins (red) — only those that fall inside the visible tile */}
        {tileState === 'loaded' && mapData && mapData.merchantPins.filter(p => p.inTile).map((p, i) => {
          const PIN = 28;
          return (
            <MotiView
              key={p.merchant.id}
              from={{ scale: 0, translateY: -6, opacity: 0 }}
              animate={{ scale: 1, translateY: 0, opacity: 1 }}
              transition={{ type: 'spring', delay: 80 + i * 60, damping: 12 }}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: `${p.fracX * 100}%`,
                top: `${p.fracY * 100}%`,
                marginLeft: -PIN / 2, marginTop: -PIN * 0.85,
                shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 3 },
              }}>
              <Text style={{ fontSize: PIN }}>📍</Text>
            </MotiView>
          );
        })}

        {tileState === 'loaded' && (
          <View style={{
            position: 'absolute', bottom: 6, right: 8,
            backgroundColor: '#FFFFFFCC', borderRadius: 6,
            paddingHorizontal: 6, paddingVertical: 2,
          }}>
            <Text style={{ color: '#1F1F23', fontSize: 9, fontWeight: '700' }}>
              © OpenStreetMap
            </Text>
          </View>
        )}
      </View>

      {merchants.length === 0 && !loading ? (
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
          <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
            GESCHÄFTE
          </Text>
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
