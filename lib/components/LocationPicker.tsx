import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { MotiView } from 'moti';
import { theme } from '../theme';

export interface PickedLocation {
  lat: number;
  lng: number;
  address: string;
}

interface Props {
  value: PickedLocation | null;
  onChange: (loc: PickedLocation) => void;
}

// Slippy-tile coords for the OSM tile-server (much more reliable than the
// staticmap.openstreetmap.de service which is intermittently down).
// Returns integer tile coords + fractional offset so the pin lands on the
// actual lat/lng instead of the tile center.
function tileCoords(lat: number, lng: number, z: number) {
  const latRad = (lat * Math.PI) / 180;
  const n = Math.pow(2, z);
  const worldX = ((lng + 180) / 360) * n;
  const worldY = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const x = Math.floor(worldX);
  const y = Math.floor(worldY);
  return { x, y, fracX: worldX - x, fracY: worldY - y };
}

function osmTileUrl(lat: number, lng: number, z = 16): string {
  const { x, y } = tileCoords(lat, lng, z);
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const r = results[0];
    if (!r) return '';
    const parts = [
      [r.street, r.streetNumber].filter(Boolean).join(' '),
      [r.postalCode, r.city].filter(Boolean).join(' '),
    ].filter(Boolean);
    return parts.join(', ');
  } catch { return ''; }
}

async function forwardGeocode(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const results = await Location.geocodeAsync(address);
    const r = results[0];
    if (!r) return null;
    return { lat: r.latitude, lng: r.longitude };
  } catch { return null; }
}

export default function LocationPicker({ value, onChange }: Props) {
  const [addressDraft, setAddressDraft] = useState(value?.address ?? '');
  const [loadingGps, setLoadingGps] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useGps = useCallback(async () => {
    setLoadingGps(true); setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Standortzugriff abgelehnt. Adresse manuell eingeben.');
        setLoadingGps(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = loc.coords;
      const address = await reverseGeocode(lat, lng);
      const result = { lat, lng, address };
      onChange(result);
      setAddressDraft(address);
    } catch (e) {
      setError('Standort konnte nicht ermittelt werden.');
    } finally { setLoadingGps(false); }
  }, [onChange]);

  // Auto-fill on mount if no value yet
  useEffect(() => {
    if (!value) useGps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyAddress = async () => {
    const text = addressDraft.trim();
    if (!text) return;
    setSearching(true); setError(null);
    const coords = await forwardGeocode(text);
    setSearching(false);
    if (!coords) {
      setError('Adresse nicht gefunden. Versuch eine andere Schreibweise.');
      return;
    }
    const verifiedAddress = await reverseGeocode(coords.lat, coords.lng);
    onChange({ lat: coords.lat, lng: coords.lng, address: verifiedAddress || text });
    setAddressDraft(verifiedAddress || text);
  };

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 }}>
        STANDORT
      </Text>

      {/* Map preview — single OSM tile at z=16, pin offset to actual lat/lng */}
      {value && (() => {
        const { fracX, fracY } = tileCoords(value.lat, value.lng, 16);
        const PIN_FONT = 36;
        // Anchor: the tip of 📍 sits roughly at horizontal center, ~80% down.
        // Translate the pin element so its tip lands on the fractional point.
        return (
          <MotiView
            key={`${value.lat}-${value.lng}`}
            from={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 350 }}
            style={{
              borderRadius: 14, overflow: 'hidden',
              borderWidth: 1, borderColor: theme.border,
              backgroundColor: theme.bgMuted,
              position: 'relative',
            }}
          >
            <Image
              source={{ uri: osmTileUrl(value.lat, value.lng, 16) }}
              style={{ width: '100%', height: 180 }}
              resizeMode="cover"
            />
            <View pointerEvents="none" style={{
              position: 'absolute',
              left: `${fracX * 100}%`,
              top: `${fracY * 100}%`,
              marginLeft: -PIN_FONT / 2,
              marginTop: -PIN_FONT * 0.8,
              shadowColor: '#000', shadowOpacity: 0.4,
              shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
            }}>
              <Text style={{ fontSize: PIN_FONT }}>📍</Text>
            </View>
            <View style={{
              position: 'absolute', bottom: 6, right: 8,
              backgroundColor: '#FFFFFFCC', borderRadius: 6,
              paddingHorizontal: 6, paddingVertical: 2,
            }}>
              <Text style={{ color: '#1F1F23', fontSize: 9, fontWeight: '700' }}>
                © OpenStreetMap
              </Text>
            </View>
          </MotiView>
        );
      })()}

      {/* Address input */}
      <View style={{
        backgroundColor: theme.surface, borderRadius: 14,
        borderWidth: 1, borderColor: theme.border,
        flexDirection: 'row', alignItems: 'center',
      }}>
        <Text style={{ paddingLeft: 14, fontSize: 18 }}>📍</Text>
        <TextInput
          value={addressDraft}
          onChangeText={setAddressDraft}
          onSubmitEditing={applyAddress}
          placeholder="Hauptstraße 1, 70173 Stuttgart"
          placeholderTextColor={theme.textMuted}
          style={{
            flex: 1, color: theme.text, fontSize: 15,
            paddingHorizontal: 12, paddingVertical: 14,
          }}
          returnKeyType="search"
          autoCorrect={false}
        />
        {addressDraft && addressDraft !== value?.address ? (
          <TouchableOpacity onPress={applyAddress} disabled={searching}
            style={{
              backgroundColor: theme.primary,
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginRight: 6,
            }}>
            {searching
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ color: theme.textOnPrimary, fontSize: 12, fontWeight: '800' }}>Suchen</Text>}
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity onPress={useGps} disabled={loadingGps} hitSlop={8}>
          {loadingGps ? (
            <ActivityIndicator color={theme.primary} size="small" />
          ) : (
            <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '700' }}>
              ⟳ Mein Standort verwenden
            </Text>
          )}
        </TouchableOpacity>
        {value && (
          <Text style={{ color: theme.textMuted, fontSize: 11, fontVariant: ['tabular-nums'] }}>
            {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
          </Text>
        )}
      </View>

      {error ? (
        <View style={{
          backgroundColor: theme.danger + '11', padding: 10, borderRadius: 10,
          borderWidth: 1, borderColor: theme.danger + '44',
        }}>
          <Text style={{ color: theme.danger, fontSize: 12, fontWeight: '700' }}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}
