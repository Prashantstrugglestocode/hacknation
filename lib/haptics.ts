import * as Haptics from 'expo-haptics';
import { getCachedPrefs, getPrefs } from './preferences';

// Settings-aware haptic helpers. Use these for ceremonial feedback (accept,
// scan success). Direct Haptics.* calls are fine for low-stakes selection UI.

// Warm the prefs cache once at import time so the first call respects the
// stored preference instead of the default-on baseline.
getPrefs().catch(() => {});

export function hapticSuccess() {
  if (!getCachedPrefs().haptics) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function hapticImpact(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) {
  if (!getCachedPrefs().haptics) return;
  Haptics.impactAsync(style).catch(() => {});
}
