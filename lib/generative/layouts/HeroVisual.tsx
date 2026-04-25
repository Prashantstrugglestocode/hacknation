import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WidgetSpecType } from '../widget-spec';

interface Props {
  spec: WidgetSpecType;
  height: number | `${number}%`;
  children?: React.ReactNode;
}

// Heuristic: pick a symbol from hero.value or merchant type/inventory
function pickSymbol(spec: WidgetSpecType): string {
  const v = (spec.hero?.value ?? '').toLowerCase();
  // If hero.value is already an emoji (1-2 chars, likely emoji), use it
  if (v.length > 0 && v.length <= 4 && /\p{Emoji}/u.test(v)) return v;

  // map keywords to emoji
  const map: Array<[RegExp, string]> = [
    [/coffee|cappuccino|espresso|latte|kaffee/i, '☕'],
    [/tea|tee/i, '🫖'],
    [/beer|bier/i, '🍺'],
    [/wine|wein/i, '🍷'],
    [/cocktail|drink/i, '🍸'],
    [/cake|kuchen|torte/i, '🍰'],
    [/croissant|brot|brötchen|bread|bakery|bäckerei/i, '🥐'],
    [/pizza/i, '🍕'],
    [/burger/i, '🍔'],
    [/sandwich/i, '🥪'],
    [/salad|salat/i, '🥗'],
    [/sushi/i, '🍣'],
    [/ice|eis/i, '🍦'],
    [/book|buch/i, '📚'],
    [/cinema|kino/i, '🎬'],
    [/music|musik/i, '🎵'],
    [/concert|konzert/i, '🎫'],
    [/clothing|fashion|kleidung/i, '👕'],
    [/flower|blume/i, '🌷'],
    [/restaurant/i, '🍽️'],
    [/bar/i, '🍺'],
    [/café|cafe/i, '☕'],
  ];
  for (const [re, emoji] of map) {
    if (re.test(v) || re.test((spec.merchant?.name ?? '').toLowerCase()) || re.test((spec.merchant as any)?.type ?? '')) {
      return emoji;
    }
  }
  return '✨';
}

export default function HeroVisual({ spec, height, children }: Props) {
  const { palette, hero } = spec;
  const colors = [palette.accent, palette.bg] as const;
  const symbol = pickSymbol(spec);

  const containerStyle = {
    height: height as any,
    overflow: 'hidden' as const,
  };

  // If a real photo is available, layer it under the gradient for richness
  const photoUrl = (spec as any).hero_image_url as string | undefined;
  const PhotoLayer = photoUrl ? (
    <Image
      source={{ uri: photoUrl }}
      style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
      resizeMode="cover"
      blurRadius={hero.type === 'pattern' ? 4 : 0}
    />
  ) : null;

  const ScrimColors = [palette.bg + '00', palette.bg + 'BB', palette.bg + 'EE'] as const;

  if (hero.type === 'gradient') {
    return (
      <View style={[containerStyle, { backgroundColor: palette.bg }]}>
        {PhotoLayer}
        <LinearGradient
          colors={photoUrl ? ScrimColors : colors}
          style={[StyleSheet.absoluteFill, { padding: 22, justifyContent: 'flex-end' }]}
        >
          {children}
        </LinearGradient>
      </View>
    );
  }

  if (hero.type === 'icon') {
    return (
      <View style={[containerStyle, { backgroundColor: palette.bg }]}>
        {PhotoLayer}
        <LinearGradient
          colors={photoUrl ? ScrimColors : colors}
          style={[StyleSheet.absoluteFill, { padding: 22, justifyContent: 'flex-end' }]}
        >
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Text style={{
              fontSize: 220, lineHeight: 220, opacity: 0.18,
              position: 'absolute', right: -20, top: -30,
              transform: [{ rotate: '-12deg' }],
            }}>
              {symbol}
            </Text>
          </View>
          {children}
        </LinearGradient>
      </View>
    );
  }

  // pattern: tiled small symbols
  const cols = 6;
  const rows = 5;
  const cells = Array.from({ length: cols * rows });
  return (
    <View style={[containerStyle, { backgroundColor: palette.bg }]}>
      {PhotoLayer}
      <LinearGradient
        colors={photoUrl ? ScrimColors : colors}
        style={[StyleSheet.absoluteFill, { padding: 22, justifyContent: 'flex-end' }]}
      >
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { flexDirection: 'row', flexWrap: 'wrap' }]}>
          {cells.map((_, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const offsetX = (row % 2) * 12;
            return (
              <View key={i} style={{
                width: `${100 / cols}%`,
                height: `${100 / rows}%`,
                alignItems: 'center', justifyContent: 'center',
                transform: [{ translateX: offsetX }, { rotate: `${(row + col) % 2 === 0 ? -8 : 8}deg` }],
              }}>
                <Text style={{ fontSize: 28, opacity: 0.14 }}>{symbol}</Text>
              </View>
            );
          })}
        </View>
        {children}
      </LinearGradient>
    </View>
  );
}
