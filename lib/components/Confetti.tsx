import React from 'react';
import { View, Dimensions } from 'react-native';
import { MotiView } from 'moti';
import { theme } from '../theme';

const { width, height } = Dimensions.get('window');
const COLORS = theme.accents as readonly string[];

interface Particle {
  id: number;
  startX: number;
  endX: number;
  endY: number;
  rotate: number;
  color: string;
  size: number;
  delay: number;
}

function makeParticles(n: number): Particle[] {
  const cx = width / 2;
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    startX: cx + (Math.random() - 0.5) * 40,
    endX: cx + (Math.random() - 0.5) * width * 1.1,
    endY: height * 0.55 + (Math.random() - 0.5) * 200,
    rotate: (Math.random() - 0.5) * 720,
    color: COLORS[i % COLORS.length],
    size: 6 + Math.random() * 8,
    delay: Math.random() * 80,
  }));
}

export default function Confetti({ trigger }: { trigger: number }) {
  if (!trigger) return null;
  const particles = React.useMemo(() => makeParticles(28), [trigger]);

  return (
    <View pointerEvents="none" style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50,
    }}>
      {particles.map((p) => (
        <MotiView
          key={`${trigger}-${p.id}`}
          from={{ opacity: 1, translateX: p.startX, translateY: 80, rotate: '0deg', scale: 0.6 }}
          animate={{ opacity: 0, translateX: p.endX, translateY: p.endY, rotate: `${p.rotate}deg`, scale: 1 }}
          transition={{ type: 'timing', duration: 1100, delay: p.delay }}
          style={{
            position: 'absolute',
            width: p.size, height: p.size * 1.4,
            backgroundColor: p.color,
            borderRadius: 2,
          }}
        />
      ))}
    </View>
  );
}
