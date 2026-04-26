import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { MotiView } from 'moti';
import { getDeviceHash } from '../../lib/privacy/intent-encoder';
import { getCurrentMerchantId, setCurrentMerchantId, getOwnedMerchantIds } from '../../lib/merchant-store';
import { theme } from '../../lib/theme';

const API = Constants.expoConfig?.extra?.apiUrl as string;

interface Merchant {
  id: string;
  name: string;
  type: string;
  goal: string;
  max_discount_pct: number;
}

export default function MerchantPicker() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [deviceHash, current, localIds] = await Promise.all([
        getDeviceHash(),
        getCurrentMerchantId(),
        getOwnedMerchantIds(),
      ]);
      setCurrentId(current);

      // Server-side list (authoritative). Filter to ids present locally so
      // we only show shops this device actually owns/created.
      const r = await fetch(`${API}/api/merchants/owned?device_id=${encodeURIComponent(deviceHash)}`);
      let serverList: Merchant[] = [];
      if (r.ok) {
        const data = await r.json();
        serverList = Array.isArray(data) ? data : [];
      }
      // Union: prefer server data; fall back to local ids that aren't in
      // server response (e.g. stale or not yet propagated).
      const byId = new Map<string, Merchant>(serverList.map(m => [m.id, m]));
      for (const id of localIds) {
        if (!byId.has(id)) {
          byId.set(id, { id, name: '—', type: '', goal: '', max_discount_pct: 0 });
        }
      }
      setMerchants(Array.from(byId.values()));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const choose = async (id: string) => {
    await Haptics.selectionAsync();
    await setCurrentMerchantId(id);
    router.replace('/(merchant)/dashboard');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text style={{ color: theme.primary, fontSize: 15, fontWeight: '700' }}>← Back</Text>
        </TouchableOpacity>

        <View>
          <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>
            YOUR SHOPS
          </Text>
          <Text style={{ color: theme.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>
            🏪 Pick a shop
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 4 }}>
            You can manage several shops. Tap one to switch.
          </Text>
        </View>

        {loading ? (
          <Text style={{ color: theme.textMuted, fontSize: 13, paddingVertical: 12, textAlign: 'center' }}>
            Loading…
          </Text>
        ) : merchants.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 24, gap: 10 }}>
            <Text style={{ fontSize: 36 }}>🆕</Text>
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>No shop yet</Text>
          </View>
        ) : (
          merchants.map((m, i) => {
            const active = currentId === m.id;
            return (
              <Pressable key={m.id} onPress={() => choose(m.id)}>
                <MotiView
                  from={{ opacity: 0, translateY: 6 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 280, delay: i * 50 }}
                  style={{
                    backgroundColor: active ? theme.primaryWash : theme.surface,
                    borderRadius: 16, padding: 14,
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    borderWidth: 2, borderColor: active ? theme.primary : theme.border,
                  }}
                >
                  <View style={{
                    width: 44, height: 44, borderRadius: 12,
                    backgroundColor: active ? theme.primary : theme.bgMuted,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 22 }}>
                      {m.type === 'café' ? '☕' :
                       m.type === 'bakery' ? '🥖' :
                       m.type === 'restaurant' ? '🍽' :
                       m.type === 'bar' ? '🍺' :
                       m.type === 'bookstore' ? '📚' :
                       m.type === 'retail' ? '🛍' : '🏪'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: active ? theme.primaryDark : theme.text, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 }}
                      numberOfLines={1}>
                      {m.name}
                    </Text>
                    <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '600', marginTop: 1 }}>
                      {m.type || 'shop'} · max {m.max_discount_pct ?? 0} % off
                    </Text>
                  </View>
                  {active && (
                    <View style={{
                      backgroundColor: theme.primary, borderRadius: 999,
                      paddingHorizontal: 10, paddingVertical: 4,
                    }}>
                      <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 }}>
                        ACTIVE
                      </Text>
                    </View>
                  )}
                </MotiView>
              </Pressable>
            );
          })
        )}

        <TouchableOpacity
          onPress={() => router.replace('/(merchant)/setup')}
          style={{
            backgroundColor: theme.surface, borderRadius: 16, padding: 14,
            flexDirection: 'row', alignItems: 'center', gap: 12,
            borderWidth: 2, borderColor: theme.primary, borderStyle: 'dashed',
          }}>
          <View style={{
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: theme.primary,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '900' }}>+</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.primary, fontSize: 15, fontWeight: '900' }}>
              Add a new shop
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '600', marginTop: 1 }}>
              Setup in under 30 seconds
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
