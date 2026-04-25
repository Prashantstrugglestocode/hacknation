import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity,
  Dimensions, ActivityIndicator, Animated
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { MotiView } from 'moti';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import WidgetRenderer from '../../lib/generative/renderer';
import { WidgetSpecType } from '../../lib/generative/widget-spec';
import { encodeIntent, getDeviceHash } from '../../lib/privacy/intent-encoder';
import i18n from '../../lib/i18n';

const { height, width } = Dimensions.get('window');
const API = Constants.expoConfig?.extra?.apiUrl as string;

type State =
  | { status: 'idle' }
  | { status: 'location_denied' }
  | { status: 'loading' }
  | { status: 'no_merchant' }
  | { status: 'offer'; offer: { id: string; widget_spec: WidgetSpecType }; payload: object }
  | { status: 'declined' }
  | { status: 'error'; message: string };

export default function CustomerHome() {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [refreshing, setRefreshing] = useState(false);

  const generate = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setState({ status: 'location_denied' }); return; }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = loc.coords;
      const deviceHash = await getDeviceHash();

      // Client-side intent encoding — exact coords never leave device
      const payload = encodeIntent({
        lat, lng,
        weatherCondition: 'unknown',
        tempC: 15,
        locale: i18n.locale,
        deviceHash,
      });

      const res = await fetch(`${API}/api/offer/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 204) { setState({ status: 'no_merchant' }); return; }
      if (!res.ok) { setState({ status: 'error', message: i18n.t('errors.generation_failed') }); return; }

      const data = await res.json();
      setState({ status: 'offer', offer: data, payload });
    } catch (e) {
      setState({ status: 'error', message: i18n.t('errors.generation_failed') });
    }
  }, []);

  useEffect(() => { generate(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await generate();
    setRefreshing(false);
  };

  const handleAccept = async () => {
    if (state.status !== 'offer') return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await fetch(`${API}/api/offer/${state.offer.id}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'accepted' }),
    });
    router.push(`/(customer)/redeem/${state.offer.id}`);
  };

  const handleDecline = async () => {
    if (state.status !== 'offer') return;
    await fetch(`${API}/api/offer/${state.offer.id}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'declined' }),
    });
    setState({ status: 'declined' });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#0A0A0F' }}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6C63FF" />}
    >
      <View style={{ flex: 1, padding: 16, minHeight: height - 120 }}>
        {/* Header */}
        <Text style={{ color: '#ffffff44', fontSize: 13, fontWeight: '600', letterSpacing: 1.5, marginBottom: 16, textAlign: 'center' }}>
          CITY WALLET
        </Text>

        {state.status === 'idle' || state.status === 'loading' ? (
          <SkeletonCard />
        ) : state.status === 'location_denied' ? (
          <LocationDeniedState onRetry={generate} />
        ) : state.status === 'no_merchant' ? (
          <NoMerchantState />
        ) : state.status === 'error' ? (
          <ErrorState message={state.message} onRetry={generate} />
        ) : state.status === 'declined' ? (
          <DeclinedState onRefresh={generate} />
        ) : state.status === 'offer' ? (
          <View style={{ flex: 1, gap: 12 }}>
            <View style={{ flex: 1, minHeight: height * 0.58 }}>
              <WidgetRenderer
                spec={state.offer.widget_spec}
                onAccept={handleAccept}
                onDecline={handleDecline}
              />
            </View>
            <TouchableOpacity
              onPress={() => router.push(`/(customer)/why/${state.offer.id}`)}
              style={{ alignItems: 'center', paddingVertical: 12 }}
            >
              <Text style={{ color: '#6C63FF', fontSize: 14 }}>
                {i18n.t('customer.why')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function SkeletonCard() {
  return (
    <MotiView
      from={{ opacity: 0.4 }}
      animate={{ opacity: 0.8 }}
      transition={{ type: 'timing', duration: 800, loop: true }}
      style={{ flex: 1, minHeight: 400, borderRadius: 20, backgroundColor: '#1A1A2E' }}
    >
      <View style={{ height: '55%', backgroundColor: '#2A2A3E', borderRadius: 20 }} />
      <View style={{ padding: 20, gap: 12 }}>
        <View style={{ height: 24, backgroundColor: '#2A2A3E', borderRadius: 8, width: '70%' }} />
        <View style={{ height: 16, backgroundColor: '#2A2A3E', borderRadius: 8, width: '90%' }} />
        <View style={{ height: 16, backgroundColor: '#2A2A3E', borderRadius: 8, width: '60%' }} />
      </View>
    </MotiView>
  );
}

function LocationDeniedState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 20 }}>
      <Text style={{ fontSize: 40 }}>📍</Text>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
        {i18n.t('customer.no_location')}
      </Text>
      <TouchableOpacity
        onPress={onRetry}
        style={{ backgroundColor: '#6C63FF', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
          {i18n.t('customer.grant_location')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function NoMerchantState() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 20 }}>
      <Text style={{ fontSize: 40 }}>🗺️</Text>
      <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center', lineHeight: 24 }}>
        {i18n.t('customer.no_merchant')}
      </Text>
      <TouchableOpacity
        onPress={() => router.replace('/(merchant)/setup')}
        style={{ backgroundColor: '#1A1A2E', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, borderWidth: 1, borderColor: '#6C63FF44' }}
      >
        <Text style={{ color: '#6C63FF', fontWeight: '700', fontSize: 15 }}>
          {i18n.t('customer.become_merchant')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function DeclinedState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <Text style={{ color: '#ffffff66', fontSize: 18 }}>Verstanden</Text>
      <TouchableOpacity onPress={onRefresh}>
        <Text style={{ color: '#6C63FF', fontSize: 15 }}>{i18n.t('customer.pull_refresh')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Text style={{ color: '#FF6B6B', fontSize: 16, textAlign: 'center' }}>{message}</Text>
      <TouchableOpacity onPress={onRetry}>
        <Text style={{ color: '#6C63FF', fontSize: 15 }}>Erneut versuchen</Text>
      </TouchableOpacity>
    </View>
  );
}
