import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Animated, PanResponder, Dimensions, LayoutChangeEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme, space, radius, type as typo } from '../theme';

interface Props {
  // Total to "pay" in cents — shown next to the label.
  amountCents?: number | null;
  // Localised CTA above the track (e.g. "Slide to pay" / "Schieben zum Bezahlen").
  label: string;
  // Localised label shown while the action is processing.
  processingLabel: string;
  // Localised label shown once confirmed (rendered briefly before parent dismisses).
  confirmedLabel: string;
  // Track + thumb tint (defaults to theme.primary).
  accent?: string;
  disabled?: boolean;
  // Fired when the thumb reaches the right edge. Parent should run the
  // payment side-effect and then unmount or change the screen state.
  onConfirm: () => void | Promise<void>;
}

// Apple-Pay-style slide-to-confirm. Single horizontal track with a draggable
// thumb. Reaching the right edge triggers `onConfirm`, with haptic feedback
// at three points: start (light), 80% (medium), confirm (success).
export default function SlideToPay({
  amountCents,
  label,
  processingLabel,
  confirmedLabel,
  accent = theme.primary,
  disabled = false,
  onConfirm,
}: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'processing' | 'confirmed'>('idle');
  const translateX = useRef(new Animated.Value(0)).current;
  const peakRef = useRef(0); // furthest the user has dragged
  const did80HapticRef = useRef(false);
  const THUMB = 56;

  const onTrackLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const maxX = Math.max(0, trackWidth - THUMB - 6);

  // Live refs so the PanResponder (created once) always sees the latest
  // values. Without these, maxX/phase/disabled/onConfirm captured at first
  // render (trackWidth=0) would be stale for the entire component lifetime —
  // the thumb wouldn't move and confirm would never fire.
  const maxXRef = useRef(0);
  const phaseRef = useRef<'idle' | 'processing' | 'confirmed'>('idle');
  const disabledRef = useRef(disabled);
  const onConfirmRef = useRef(onConfirm);
  useEffect(() => { maxXRef.current = maxX; }, [maxX]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { disabledRef.current = disabled; }, [disabled]);
  useEffect(() => { onConfirmRef.current = onConfirm; }, [onConfirm]);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => phaseRef.current === 'idle' && !disabledRef.current,
      onMoveShouldSetPanResponder: () => phaseRef.current === 'idle' && !disabledRef.current,
      onPanResponderGrant: () => {
        Haptics.selectionAsync().catch(() => {});
        peakRef.current = 0;
        did80HapticRef.current = false;
      },
      onPanResponderMove: (_evt, gesture) => {
        if (phaseRef.current !== 'idle' || disabledRef.current) return;
        const m = maxXRef.current;
        const x = Math.max(0, Math.min(m, gesture.dx));
        translateX.setValue(x);
        peakRef.current = Math.max(peakRef.current, x);
        if (!did80HapticRef.current && m > 0 && x / m > 0.8) {
          did80HapticRef.current = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        }
      },
      onPanResponderRelease: async (_evt, gesture) => {
        if (phaseRef.current !== 'idle' || disabledRef.current) return;
        const m = maxXRef.current;
        const x = Math.max(0, Math.min(m, gesture.dx));
        // Threshold: 92% of track. Anything less snaps back; anything more confirms.
        if (m > 0 && x / m >= 0.92) {
          // Snap to end first so the thumb sits flush, then run the action.
          Animated.spring(translateX, {
            toValue: m, useNativeDriver: true, damping: 20, stiffness: 280,
          }).start();
          setPhase('processing');
          phaseRef.current = 'processing';
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          try {
            await onConfirmRef.current();
            setPhase('confirmed');
            phaseRef.current = 'confirmed';
          } catch {
            // Parent should surface its own error — just reset the slider.
            Animated.spring(translateX, {
              toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220,
            }).start();
            setPhase('idle');
            phaseRef.current = 'idle';
          }
        } else {
          Animated.spring(translateX, {
            toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220,
        }).start();
      },
    }),
  ).current;

  // Fade the helper label faster than the thumb travels — by ~60% the
  // label is mostly out of the way so it doesn't fight with the thumb glyph.
  const labelOpacity = translateX.interpolate({
    inputRange: [0, Math.max(1, maxX) * 0.6, Math.max(1, maxX)],
    outputRange: [1, 0.25, 0],
    extrapolate: 'clamp',
  });
  // Subtle hint chevron that nudges right on idle to telegraph "drag me".
  const hintTranslate = translateX.interpolate({
    inputRange: [0, Math.max(1, maxX)],
    outputRange: [0, 12],
    extrapolate: 'clamp',
  });
  // Animate the fill via transform: scaleX (native-supported) instead of
  // `width` (layout-only). Animating `width` on a value derived from a
  // native-driven Animated.Value triggers RN's "child property width is not
  // supported" warning every render — and it's pointless because the fill
  // can be expressed as a scaleX of a full-width bar with origin: left.
  // We pre-compute scale so that at maxX the bar covers the whole track
  // (THUMB + 6 + maxX) ÷ trackWidth → ~1.0.
  const fullFillPx = THUMB + 6 + maxX;
  const safeTrackW = Math.max(1, trackWidth);
  const targetScale = Math.min(1, fullFillPx / safeTrackW);
  const minScale = Math.min(targetScale, (THUMB + 6) / safeTrackW);
  const fillScaleX = translateX.interpolate({
    inputRange: [0, Math.max(1, maxX)],
    outputRange: [minScale, targetScale],
    extrapolate: 'clamp',
  });
  // Track tint deepens as the thumb advances — a visible "you're getting there".
  const fillOpacity = translateX.interpolate({
    inputRange: [0, Math.max(1, maxX)],
    outputRange: [0.5, 1],
    extrapolate: 'clamp',
  });

  const liveLabel =
    phase === 'confirmed' ? confirmedLabel
    : phase === 'processing' ? processingLabel
    : label;

  return (
    <View style={{ gap: space.sm }}>
      {amountCents != null && amountCents > 0 && (
        <View style={{
          flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
          paddingHorizontal: 4,
        }}>
          <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }}>
            ZU ZAHLEN
          </Text>
          <Text style={{
            color: theme.text, fontSize: typo.title, fontWeight: '900',
            fontVariant: ['tabular-nums'], letterSpacing: -0.6,
          }}>
            {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' })
              .format(amountCents / 100)}
          </Text>
        </View>
      )}

      <View
        onLayout={onTrackLayout}
        style={{
          height: THUMB + 6, borderRadius: (THUMB + 6) / 2,
          backgroundColor: accent + '0C',
          borderWidth: 1, borderColor: accent + '33',
          overflow: 'hidden', position: 'relative',
        }}
      >
        {/* Filled track behind the thumb — opacity also rises with travel.
            Anchored to the left edge so scaleX grows rightward (matching the
            thumb travel direction). transformOrigin requires RN >= 0.74. */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
            transformOrigin: 'left center' as any,
            transform: [{ scaleX: fillScaleX }],
            backgroundColor: accent + '2E',
            opacity: fillOpacity,
          }}
        />

        {/* Helper label centred on the track, with a hint chevron that
            drifts right on idle. Swallowed by the fade as the thumb moves. */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
            flexDirection: 'row',
            alignItems: 'center', justifyContent: 'center',
            opacity: labelOpacity,
          }}
        >
          <Text style={{
            color: theme.text, fontSize: 14, fontWeight: '900', letterSpacing: 0.4,
          }}>
            {liveLabel}
          </Text>
          <Animated.Text style={{
            color: theme.text, fontSize: 16, fontWeight: '900',
            marginLeft: 8, transform: [{ translateX: hintTranslate }],
          }}>
            ›
          </Animated.Text>
        </Animated.View>

        {/* Thumb — tinted shadow follows brand palette; on confirm a green
            success ring blooms behind it for the instant before the parent
            swaps the screen state. */}
        <Animated.View
          {...responder.panHandlers}
          style={{
            position: 'absolute', top: 3, left: 3,
            width: THUMB, height: THUMB, borderRadius: THUMB / 2,
            backgroundColor: phase === 'confirmed' ? theme.success : accent,
            alignItems: 'center', justifyContent: 'center',
            transform: [{ translateX }],
            shadowColor: phase === 'confirmed' ? theme.success : accent,
            shadowOpacity: 0.55,
            shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '900' }}>
            {phase === 'confirmed' ? '✓' : phase === 'processing' ? '…' : '›'}
          </Text>
        </Animated.View>
      </View>

      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingTop: 2,
      }}>
        <Text style={{ fontSize: 10 }}>🔒</Text>
        <Text style={{
          color: theme.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.3,
        }}>
          Sparkassen-Konto · sicher & verschlüsselt
        </Text>
      </View>
    </View>
  );
}
