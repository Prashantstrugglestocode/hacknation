import React, { useState } from 'react';
import { View, Text, Image, ImageStyle, StyleProp } from 'react-native';
import { theme } from '../theme';

interface Props {
  uri: string;
  style: StyleProp<ImageStyle>;
  // Emoji to render if the image fails (defaults to 🍽).
  fallbackEmoji?: string;
  // Background tone for the fallback block.
  fallbackBg?: string;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

// Pollinations / real images render normally; legacy loremflickr/placeholder
// URIs are short-circuited to the brand fallback (tinted block + emoji).
export default function FallbackImage({
  uri,
  style,
  fallbackEmoji = '🍽',
  fallbackBg = theme.bgMuted,
  resizeMode = 'cover',
}: Props) {
  const isLegacyPlaceholder = typeof uri === 'string' && /loremflickr|placekitten|placehold/.test(uri);
  const [failed, setFailed] = useState(isLegacyPlaceholder);

  if (failed) {
    return (
      <View style={[
        { backgroundColor: fallbackBg, alignItems: 'center', justifyContent: 'center' },
        style as any,
      ]}>
        <Text style={{ fontSize: 22 }}>{fallbackEmoji}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode={resizeMode}
      onError={() => setFailed(true)}
    />
  );
}
