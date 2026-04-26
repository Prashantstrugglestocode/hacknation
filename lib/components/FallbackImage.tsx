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

// <Image> with a graceful onError fallback. loremflickr is occasionally slow
// or 404s — without this the user sees an empty grey square. With it they
// see a tinted block + emoji that still reads as "this is a product".
export default function FallbackImage({
  uri,
  style,
  fallbackEmoji = '🍽',
  fallbackBg = theme.bgMuted,
  resizeMode = 'cover',
}: Props) {
  const [failed, setFailed] = useState(false);

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
