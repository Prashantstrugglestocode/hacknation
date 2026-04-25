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
import { getLocale } from '../../lib/i18n';
import i18n from '../../lib/i18n';

const API = Constants.expoConfig?.extra?.apiUrl as string;

const TYPES = ['café', 'bakery', 'bookstore', 'restaurant', 'bar', 'retail', 'services', 'other'] as const;
const TIME_WINDOWS = ['lunch', 'afternoon', 'evening'] as const;
const GOALS = [
  { id: 'fill_quiet_hours', label: i18n.t('merchant.goal_fill_quiet'), emoji: '☕', desc: 'Ruhige Stunden mit Angeboten füllen' },
  { id: 'move_slow_stock', label: i18n.t('merchant.goal_move_stock'), emoji: '📦', desc: 'Produkte mit wenig Umsatz abverkaufen' },
  { id: 'build_loyalty', label: i18n.t('merchant.goal_loyalty'), emoji: '❤️', desc: 'Stammkunden mit Rabatten belohnen' },
] as const;

export default function MerchantSetup() {
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

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#0A0A0F' }} contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 40 }}>
      <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 8 }}>
        {i18n.t('merchant.setup_title')}
      </Text>

      {/* Name */}
      <View style={{ gap: 8 }}>
        <Text style={{ color: '#ffffff99', fontSize: 13, fontWeight: '600', letterSpacing: 1 }}>NAME</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={i18n.t('merchant.name_placeholder')}
          placeholderTextColor="#ffffff33"
          style={{
            backgroundColor: '#1A1A2E', borderRadius: 14, padding: 16,
            color: '#fff', fontSize: 17, borderWidth: 1, borderColor: '#ffffff11'
          }}
        />
      </View>

      {/* Type chips */}
      <View style={{ gap: 10 }}>
        <Text style={{ color: '#ffffff99', fontSize: 13, fontWeight: '600', letterSpacing: 1 }}>
          {i18n.t('merchant.type_label').toUpperCase()}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TYPES.map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setType(t)}
              style={{
                backgroundColor: type === t ? '#6C63FF' : '#1A1A2E',
                borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8,
                borderWidth: 1, borderColor: type === t ? '#6C63FF' : '#ffffff11'
              }}
            >
              <Text style={{ color: '#fff', fontWeight: type === t ? '700' : '400', fontSize: 14 }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Goal cards */}
      <View style={{ gap: 10 }}>
        <Text style={{ color: '#ffffff99', fontSize: 13, fontWeight: '600', letterSpacing: 1 }}>
          {i18n.t('merchant.goal_label').toUpperCase()}
        </Text>
        {GOALS.map(g => (
          <TouchableOpacity
            key={g.id}
            onPress={() => setGoal(g.id)}
            style={{
              backgroundColor: goal === g.id ? '#6C63FF22' : '#1A1A2E',
              borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14,
              borderWidth: 2, borderColor: goal === g.id ? '#6C63FF' : 'transparent'
            }}
          >
            <Text style={{ fontSize: 28 }}>{g.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{g.label}</Text>
              <Text style={{ color: '#ffffff66', fontSize: 12, marginTop: 2 }}>{g.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Max discount slider */}
      <View style={{ gap: 10 }}>
        <Text style={{ color: '#ffffff99', fontSize: 13, fontWeight: '600', letterSpacing: 1 }}>
          {i18n.t('merchant.max_discount').toUpperCase()} — {maxDiscount} %
        </Text>
        <Slider
          minimumValue={0}
          maximumValue={30}
          step={1}
          value={maxDiscount}
          onValueChange={setMaxDiscount}
          minimumTrackTintColor="#6C63FF"
          maximumTrackTintColor="#1A1A2E"
          thumbTintColor="#6C63FF"
        />
      </View>

      {/* Time windows */}
      <View style={{ gap: 10 }}>
        <Text style={{ color: '#ffffff99', fontSize: 13, fontWeight: '600', letterSpacing: 1 }}>
          {i18n.t('merchant.time_windows').toUpperCase()}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {TIME_WINDOWS.map(w => (
            <TouchableOpacity
              key={w}
              onPress={() => toggleWindow(w)}
              style={{
                backgroundColor: timeWindows.includes(w) ? '#6C63FF' : '#1A1A2E',
                borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
                borderWidth: 1, borderColor: timeWindows.includes(w) ? '#6C63FF' : '#ffffff11'
              }}
            >
              <Text style={{ color: '#fff', fontWeight: timeWindows.includes(w) ? '700' : '400' }}>
                {i18n.t(`merchant.${w}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Inventory tags */}
      <View style={{ gap: 8 }}>
        <Text style={{ color: '#ffffff99', fontSize: 13, fontWeight: '600', letterSpacing: 1 }}>
          {i18n.t('merchant.inventory_tags').toUpperCase()}
        </Text>
        <TextInput
          value={tags}
          onChangeText={setTags}
          placeholder="coffee, sandwich, cake"
          placeholderTextColor="#ffffff33"
          style={{
            backgroundColor: '#1A1A2E', borderRadius: 14, padding: 16,
            color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#ffffff11'
          }}
        />
      </View>

      {/* Submit */}
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={submitting}
        style={{
          backgroundColor: submitting ? '#6C63FF88' : '#6C63FF',
          borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 8
        }}
      >
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>
          {submitting ? 'Wird gespeichert…' : i18n.t('merchant.submit')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
