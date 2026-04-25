import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cw_savings_v1';

export interface SavingEntry {
  ts: number;
  amount_cents: number;
  merchant_name: string;
  offer_id: string;
}

export interface SavingsStats {
  total_eur: number;
  count_total: number;
  count_this_week: number;
  recent: SavingEntry[];
}

export async function recordSaving(entry: SavingEntry): Promise<void> {
  const list = await loadAll();
  list.unshift(entry);
  await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)));
}

export async function loadAll(): Promise<SavingEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function getStats(): Promise<SavingsStats> {
  const list = await loadAll();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const total_cents = list.reduce((s, e) => s + e.amount_cents, 0);
  return {
    total_eur: total_cents / 100,
    count_total: list.length,
    count_this_week: list.filter(e => e.ts > weekAgo).length,
    recent: list.slice(0, 5),
  };
}

export async function clearAll(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
