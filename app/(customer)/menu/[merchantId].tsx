import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { MotiView } from 'moti';
import { ShimmerBlock } from '../../../lib/components/Shimmer';
import FallbackImage from '../../../lib/components/FallbackImage';
import { itemImageUrl } from '../../../lib/images';
import { theme } from '../../../lib/theme';

const API = Constants.expoConfig?.extra?.apiUrl as string;

interface MenuItem {
  id: string;
  name: string;
  price_cents: number | null;
  category: string | null;
  active?: boolean;
}

interface Merchant {
  id: string;
  name: string;
  type: string;
}

const CATEGORY_META: Record<string, { label: string; emoji: string; order: number }> = {
  drink:   { label: 'Getränke', emoji: '🥤', order: 1 },
  food:    { label: 'Speisen',  emoji: '🍽', order: 2 },
  dessert: { label: 'Dessert',  emoji: '🍰', order: 3 },
  special: { label: 'Specials', emoji: '⭐', order: 4 },
};

const fmtPrice = (c: number | null) =>
  c == null ? '' : `${(c / 100).toFixed(2).replace('.', ',')} €`;

export default function CustomerMenuView() {
  const { merchantId } = useLocalSearchParams<{ merchantId: string }>();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch(`${API}/api/merchant/${merchantId}/menu`).then(r => r.ok ? r.json() : []),
      fetch(`${API}/api/merchant/${merchantId}`).then(r => r.ok ? r.json() : null),
    ]).then(([menuData, merchantData]) => {
      if (!alive) return;
      const list = Array.isArray(menuData) ? menuData : [];
      setItems(list.filter((it: MenuItem) => it.active !== false));
      if (merchantData) setMerchant(merchantData);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [merchantId]);

  // Group items by category, ordered drink → food → dessert → special → other.
  const grouped = useMemo(() => {
    const byCat = new Map<string, MenuItem[]>();
    for (const it of items) {
      const cat = (it.category ?? 'food').toLowerCase();
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push(it);
    }
    return Array.from(byCat.entries()).sort(
      (a, b) => (CATEGORY_META[a[0]]?.order ?? 99) - (CATEGORY_META[b[0]]?.order ?? 99)
    );
  }, [items]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 40 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text style={{ color: theme.primary, fontSize: 15, fontWeight: '700' }}>Schließen</Text>
        </TouchableOpacity>

        <View>
          <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>
            SPEISEKARTE
          </Text>
          <Text style={{ color: theme.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.6 }} numberOfLines={1}>
            {merchant?.name ?? '—'}
          </Text>
          {merchant?.type ? (
            <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 2, fontWeight: '600' }}>
              {merchant.type}
            </Text>
          ) : null}
        </View>

        {loading ? (
          <View style={{ gap: 8 }}>
            <ShimmerBlock height={56} />
            <ShimmerBlock height={56} />
            <ShimmerBlock height={56} />
          </View>
        ) : items.length === 0 ? (
          <View style={{
            alignItems: 'center', padding: 28,
            backgroundColor: theme.bgMuted, borderRadius: 14,
            borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed',
          }}>
            <Text style={{ fontSize: 40 }}>📋</Text>
            <Text style={{ color: theme.text, fontWeight: '700', marginTop: 8 }}>Speisekarte noch nicht erfasst</Text>
            <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center', maxWidth: 280 }}>
              Dieser Händler hat seine Karte noch nicht digitalisiert.
            </Text>
          </View>
        ) : (
          grouped.map(([cat, list], gi) => {
            const meta = CATEGORY_META[cat] ?? { label: cat, emoji: '🍴', order: 99 };
            return (
              <View key={cat} style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: gi === 0 ? 0 : 8 }}>
                  <Text style={{ fontSize: 16 }}>{meta.emoji}</Text>
                  <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
                    {meta.label.toUpperCase()} · {list.length}
                  </Text>
                </View>
                {list.map((it, i) => (
                  <MotiView
                    key={it.id}
                    from={{ opacity: 0, translateY: 6 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 240, delay: 40 + i * 30 }}
                    style={{
                      backgroundColor: theme.surface, borderRadius: 12,
                      padding: 10, flexDirection: 'row', alignItems: 'center',
                      gap: 12, borderWidth: 1, borderColor: theme.border,
                    }}
                  >
                    <FallbackImage
                      uri={itemImageUrl(it.name, it.category, 120, 120)}
                      style={{ width: 56, height: 56, borderRadius: 10 }}
                      fallbackEmoji={cat === 'drink' ? '🥤' : cat === 'dessert' ? '🍰' : cat === 'special' ? '⭐' : '🍽'}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800' }} numberOfLines={1}>
                        {it.name}
                      </Text>
                    </View>
                    {it.price_cents != null && (
                      <Text style={{
                        color: theme.primary, fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'],
                      }}>
                        {fmtPrice(it.price_cents)}
                      </Text>
                    )}
                  </MotiView>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
