import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import Constants from 'expo-constants';
import { loadAll, SavingEntry } from '../../lib/savings';
import { theme } from '../../lib/theme';

const API = Constants.expoConfig?.extra?.apiUrl as string;

interface OfferRow {
  id: string;
  merchant_name: string;
  headline?: string;
  status: string;
  ts: number;
  discount_label?: string;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return `Today · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  }
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === yesterday.toDateString()) {
    return `Yesterday · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

export default function HistoryScreen() {
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const local: SavingEntry[] = await loadAll();
    const enriched = await Promise.all(local.map(async (e) => {
      try {
        const res = await fetch(`${API}/api/offer/${e.offer_id}`);
        if (!res.ok) return null;
        const data = await res.json();
        const spec = data.widget_spec ?? {};
        return {
          id: e.offer_id,
          merchant_name: e.merchant_name ?? spec.merchant?.name ?? '—',
          headline: spec.headline,
          status: data.status ?? 'accepted',
          ts: e.ts,
          discount_label: e.amount_cents
            ? `${(e.amount_cents / 100).toFixed(2).replace('.', ',')} €`
            : undefined,
        } as OfferRow;
      } catch { return null; }
    }));
    setRows(enriched.filter((x): x is OfferRow => !!x));
  }, []);

  useEffect(() => { load(); }, [load]);

  const statusBadge = (status: string) => {
    const cfg: Record<string, { color: string; label: string }> = {
      accepted: { color: theme.success, label: 'Angenommen' },
      redeemed: { color: theme.success, label: 'Redeemed' },
      declined: { color: theme.warn, label: 'Abgelehnt' },
      expired: { color: theme.danger, label: 'Abgelaufen' },
      shown: { color: theme.textMuted, label: 'Angezeigt' },
    };
    const c = cfg[status] ?? cfg.shown;
    return (
      <View style={{
        backgroundColor: c.color + '22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
        borderWidth: 1, borderColor: c.color + '44',
      }}>
        <Text style={{ color: c.color, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>{c.label}</Text>
      </View>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={theme.primary} />}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <View>
          <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>VERLAUF</Text>
          <Text style={{ color: theme.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>
            Deine letzten Angebote
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text style={{ color: theme.primary, fontSize: 15, fontWeight: '700' }}>Close</Text>
        </TouchableOpacity>
      </View>

      {rows.length === 0 ? (
        <View style={{ alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 }}>
          <Text style={{ fontSize: 56 }}>🕐</Text>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
            Noch keine Angebote angenommen
          </Text>
        </View>
      ) : (
        rows.map((o, i) => (
          <MotiView
            key={o.id}
            from={{ opacity: 0, translateY: 6 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 280, delay: i * 50 }}
            style={{
              backgroundColor: theme.surface, borderRadius: 14, padding: 14,
              borderWidth: 1, borderColor: theme.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800' }} numberOfLines={1}>
                {o.merchant_name}
              </Text>
              {statusBadge(o.status)}
            </View>
            {o.headline ? (
              <Text style={{ color: theme.textMuted, fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
                {o.headline}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: theme.textMuted, fontSize: 11 }}>{fmtTime(o.ts)}</Text>
              {o.discount_label ? (
                <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '800' }}>
                  −{o.discount_label}
                </Text>
              ) : null}
            </View>
          </MotiView>
        ))
      )}
    </ScrollView>
  );
}
