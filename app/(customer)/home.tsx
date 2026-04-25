import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity, Dimensions, Alert,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MotiView } from 'moti';
import Constants from 'expo-constants';
import WidgetRenderer from '../../lib/generative/renderer';
import { WidgetSpecType } from '../../lib/generative/widget-spec';
import { encodeIntent, getDeviceHash } from '../../lib/privacy/intent-encoder';
import { detectMovement } from '../../lib/context/movement';
import { getStats, recordSaving, SavingsStats } from '../../lib/savings';
import LiveHeader from '../../lib/components/LiveHeader';
import MilestoneModal, { isMilestone } from '../../lib/components/MilestoneModal';
import ShimmerCard from '../../lib/components/Shimmer';
import FreshnessChip from '../../lib/components/FreshnessChip';
import Confetti from '../../lib/components/Confetti';
import { theme } from '../../lib/theme';
import i18n from '../../lib/i18n';

const { height } = Dimensions.get('window');
const API = Constants.expoConfig?.extra?.apiUrl as string;

type State =
  | { status: 'idle' }
  | { status: 'location_denied' }
  | { status: 'loading' }
  | { status: 'no_merchant'; lastLat: number; lastLng: number }
  | { status: 'offer'; offer: { id: string; widget_spec: WidgetSpecType }; payload: object; generatedAt: number }
  | { status: 'declined' }
  | { status: 'expired' }
  | { status: 'error'; message: string };

const EMPTY_STATS: SavingsStats = { total_eur: 0, count_total: 0, count_this_week: 0, recent: [] };

