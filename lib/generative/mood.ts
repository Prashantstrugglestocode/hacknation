// Mood-driven Moti animation curves.
// Brief: "cozy slow ease, urgent sharp spring, playful bouncy overshoot."
import type { MotiTransitionProp } from 'moti';

export type Mood = 'cozy' | 'energetic' | 'urgent' | 'playful' | 'discreet';

export function entryTransition(mood: Mood): MotiTransitionProp {
  switch (mood) {
    case 'cozy':
      return { type: 'timing', duration: 900, easing: undefined as any };
    case 'energetic':
      return { type: 'spring', damping: 12, stiffness: 220 };
    case 'urgent':
      return { type: 'spring', damping: 10, stiffness: 380 };
    case 'playful':
      return { type: 'spring', damping: 7, stiffness: 240, mass: 1.1 };
    case 'discreet':
      return { type: 'timing', duration: 500 };
  }
}

export function chipDelay(mood: Mood, i: number): number {
  switch (mood) {
    case 'cozy':      return 140 + i * 90;
    case 'energetic': return 60 + i * 50;
    case 'urgent':    return 30 + i * 30;
    case 'playful':   return 100 + i * 80;
    case 'discreet':  return 80 + i * 60;
  }
}

export function pressTransition(mood: Mood): MotiTransitionProp {
  switch (mood) {
    case 'cozy':      return { type: 'spring', damping: 18, stiffness: 240 };
    case 'energetic': return { type: 'spring', damping: 12, stiffness: 320 };
    case 'urgent':    return { type: 'spring', damping: 10, stiffness: 420 };
    case 'playful':   return { type: 'spring', damping: 8, stiffness: 260 };
    case 'discreet':  return { type: 'timing', duration: 220 };
  }
}

// CTA pulse: urgent gets a slight scale loop to signal urgency; cozy is still
export function ctaPulseConfig(mood: Mood) {
  if (mood === 'urgent') {
    return {
      animate: { scale: [1, 1.03, 1] as any },
      transition: { type: 'timing', duration: 1100, loop: true } as MotiTransitionProp,
    };
  }
  if (mood === 'playful') {
    return {
      animate: { rotate: ['0deg', '-1.5deg', '1.5deg', '0deg'] as any },
      transition: { type: 'timing', duration: 1400, loop: true } as MotiTransitionProp,
    };
  }
  return null;
}
