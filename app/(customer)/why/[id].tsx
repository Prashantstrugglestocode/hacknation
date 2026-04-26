import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { forgetMe } from '../../../lib/privacy/intent-encoder';
import { PRIVACY_DISCLOSURE } from '../../../lib/privacy/disclosure';
import { theme } from '../../../lib/theme';
import i18n, { getLocale } from '../../../lib/i18n';

const API = Constants.expoConfig?.extra?.apiUrl as string;

interface SignalRow {
  icon: string;
  source: string;
  label: string;
  value: string;
  detail?: string;
}

function SignalCard({ row, delay = 0 }: { row: SignalRow; delay?: number }) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 350, delay }}
      style={{
        backgroundColor: theme.surface, borderRadius: 16, padding: 14,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        borderWidth: 1, borderColor: theme.border,
      }}
    >
      <View style={{
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: theme.primaryWash,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 18 }}>{row.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>
            {row.source}
          </Text>
        </View>
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700', marginTop: 1 }}>
          {row.label}
        </Text>
        {row.detail ? (
          <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>{row.detail}</Text>
        ) : null}
      </View>
      <Text style={{ color: theme.primary, fontSize: 15, fontWeight: '800' }}>
        {row.value}
      </Text>
    </MotiView>
  );
}

function buildSignalRows(ctx: any): SignalRow[] {
  const rows: SignalRow[] = [];
  const w = ctx?.weather;
  if (w) {
    rows.push({
      icon: w.condition?.toLowerCase().includes('rain') ? '🌧️' :
            w.condition?.toLowerCase().includes('clear') ? '☀️' :
            w.condition?.toLowerCase().includes('snow') ? '❄️' : '⛅',
      source: ctx.weather_source === 'dwd' ? 'DWD Brightsky' : 'Wetterdaten',
      label: 'Aktuelles Wetter',
      detail: w.condition,
      value: `${Math.round(w.temp_c)} °C`,
    });
  }
  if (typeof ctx?.hour === 'number') {
    const bucket = ctx.intent?.time_bucket;
    rows.push({
      icon: '🕐',
      source: 'Lokale Zeit',
      label: bucket ? `Tageszeit · ${bucket}` : 'Tageszeit',
      value: `${String(ctx.hour).padStart(2, '0')}:00`,
    });
  }
  if (ctx?.geohash6) {
    rows.push({
      icon: '📍',
      source: 'Standort (anonymisiert)',
      label: 'Geohash-Zelle ~1,2 km',
      detail: 'Exakte Position bleibt auf deinem Gerät',
      value: ctx.geohash6,
    });
  }
  if (ctx?.pois && ctx.pois.total > 0) {
    rows.push({
      icon: '🗺️',
      source: 'OpenStreetMap · Overpass',
      label: 'Geschäfte in 500 m',
      detail: `${ctx.pois.cafes} Cafés · ${ctx.pois.restaurants} Restaurants · ${ctx.pois.shops} Läden`,
      value: String(ctx.pois.total),
    });
  }
  if (ctx?.payone) {
    const label = ctx.payone.density === 'low' ? 'Ruhig' : ctx.payone.density === 'high' ? 'Stoßzeit' : 'Normal';
    rows.push({
      icon: '💳',
      source: 'Payone',
      label: 'Transaktions-Dichte',
      detail: 'Live-Signal aus dem DSV-Netz',
      value: label,
    });
  }
  if (Array.isArray(ctx?.events) && ctx.events.length > 0) {
    rows.push({
      icon: '🎫',
      source: 'Ticketmaster',
      label: 'Events in der Nähe',
      detail: ctx.events[0]?.name ?? '',
      value: `${ctx.events.length}`,
    });
  }
  if (ctx?.intent?.movement) {
    const m = ctx.intent.movement;
    rows.push({
      icon: m === 'stationary' ? '🛋️' : m === 'browsing' ? '👀' : m === 'walking' ? '🚶' : '🚌',
      source: 'Beschleunigungssensor (lokal)',
      label: 'Bewegung',
      detail: 'Klassifiziert auf dem Gerät',
      value: m === 'stationary' ? 'Stillstand' : m === 'browsing' ? 'Bummeln' : m === 'walking' ? 'Gehen' : 'Transport',
    });
  }
  return rows;
}

