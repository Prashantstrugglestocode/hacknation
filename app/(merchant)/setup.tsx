import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, Alert
} from 'react-native';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { encodeGeohash6 } from '../../lib/context/geohash';
import { getDeviceHash } from '../../lib/privacy/intent-encoder';
import { theme } from '../../lib/theme';
import { getLocale } from '../../lib/i18n';
import i18n from '../../lib/i18n';

const API = Constants.expoConfig?.extra?.apiUrl as string;

const TYPES = ['café', 'bakery', 'bookstore', 'restaurant', 'bar', 'retail', 'services', 'other'] as const;
const TIME_WINDOWS = ['lunch', 'afternoon', 'evening'] as const;

export default function MerchantSetup() {
  // Translations resolved per render so i18n is ready
  const GOALS = [
    { id: 'fill_quiet_hours' as const, label: i18n.t('merchant.goal_fill_quiet'), emoji: '☕', desc: 'Ruhige Stunden mit Angeboten füllen' },
    { id: 'move_slow_stock' as const, label: i18n.t('merchant.goal_move_stock'), emoji: '📦', desc: 'Produkte mit wenig Umsatz abverkaufen' },
    { id: 'build_loyalty' as const, label: i18n.t('merchant.goal_loyalty'), emoji: '❤️', desc: 'Stammkunden mit Rabatten belohnen' },
  ];

  const [name, setName] = useState('');
  const [type, setType] = useState<typeof TYPES[number]>('café');
  const [goal, setGoal] = useState<'fill_quiet_hours' | 'move_slow_stock' | 'build_loyalty'>('fill_quiet_hours');
  const [maxDiscount, setMaxDiscount] = useState(15);
  const [timeWindows, setTimeWindows] = useState<string[]>(['lunch']);
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggleWindow = (w: string) => {
    setTimeWindows(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w]);
  };

  const handleSubmit = async () => {
    if (!name.trim()) { Alert.alert('Name fehlt', 'Bitte gib den Namen deines Geschäfts ein.'); return; }
    setSubmitting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Standort benötigt', 'Wir brauchen deinen Standort, um Angebote zu generieren.'); setSubmitting(false); return; }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = loc.coords;
      const deviceHash = await getDeviceHash();

      const body = {
        owner_device_id: deviceHash,
        name: name.trim(),
        type,
        lat, lng,
        geohash6: encodeGeohash6(lat, lng),
        goal,
        max_discount_pct: maxDiscount,
        time_windows: timeWindows,
        inventory_tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        locale: getLocale(),
      };

      const res = await fetch(`${API}/api/merchant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Server error');
      const merchant = await res.json();
      await AsyncStorage.setItem('merchant_id', merchant.id);
      router.replace('/(merchant)/dashboard');
    } catch (e) {
      Alert.alert('Fehler', 'Geschäft konnte nicht gespeichert werden. Bitte erneut versuchen.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    backgroundColor: theme.surface, borderRadius: 14, padding: 16,
    color: theme.text, fontSize: 17,
    borderWidth: 1, borderColor: theme.border,
  } as const;

  const labelStyle = {
    color: theme.primary, fontSize: 12, fontWeight: '800' as const, letterSpacing: 1.2,
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 40 }}>
      <View>
        <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>EINRICHTUNG</Text>
        <Text style={{ color: theme.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>
          {i18n.t('merchant.setup_title')}
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={labelStyle}>NAME</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={i18n.t('merchant.name_placeholder')}
          placeholderTextColor={theme.textMuted}
          style={inputStyle}
        />
      </View>

      <View style={{ gap: 10 }}>
        <Text style={labelStyle}>{i18n.t('merchant.type_label').toUpperCase()}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TYPES.map(t => {
            const active = type === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => setType(t)}
                style={{
                  backgroundColor: active ? theme.primary : theme.surface,
                  borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9,
                  borderWidth: 1, borderColor: active ? theme.primary : theme.border,
                }}
              >
                <Text style={{ color: active ? theme.textOnPrimary : theme.text, fontWeight: active ? '800' : '600', fontSize: 14 }}>{t}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Text style={labelStyle}>{i18n.t('merchant.goal_label').toUpperCase()}</Text>
        {GOALS.map(g => {
          const active = goal === g.id;
          return (
            <TouchableOpacity
              key={g.id}
              onPress={() => setGoal(g.id)}
              style={{
                backgroundColor: active ? theme.primaryWash : theme.surface,
                borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14,
                borderWidth: 2, borderColor: active ? theme.primary : theme.border,
              }}
            >
              <Text style={{ fontSize: 28 }}>{g.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: active ? theme.primaryDark : theme.text, fontWeight: '800', fontSize: 15 }}>{g.label}</Text>
                <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>{g.desc}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ gap: 10 }}>
        <Text style={labelStyle}>
          {i18n.t('merchant.max_discount').toUpperCase()} — <Text style={{ color: theme.primary }}>{maxDiscount} %</Text>
        </Text>
        <Slider
          minimumValue={0}
          maximumValue={30}
          step={1}
          value={maxDiscount}
          onValueChange={setMaxDiscount}
          minimumTrackTintColor={theme.primary}
          maximumTrackTintColor={theme.border}
          thumbTintColor={theme.primary}
        />
      </View>

      <View style={{ gap: 10 }}>
        <Text style={labelStyle}>{i18n.t('merchant.time_windows').toUpperCase()}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {TIME_WINDOWS.map(w => {
            const active = timeWindows.includes(w);
            return (
              <TouchableOpacity
                key={w}
                onPress={() => toggleWindow(w)}
                style={{
                  backgroundColor: active ? theme.primary : theme.surface,
                  borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11,
                  borderWidth: 1, borderColor: active ? theme.primary : theme.border,
                }}
              >
                <Text style={{ color: active ? theme.textOnPrimary : theme.text, fontWeight: active ? '800' : '600' }}>
                  {i18n.t(`merchant.${w}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={labelStyle}>{i18n.t('merchant.inventory_tags').toUpperCase()}</Text>
        <TextInput
          value={tags}
          onChangeText={setTags}
          placeholder="coffee, sandwich, cake"
          placeholderTextColor={theme.textMuted}
          style={{ ...inputStyle, fontSize: 15 }}
        />
      </View>

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={submitting}
        style={{
          backgroundColor: submitting ? theme.primaryWash : theme.primary,
          borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 8,
          shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
        }}
      >
        <Text style={{ color: theme.textOnPrimary, fontSize: 17, fontWeight: '800', letterSpacing: 0.3 }}>
          {submitting ? 'Wird gespeichert…' : i18n.t('merchant.submit')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
