import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { MotiView } from 'moti';
import Constants from 'expo-constants';
import WidgetRenderer from '../../lib/generative/renderer';
import { WidgetSpecType } from '../../lib/generative/widget-spec';
import { encodeIntent, getDeviceHash } from '../../lib/privacy/intent-encoder';
import { getStats, recordSaving, SavingsStats } from '../../lib/savings';
import GlassHeader from '../../lib/components/GlassHeader';
import ShimmerCard from '../../lib/components/Shimmer';
import FreshnessChip from '../../lib/components/FreshnessChip';
import Confetti from '../../lib/components/Confetti';
import i18n from '../../lib/i18n';

const { height } = Dimensions.get('window');
const API = Constants.expoConfig?.extra?.apiUrl as string;

type State =
  | { status: 'idle' }
  | { status: 'location_denied' }
  | { status: 'loading' }
  | { status: 'no_merchant' }
  | { status: 'offer'; offer: { id: string; widget_spec: WidgetSpecType }; payload: object; generatedAt: number }
  | { status: 'declined' }
  | { status: 'error'; message: string };

const EMPTY_STATS: SavingsStats = { total_eur: 0, count_total: 0, count_this_week: 0, recent: [] };

export default function CustomerHome() {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<SavingsStats>(EMPTY_STATS);
  const [confettiTrigger, setConfettiTrigger] = useState(0);

  const refreshStats = useCallback(async () => {
    setStats(await getStats());
  }, []);

  const generate = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setState({ status: 'location_denied' }); return; }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = loc.coords;
      const deviceHash = await getDeviceHash();

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
      setState({ status: 'offer', offer: data, payload, generatedAt: Date.now() });
    } catch (e) {
      setState({ status: 'error', message: i18n.t('errors.generation_failed') });
    }
  }, []);

  useEffect(() => { refreshStats(); generate(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([generate(), refreshStats()]);
    setRefreshing(false);
  };

  const handleAccept = async () => {
    if (state.status !== 'offer') return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setConfettiTrigger(t => t + 1);

    const spec = state.offer.widget_spec;
    const amount_cents =
      spec.discount.kind === 'eur' ? Math.round(spec.discount.value * 100) :
      spec.discount.kind === 'pct' ? Math.round(spec.discount.value * 30) :
      150;
    await recordSaving({
      ts: Date.now(),
      amount_cents,
      merchant_name: spec.merchant.name,
      offer_id: state.offer.id,
    });
    refreshStats();

    fetch(`${API}/api/offer/${state.offer.id}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'accepted' }),
    }).catch(() => {});

    setTimeout(() => {
      router.push(`/(customer)/redeem/${state.offer.id}`);
    }, 600);
  };

  const handleDecline = async () => {
    if (state.status !== 'offer') return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetch(`${API}/api/offer/${state.offer.id}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'declined' }),
    }).catch(() => {});
    setState({ status: 'declined' });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
      <Confetti trigger={confettiTrigger} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6C63FF" />
        }
      >
        <GlassHeader stats={stats} />

        <View style={{ flex: 1, minHeight: height - 200 }}>
          {state.status === 'idle' || state.status === 'loading' ? (
            <ShimmerCard />
          ) : state.status === 'location_denied' ? (
            <LocationDeniedState onRetry={generate} />
          ) : state.status === 'no_merchant' ? (
            <NoMerchantState />
          ) : state.status === 'error' ? (
            <ErrorState message={state.message} onRetry={generate} />
          ) : state.status === 'declined' ? (
            <DeclinedState onRefresh={generate} />
          ) : state.status === 'offer' ? (
            <MotiView
              key={state.offer.id}
              from={{ opacity: 0, translateY: 12, scale: 0.98 }}
              animate={{ opacity: 1, translateY: 0, scale: 1 }}
              transition={{ type: 'spring', damping: 18, stiffness: 180 }}
              style={{ flex: 1, gap: 8 }}
            >
              <View style={{ flex: 1, minHeight: height * 0.58 }}>
                <WidgetRenderer
                  spec={state.offer.widget_spec}
                  offerId={state.offer.id}
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <FreshnessChip generatedAt={state.generatedAt} />
                <TouchableOpacity
                  onPress={() => router.push(`/(customer)/why/${state.offer.id}`)}
                  hitSlop={12}
                >
                  <Text style={{ color: '#6C63FF', fontSize: 13, fontWeight: '600' }}>
                    {i18n.t('customer.why')}  ›
                  </Text>
                </TouchableOpacity>
              </View>
            </MotiView>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function AnimatedEmoji({ emoji, delay = 0 }: { emoji: string; delay?: number }) {
  return (
    <MotiView
      from={{ scale: 0.6, rotate: '-12deg', opacity: 0 }}
      animate={{ scale: 1, rotate: '0deg', opacity: 1 }}
      transition={{ type: 'spring', damping: 10, stiffness: 140, delay }}
    >
      <Text style={{ fontSize: 64 }}>{emoji}</Text>
    </MotiView>
  );
}

function LocationDeniedState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 24 }}>
      <AnimatedEmoji emoji="📍" />
      <View style={{ gap: 8 }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 }}>
          Standort gebraucht
        </Text>
        <Text style={{ color: '#ffffff88', fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 280 }}>
          {i18n.t('customer.no_location')}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onRetry}
        style={{ backgroundColor: '#6C63FF', borderRadius: 16, paddingHorizontal: 32, paddingVertical: 16 }}
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
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 24 }}>
      <AnimatedEmoji emoji="🗺️" />
      <View style={{ gap: 8 }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 }}>
          Niemand in der Nähe
        </Text>
        <Text style={{ color: '#ffffff88', fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 300 }}>
          {i18n.t('customer.no_merchant')}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => router.replace('/(merchant)/setup')}
        style={{ backgroundColor: '#1A1A2E', borderRadius: 16, paddingHorizontal: 28, paddingVertical: 14, borderWidth: 1, borderColor: '#6C63FF66' }}
      >
        <Text style={{ color: '#6C63FF', fontWeight: '700', fontSize: 15 }}>
          {i18n.t('customer.become_merchant')}  ›
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function DeclinedState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <AnimatedEmoji emoji="👌" />
      <Text style={{ color: '#ffffff88', fontSize: 18, fontWeight: '600' }}>Verstanden</Text>
      <TouchableOpacity onPress={onRefresh} style={{
        backgroundColor: '#1A1A2E', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12,
      }}>
        <Text style={{ color: '#6C63FF', fontSize: 14, fontWeight: '700' }}>
          Anderes Angebot anzeigen
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <AnimatedEmoji emoji="⚠️" />
      <Text style={{ color: '#FF6B6B', fontSize: 16, textAlign: 'center', maxWidth: 280 }}>{message}</Text>
      <TouchableOpacity onPress={onRetry} style={{
        backgroundColor: '#1A1A2E', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12,
      }}>
        <Text style={{ color: '#6C63FF', fontSize: 14, fontWeight: '700' }}>Erneut versuchen</Text>
      </TouchableOpacity>
    </View>
  );
}
