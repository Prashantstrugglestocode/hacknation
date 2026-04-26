import AsyncStorage from '@react-native-async-storage/async-storage';

// Keys:
//   merchant_id      → currently-selected merchant (single id)  [back-compat]
//   cw_merchant_ids  → JSON array of all owned merchant ids
const CURRENT_KEY = 'merchant_id';
const LIST_KEY = 'cw_merchant_ids';

export async function getCurrentMerchantId(): Promise<string | null> {
  return AsyncStorage.getItem(CURRENT_KEY);
}

export async function getOwnedMerchantIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(LIST_KEY);
  if (!raw) {
    // First read after upgrade: lift the legacy single id into the list so the
    // user doesn't lose their existing shop.
    const legacy = await AsyncStorage.getItem(CURRENT_KEY);
    if (legacy) {
      await AsyncStorage.setItem(LIST_KEY, JSON.stringify([legacy]));
      return [legacy];
    }
    return [];
  }
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(s => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export async function addMerchantId(id: string): Promise<void> {
  const list = await getOwnedMerchantIds();
  if (!list.includes(id)) list.unshift(id);
  await AsyncStorage.multiSet([
    [LIST_KEY, JSON.stringify(list)],
    [CURRENT_KEY, id], // newly created merchant becomes current
  ]);
}

export async function setCurrentMerchantId(id: string): Promise<void> {
  await AsyncStorage.setItem(CURRENT_KEY, id);
}

export async function removeMerchantId(id: string): Promise<void> {
  const list = (await getOwnedMerchantIds()).filter(x => x !== id);
  await AsyncStorage.setItem(LIST_KEY, JSON.stringify(list));
  const cur = await getCurrentMerchantId();
  if (cur === id) {
    if (list.length > 0) await AsyncStorage.setItem(CURRENT_KEY, list[0]);
    else await AsyncStorage.removeItem(CURRENT_KEY);
  }
}