const TRIGGER_LABELS: Record<string, { de: string; en: string; emoji: string }> = {
  COZY_QUIET_NEARBY:      { de: 'Kalt & ruhig — Café-Wetter',     en: 'Cold & quiet — café weather',  emoji: '☕' },
  EVENT_DEMAND_SPIKE:     { de: 'Event in der Nähe',              en: 'Event nearby',                  emoji: '🎫' },
  LATE_AFTERNOON_BROWSE:  { de: 'Bummelzeit am Nachmittag',       en: 'Late-afternoon browsing',       emoji: '👀' },
  CLOSING_SOON_INVENTORY: { de: 'Bald geschlossen · Restbestand', en: 'Closing soon · stock left',     emoji: '⏱' },
  BAD_WEATHER_INDOOR:     { de: 'Schlechtes Wetter · drinnen',    en: 'Bad weather · indoors',         emoji: '🌧' },
  LUNCHTIME_QUIET:        { de: 'Mittag · ruhige Stunde',         en: 'Lunchtime · quiet hour',        emoji: '🥪' },
};

function FiredTriggers({ triggers }: { triggers: string[] }) {
  if (!triggers || triggers.length === 0) return null;
  const locale = getLocale();
  const weight = Math.round(100 / triggers.length);
  return (
    <View style={{
      backgroundColor: theme.surface, borderRadius: 16, padding: 14, gap: 10,
      borderWidth: 1, borderColor: theme.border,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
          AUSGELÖSTE REGELN
        </Text>
        <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '800' }}>
          {triggers.length} aktiv
        </Text>
      </View>
      {triggers.map((id, i) => {
        const meta = TRIGGER_LABELS[id] ?? { de: id, en: id, emoji: '⚙️' };
        const label = locale === 'en' ? meta.en : meta.de;
        return (
          <MotiView
            key={id}
            from={{ opacity: 0, translateX: -8 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'timing', duration: 320, delay: i * 70 }}
            style={{ gap: 5 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 14 }}>{meta.emoji}</Text>
              <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700', flex: 1 }}>{label}</Text>
              <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                {weight} %
              </Text>
            </View>
            <View style={{ height: 6, backgroundColor: theme.bgMuted, borderRadius: 3, overflow: 'hidden' }}>
              <MotiView
                from={{ width: '0%' }}
                animate={{ width: `${weight}%` }}
                transition={{ type: 'timing', duration: 600, delay: 200 + i * 70 }}
                style={{ height: '100%', backgroundColor: theme.primary, borderRadius: 3 }}
              />
            </View>
          </MotiView>
        );
      })}
    </View>
  );
}

