import React, { useEffect, useRef, useState } from 'react';
import { Text, TextStyle } from 'react-native';

interface Props {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  style?: TextStyle | TextStyle[];
}

export default function AnimatedNumber({ value, format = (n) => Math.round(n).toString(), duration = 700, style }: Props) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    let raf: number;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      // ease-out cubic
      const e = 1 - Math.pow(1 - t, 3);
      const v = from + (to - from) * e;
      setDisplay(v);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <Text style={style}>{format(display)}</Text>;
}
