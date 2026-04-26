import AsyncStorage from '@react-native-async-storage/async-storage';
import { WeatherCondition } from './weather';

const DEMO_MODE_KEY = '@citywallet_demo_mode';

export async function isDemoMode(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(DEMO_MODE_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function setDemoMode(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(DEMO_MODE_KEY, on ? 'true' : 'false');
  } catch (err) {
    console.error('Failed to set demo mode', err);
  }
}

export interface DemoOverrides {
  weatherCondition: WeatherCondition;
  tempC: number;
  movement: 'stationary' | 'walking' | 'running' | 'automotive' | 'cycling' | 'browsing' | undefined;
}

export function getDemoOverrides(): DemoOverrides {
  return {
    weatherCondition: 'Rain',
    tempC: 8,
    movement: 'browsing',
  };
}
