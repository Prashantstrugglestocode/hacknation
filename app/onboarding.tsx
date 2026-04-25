import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Dimensions, ScrollView, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { markFirstLoginCompleted, useSession } from '../lib/auth';
import { theme } from '../lib/theme';

const { width, height } = Dimensions.get('window');

interface Slide {
  emoji: string;
  kicker: string;
  title: string;
  body: string;
  visual: 'card' | 'privacy' | 'merchant';
}

const SLIDES: Slide[] = [
  {
    emoji: '✨',
    kicker: 'KI · IN ECHTZEIT',
    title: 'Lokale Angebote, frisch generiert',
    body: 'Keine Liste. Kein Feed. Ein Angebot, passend zu Wetter, Tageszeit und Standort. Jedes Mal anders.',
    visual: 'card',
  },
  {
    emoji: '🔒',
    kicker: 'PRIVATSPHÄRE',
    title: 'Bleibt auf deinem Gerät',
    body: 'Wir senden nur eine grobe 1,2 km Zelle und abstrakte Absichts-Flags. Keine GPS-Spur, keine Werbe-IDs.',
    visual: 'privacy',
  },
  {
    emoji: '🏪',
    kicker: 'FÜR GESCHÄFTE',
    title: 'In 30 Sekunden zum ersten Angebot',
    body: 'Setze Ziel und Rabatt. KI schreibt Copy, wählt Layout und Mood. Du bekommst Live-Statistiken.',
    visual: 'merchant',
  },
];

function CardVisual() {
  return (
    <View style={{
      width: width * 0.7, height: width * 0.85, borderRadius: 22, overflow: 'hidden',
      shadowColor: theme.primary, shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 10 },
    }}>
      <LinearGradient colors={[theme.primary, theme.primaryDark] as any} style={{ height: '60%', padding: 18, justifyContent: 'flex-end' }}>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
          {['11°C', 'Drizzle', '12:14'].map((c, i) => (
            <MotiView key={i}
              from={{ opacity: 0, translateY: 6 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', damping: 14, delay: 200 + i * 100, loop: true, repeatReverse: true } as any}
              style={{ backgroundColor: '#FFFFFF33', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}
            >
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{c}</Text>
            </MotiView>
          ))}
        </View>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.4, lineHeight: 26 }}>
          Kalt draußen?{'\n'}Cappuccino wartet.
        </Text>
      </LinearGradient>
      <View style={{ flex: 1, backgroundColor: '#fff', padding: 16, justifyContent: 'space-between' }}>
        <View style={{ height: 24, backgroundColor: theme.bgMuted, borderRadius: 6 }} />
        <View style={{ height: 38, backgroundColor: theme.primary, borderRadius: 12 }} />
      </View>
    </View>
  );
}

function PrivacyVisual() {
  return (
    <View style={{ width: width * 0.8, gap: 12 }}>
      <View style={{
        backgroundColor: theme.surface, borderRadius: 16, padding: 16,
        borderWidth: 1, borderColor: theme.border,
      }}>
        <Text style={{ color: theme.success, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>✓ AUF DEM GERÄT</Text>
        <Text style={{ color: theme.text, fontSize: 13, marginTop: 6, lineHeight: 18 }}>
          exakte Position · Bewegung · Verlauf · Geräte-ID
        </Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
        <Text style={{ color: theme.textMuted, fontSize: 18 }}>↓</Text>
      </View>
      <View style={{
        backgroundColor: theme.primaryWash, borderRadius: 16, padding: 16,
        borderWidth: 1, borderColor: theme.primary + '44',
      }}>
        <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>↑ ZUM SERVER</Text>
        <Text style={{ color: theme.primaryDark, fontSize: 13, marginTop: 6, lineHeight: 18 }}>
          1,2 km Geohash-Zelle · &#123; rainy, cold, hungry &#125; · rotierender Hash
        </Text>
      </View>
    </View>
  );
}

function MerchantVisual() {
  return (
    <View style={{ width: width * 0.8, gap: 10 }}>
      {[
        { label: 'GENERIERT', value: '12' },
        { label: 'ANGENOMMEN', value: '9' },
        { label: 'EINGELÖST', value: '7' },
      ].map((s, i) => (
        <MotiView
          key={i}
          from={{ opacity: 0, translateX: -20 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: 'spring', damping: 16, delay: 200 + i * 120 }}
          style={{
            backgroundColor: theme.surface, borderRadius: 14, padding: 14,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            borderWidth: 1, borderColor: theme.border,
          }}
        >
          <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{s.label}</Text>
          <Text style={{ color: theme.primary, fontSize: 22, fontWeight: '900' }}>{s.value}</Text>
        </MotiView>
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const session = useSession();
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== page) {
      setPage(next);
      Haptics.selectionAsync();
    }
  };

  const finish = async () => {
    if (session?.user) await markFirstLoginCompleted(session.user.id);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/role');
  };

  const next = () => {
    if (page < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: width * (page + 1), animated: true });
    } else {
      finish();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Skip */}
      <View style={{ position: 'absolute', top: 12, right: 16, zIndex: 10 }}>
        <TouchableOpacity onPress={finish} hitSlop={12}>
          <Text style={{ color: theme.textMuted, fontSize: 14, fontWeight: '700' }}>Überspringen</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={{ width, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
            <View style={{ alignItems: 'center', marginBottom: 32 }}>
              {s.visual === 'card' && <CardVisual />}
              {s.visual === 'privacy' && <PrivacyVisual />}
              {s.visual === 'merchant' && <MerchantVisual />}
            </View>
            <View style={{ alignItems: 'center', gap: 10, paddingHorizontal: 8 }}>
              <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 }}>
                {s.kicker}
              </Text>
              <Text style={{ color: theme.text, fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5, lineHeight: 32 }}>
                {s.title}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 320 }}>
                {s.body}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Pagination dots */}
      <View style={{ flexDirection: 'row', alignSelf: 'center', gap: 6, paddingBottom: 20 }}>
        {SLIDES.map((_, i) => (
          <View key={i} style={{
            width: i === page ? 22 : 7, height: 7, borderRadius: 4,
            backgroundColor: i === page ? theme.primary : theme.border,
          }} />
        ))}
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: 36 }}>
        <TouchableOpacity
          onPress={next}
          style={{
            backgroundColor: theme.primary, borderRadius: 16, paddingVertical: 17, alignItems: 'center',
            shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
          }}
        >
          <Text style={{ color: theme.textOnPrimary, fontSize: 17, fontWeight: '800', letterSpacing: 0.3 }}>
            {page === SLIDES.length - 1 ? 'Los geht\'s' : 'Weiter'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
