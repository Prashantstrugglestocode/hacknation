import { Accelerometer } from 'expo-sensors';

export type MovementMode = 'stationary' | 'browsing' | 'walking' | 'transit';

// Sample accelerometer briefly and classify
export async function detectMovement(durationMs = 1500, intervalMs = 80): Promise<MovementMode> {
  return new Promise((resolve) => {
    const samples: number[] = [];
    Accelerometer.setUpdateInterval(intervalMs);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      // magnitude minus gravity (~1g resting)
      const mag = Math.sqrt(x * x + y * y + z * z);
      samples.push(Math.abs(mag - 1));
    });
    setTimeout(() => {
      sub.remove();
      if (samples.length === 0) return resolve('stationary');
      // Average jitter
      const avg = samples.reduce((s, v) => s + v, 0) / samples.length;
      // Heuristic thresholds:
      //  < 0.04 → phone in pocket / on table → stationary
      //  0.04 – 0.15 → handheld, slow → browsing
      //  0.15 – 0.45 → walking
      //  > 0.45 → transit / vehicle
      let mode: MovementMode = 'stationary';
      if (avg > 0.45) mode = 'transit';
      else if (avg > 0.15) mode = 'walking';
      else if (avg > 0.04) mode = 'browsing';
      resolve(mode);
    }, durationMs);
  });
}