export default function WhyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [offer, setOffer] = useState<any>(null);
  const [forgotDone, setForgotDone] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const locale = getLocale();
  const disclosure = PRIVACY_DISCLOSURE[locale];

  useEffect(() => {
    fetch(`${API}/api/offer/${id}`)
      .then(r => r.json())
      .then(setOffer)
      .catch(() => {});
  }, [id]);

  const handleForgetMe = async () => {
    await forgetMe();
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setForgotDone(true);
  };

  const reasoning: string = offer?.widget_spec?.reasoning ?? '';
  const contextState = offer?.context_state ?? {};
  const rows = buildSignalRows(contextState);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 22, gap: 20 }}>
      <TouchableOpacity onPress={() => router.back()} style={{ alignSelf: 'flex-start' }}>
        <Text style={{ color: theme.primary, fontSize: 15, fontWeight: '700' }}>← Zurück</Text>
      </TouchableOpacity>

      <View>
        <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>
          TRANSPARENZ
        </Text>
        <Text style={{ color: theme.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>
          Warum dieses Angebot?
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
          Diese Signale haben das Angebot ausgelöst. Du siehst genau, was wir wissen.
        </Text>
      </View>

      {/* SLM-spirit privacy banner — answers the brief's "abstract intent
          signal" requirement explicitly. */}
      <View style={{
        backgroundColor: theme.success + '12', borderRadius: 16, padding: 14, gap: 8,
        borderWidth: 1, borderColor: theme.success + '44',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 16 }}>🔒</Text>
          <Text style={{ color: theme.success, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 }}>
            ON-DEVICE INTENT-ENCODER
          </Text>
        </View>
        <Text style={{ color: theme.text, fontSize: 13, lineHeight: 19, fontWeight: '600' }}>
          Deine echte Position bleibt auf dem Gerät. An den Server geht nur
          eine 1,2 km Geohash-Zelle und ein abstrakter Intent-Vektor
          (z.B. „kalt", „regnerisch", „Mittagszeit") — berechnet lokal,
          niemals dein Bewegungsprofil.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {['Geohash-6', 'Intent-Flags', 'Rotierender Hash', 'Kein Profil'].map(t => (
            <View key={t} style={{
              backgroundColor: theme.success + '22', borderRadius: 8,
              paddingHorizontal: 8, paddingVertical: 3,
            }}>
              <Text style={{ color: theme.success, fontSize: 10, fontWeight: '800' }}>{t}</Text>
            </View>
          ))}
        </View>
      </View>

      {reasoning ? (
        <View style={{
          backgroundColor: theme.primaryWash, borderRadius: 16, padding: 16,
          borderWidth: 1, borderColor: theme.primary + '55',
        }}>
          <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6 }}>
            BEGRÜNDUNG
          </Text>
          <Text style={{ color: theme.primaryDark, fontSize: 15, lineHeight: 22, fontWeight: '600' }}>
            {reasoning}
          </Text>
        </View>
      ) : null}

      <FiredTriggers triggers={contextState?.fired_triggers ?? []} />

      {/* Confidence bar — % of available signal categories used in this offer */}
      {rows.length > 0 && (() => {
        const max = 6; // weather, time, geohash, pois, payone, events, movement
        const used = rows.length;
        const pct = Math.min(100, Math.round((used / max) * 100));
        return (
          <View style={{
            backgroundColor: theme.surface, borderRadius: 16, padding: 14,
            borderWidth: 1, borderColor: theme.border, gap: 8,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
                KONFIDENZ
              </Text>
              <Text style={{ color: theme.primary, fontSize: 18, fontWeight: '900' }}>{pct} %</Text>
            </View>
            <View style={{ height: 8, backgroundColor: theme.bgMuted, borderRadius: 4, overflow: 'hidden' }}>
              <MotiView
                from={{ width: '0%' }}
                animate={{ width: `${pct}%` }}
                transition={{ type: 'timing', duration: 800 }}
                style={{ height: '100%', backgroundColor: theme.primary, borderRadius: 4 }}
              />
            </View>
            <Text style={{ color: theme.textMuted, fontSize: 12 }}>
              {used} von {max} Signal-Kategorien aktiv genutzt
            </Text>
          </View>
        );
      })()}

      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>
          GENUTZTE SIGNALE
        </Text>
        {rows.map((r, i) => <SignalCard key={i} row={r} delay={i * 80} />)}
      </View>

      <View style={{
        backgroundColor: theme.surface, borderRadius: 16, padding: 16, gap: 8,
        borderWidth: 1, borderColor: theme.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 16 }}>🔒</Text>
          <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800' }}>{disclosure.title}</Text>
        </View>
        <Text style={{ color: theme.textMuted, fontSize: 13, lineHeight: 20 }}>{disclosure.body}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <Text style={{ color: theme.success, fontSize: 12, fontWeight: '800' }}>✓</Text>
          <Text style={{ color: theme.textMuted, fontSize: 12 }}>{disclosure.what_stays}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '800' }}>↑</Text>
          <Text style={{ color: theme.textMuted, fontSize: 12 }}>{disclosure.what_sent}</Text>
        </View>
      </View>

      <TouchableOpacity onPress={() => setShowRaw(s => !s)}
        style={{
          alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
          paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
          backgroundColor: theme.bgMuted, borderWidth: 1, borderColor: theme.border,
        }}>
        <Text style={{ fontSize: 12 }}>{showRaw ? '▼' : '▶'}</Text>
        <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '700' }}>
          {showRaw ? 'Rohe JSON ausblenden' : 'Für Entwickler: rohe JSON'}
        </Text>
      </TouchableOpacity>
      {showRaw && (
        <View style={{ backgroundColor: '#1F1F23', borderRadius: 12, padding: 12 }}>
          <Text style={{ color: '#FECACA', fontSize: 10, fontFamily: 'Courier', lineHeight: 14 }}>
            {JSON.stringify(contextState, null, 2)}
          </Text>
        </View>
      )}

      {forgotDone ? (
        <View style={{
          backgroundColor: theme.primaryWash, padding: 14, borderRadius: 14, alignItems: 'center',
          borderWidth: 1, borderColor: theme.primary + '66',
        }}>
          <Text style={{ color: theme.primaryDark, textAlign: 'center', fontSize: 14, fontWeight: '800' }}>
            ✓ Verlauf gelöscht. Gerätekennzeichen rotiert.
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          onPress={handleForgetMe}
          style={{
            backgroundColor: theme.danger + '11', borderRadius: 14,
            paddingVertical: 15, alignItems: 'center',
            borderWidth: 1, borderColor: theme.danger + '44',
          }}
        >
          <Text style={{ color: theme.danger, fontSize: 15, fontWeight: '800' }}>
            {i18n.t('customer.forget_me')}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}