export default function CustomerHome() {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<SavingsStats>(EMPTY_STATS);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const [milestone, setMilestone] = useState<number | null>(null);

  const refreshStats = useCallback(async () => {
    setStats(await getStats());
  }, []);

  const generate = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      let status = existing.status;
      if (status !== 'granted' && existing.canAskAgain) {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }
      if (status !== 'granted') { setState({ status: 'location_denied' }); return; }

      const [loc, movement, deviceHash] = await Promise.all([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        detectMovement(1500).catch(() => undefined),
        getDeviceHash(),
      ]);
      const { latitude: lat, longitude: lng } = loc.coords;

      const payload = encodeIntent({
        lat, lng,
        weatherCondition: 'unknown',
        tempC: 15,
        locale: i18n.locale,
        deviceHash,
        movement,
      });

      const res = await fetch(`${API}/api/offer/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 204) { setState({ status: 'no_merchant', lastLat: lat, lastLng: lng }); return; }
      if (!res.ok) { setState({ status: 'error', message: i18n.t('errors.generation_failed') }); return; }

      const data = await res.json();
      setState({ status: 'offer', offer: data, payload, generatedAt: Date.now() });
    } catch (e) {
      setState({ status: 'error', message: i18n.t('errors.generation_failed') });
    }
  }, []);

  const seedDemoMerchant = useCallback(async () => {
    if (state.status !== 'no_merchant' && state.status !== 'idle') return;
    setSeeding(true);
    try {
      let lat: number, lng: number;
      if (state.status === 'no_merchant') {
        lat = state.lastLat; lng = state.lastLng;
      } else {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude; lng = loc.coords.longitude;
      }
      const deviceHash = await getDeviceHash();
      const res = await fetch(`${API}/api/merchant/seed-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, owner_device_id: deviceHash }),
      });
      if (!res.ok) throw new Error('seed failed');
      const created = await res.json();
      // Take ownership: save merchant_id locally so Händler tab works
      if (created?.id) await AsyncStorage.setItem('merchant_id', created.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await generate();
    } catch (e) {
      Alert.alert('Fehler', 'Demo-Geschäft konnte nicht erstellt werden');
    } finally {
      setSeeding(false);
    }
  }, [state, generate]);

  useEffect(() => { refreshStats(); generate(); }, []);

  // Auto-expire offer after validity_minutes
  useEffect(() => {
    if (state.status !== 'offer') return;
    const ttlMs = state.offer.widget_spec.validity_minutes * 60 * 1000;
    const elapsed = Date.now() - state.generatedAt;
    const remaining = ttlMs - elapsed;
    if (remaining <= 0) { setState({ status: 'expired' }); return; }
    const t = setTimeout(() => setState({ status: 'expired' }), remaining);
    return () => clearTimeout(t);
  }, [state]);

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
    const next = await getStats();
    setStats(next);
    if (isMilestone(next.count_total)) setMilestone(next.count_total);

    fetch(`${API}/api/offer/${state.offer.id}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'accepted' }),
    }).catch(() => {});

    // If milestone is showing, wait until user dismisses; else go to redeem
    if (!isMilestone(next.count_total)) {
      setTimeout(() => router.push(`/(customer)/redeem/${state.offer.id}`), 600);
    }
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
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Confetti trigger={confettiTrigger} />
      <MilestoneModal
        visible={milestone !== null}
        count={milestone ?? 0}
        onClose={() => {
          const m = milestone;
          setMilestone(null);
          if (state.status === 'offer' && m) {
            router.push(`/(customer)/redeem/${state.offer.id}`);
          }
        }}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
      >
        <LiveHeader stats={stats} />

        <View style={{ flex: 1, minHeight: height - 220 }}>
          {state.status === 'idle' || state.status === 'loading' ? (
            <ShimmerCard />
          ) : state.status === 'location_denied' ? (
            <LocationDeniedState onRetry={generate} />
          ) : state.status === 'no_merchant' ? (
            <NoMerchantState onSeed={seedDemoMerchant} seeding={seeding} />
          ) : state.status === 'error' ? (
            <ErrorState message={state.message} onRetry={generate} />
          ) : state.status === 'declined' ? (
            <DeclinedState onRefresh={generate} />
          ) : state.status === 'expired' ? (
            <ExpiredState onRefresh={generate} />
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
                  <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '700' }}>
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

function PrimaryButton({ onPress, label, disabled = false }: { onPress: () => void; label: string; disabled?: boolean }) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      style={{
        backgroundColor: disabled ? theme.primaryWash : theme.primary,
        borderRadius: 16, paddingHorizontal: 32, paddingVertical: 16,
        shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
      }}
    >
      <Text style={{ color: theme.textOnPrimary, fontWeight: '800', fontSize: 16 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function GhostButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: theme.surface, borderRadius: 14,
        paddingHorizontal: 24, paddingVertical: 12,
        borderWidth: 1, borderColor: theme.border,
      }}
    >
      <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function LocationDeniedState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 24 }}>
      <AnimatedEmoji emoji="📍" />
      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 }}>
          Standort gebraucht
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 280 }}>
          {i18n.t('customer.no_location')}
        </Text>
      </View>
      <PrimaryButton onPress={onRetry} label={i18n.t('customer.grant_location')} />
      <TouchableOpacity onPress={() => Linking.openSettings()} hitSlop={12}>
        <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '700' }}>
          Schon abgelehnt? In Einstellungen öffnen ›
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function NoMerchantState({ onSeed, seeding }: { onSeed: () => void; seeding: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 22 }}>
      <AnimatedEmoji emoji="🗺️" />
      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 }}>
          Niemand in der Nähe
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 300 }}>
          {i18n.t('customer.no_merchant')}
        </Text>
      </View>
      <PrimaryButton onPress={onSeed} disabled={seeding} label={seeding ? 'Wird erstellt…' : '✨ Demo-Café hier erstellen'} />
      <GhostButton onPress={() => router.replace('/(merchant)/setup')} label={`${i18n.t('customer.become_merchant')}  ›`} />
    </View>
  );
}

function DeclinedState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <AnimatedEmoji emoji="👌" />
      <Text style={{ color: theme.textMuted, fontSize: 18, fontWeight: '600' }}>Verstanden</Text>
      <GhostButton onPress={onRefresh} label="Anderes Angebot anzeigen" />
    </View>
  );
}

function ExpiredState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <AnimatedEmoji emoji="⌛" />
      <Text style={{ color: theme.textMuted, fontSize: 18, fontWeight: '600', textAlign: 'center', maxWidth: 280 }}>
        {i18n.t('customer.expired')}
      </Text>
      <GhostButton onPress={onRefresh} label="Neues Angebot laden" />
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <AnimatedEmoji emoji="⚠️" />
      <Text style={{ color: theme.danger, fontSize: 16, textAlign: 'center', maxWidth: 280 }}>{message}</Text>
      <GhostButton onPress={onRetry} label="Erneut versuchen" />
    </View>
  );
}
