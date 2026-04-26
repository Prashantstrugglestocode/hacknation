import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { MotiView, AnimatePresence } from 'moti';
import WidgetRenderer from '../../lib/generative/renderer';
import ShimmerCard from '../../lib/components/Shimmer';
import LlmStatusPill from '../../lib/components/LlmStatusPill';
import { theme } from '../../lib/theme';

const API = Constants.expoConfig?.extra?.apiUrl as string;
const { width: screenW, height: screenH } = Dimensions.get('window');

// Phone-frame inner width is ~80% of screen for a tactile "device-in-hand" feel.
const PHONE_W = Math.min(screenW - 56, 320);
const PHONE_H = Math.min(screenH * 0.62, 580);

export default function MerchantPreview() {
  const { id, fromRules, fromSetup } = useLocalSearchParams<{
    id: string; fromRules?: string; fromSetup?: string;
  }>();
  const [spec, setSpec] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [iter, setIter] = useState(0);
  const [showBanner, setShowBanner] = useState(fromRules === '1' || fromSetup === '1');
  const bannerText = fromSetup === '1'
    ? 'Shop saved · generating preview'
    : 'New rules active · preview regenerated';

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/merchant/${id}/preview`);
      const data = await res.json();
      setSpec(data.widget_spec);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.warn(e);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchPreview(); }, [fetchPreview, iter]);

  // Auto-fade the rules banner after a few seconds.
  useEffect(() => {
    if (!showBanner) return;
    const t = setTimeout(() => setShowBanner(false), 4000);
    return () => clearTimeout(t);
  }, [showBanner]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <TouchableOpacity
          onPress={() => {
            // After router.replace from setup/rules there's no stack to pop —
            // route explicitly to the dashboard instead.
            if (fromSetup === '1' || fromRules === '1') {
              router.replace('/(merchant)/dashboard');
            } else {
              router.back();
            }
          }}
          hitSlop={10}
        >
          <Text style={{ color: theme.primary, fontSize: 15, fontWeight: '700' }}>
            {fromSetup === '1' || fromRules === '1' ? '→ Dashboard' : '← Back'}
          </Text>
        </TouchableOpacity>
        <View>
          <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textAlign: 'right' }}>
            PREVIEW
          </Text>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 }}>
            How customers see you
          </Text>
        </View>
      </View>

      <AnimatePresence>
        {showBanner && (
          <MotiView
            from={{ opacity: 0, translateY: -10 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0, translateY: -8 }}
            transition={{ type: 'spring', damping: 18 }}
            style={{
              backgroundColor: theme.primary, borderRadius: 14,
              paddingHorizontal: 14, paddingVertical: 10,
              marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8,
              shadowColor: theme.primary, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
            }}
          >
            <MotiView
              from={{ scale: 0.7, opacity: 0.5 }}
              animate={{ scale: 1.4, opacity: 1 }}
              transition={{ type: 'timing', duration: 800, loop: true }}
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' }}
            />
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800', flex: 1 }}>
              {bannerText}
            </Text>
          </MotiView>
        )}
      </AnimatePresence>

      {/* Phone-frame mockup — gives a tactile "device in hand" sense */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{
          width: PHONE_W + 18, height: PHONE_H + 18,
          backgroundColor: '#1F1F23', borderRadius: 38, padding: 9,
          shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 12 },
        }}>
          {/* Notch */}
          <View style={{
            position: 'absolute', top: 14, left: '50%', marginLeft: -45,
            width: 90, height: 22, borderRadius: 12, backgroundColor: '#000', zIndex: 2,
          }} />
          {/* Screen */}
          <View style={{
            flex: 1, backgroundColor: '#FFFFFF', borderRadius: 30, overflow: 'hidden',
            paddingTop: 28, paddingHorizontal: 8, paddingBottom: 8,
          }}>
            {loading ? (
              <View style={{ flex: 1 }}>
                <ShimmerCard />
                <LlmStatusPill verb="generiert" />
              </View>
            ) : spec ? (
              <MotiView
                key={iter}
                from={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', damping: 16 }}
                style={{ flex: 1 }}
              >
                <WidgetRenderer
                  spec={spec}
                  onAccept={() => Haptics.selectionAsync()}
                  onDecline={() => Haptics.selectionAsync()}
                />
              </MotiView>
            ) : null}
          </View>
        </View>
      </View>

      <TouchableOpacity
        onPress={() => setIter(i => i + 1)}
        disabled={loading}
        style={{
          backgroundColor: loading ? theme.primaryWash : theme.primary,
          borderRadius: 16, paddingVertical: 16,
          alignItems: 'center', marginTop: 14,
          shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
        }}
      >
        <Text style={{ color: theme.textOnPrimary, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 }}>
          ↻ Generate another example
        </Text>
      </TouchableOpacity>
      <Text style={{ color: theme.textMuted, fontSize: 11, textAlign: 'center', marginTop: 8 }}>
        This example isn't saved. Real offers only fire when a customer is nearby.
      </Text>
    </View>
  );
}
