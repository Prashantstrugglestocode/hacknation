import { Platform } from 'react-native';

export type WeatherCondition = 'Clear' | 'Clouds' | 'Rain' | 'Drizzle' | 'Snow' | 'Thunderstorm' | 'Fog';

export interface WeatherData {
  tempC: number;
  condition: WeatherCondition;
}

/**
 * Maps WMO weather codes from Open-Meteo to our internal WeatherCondition enum
 * https://open-meteo.com/en/docs
 */
function mapWMOCodeToCondition(code: number): WeatherCondition {
  if (code === 0) return 'Clear';
  if (code === 1 || code === 2 || code === 3) return 'Clouds';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain'; // Showers count as rain for intent
  if (code >= 85 && code <= 86) return 'Snow';
  if (code >= 95 && code <= 99) return 'Thunderstorm';
  
  return 'Clear'; // Default fallback
}

/**
 * Fetches current weather from Open-Meteo API without requiring an API key.
 * Features a 4-second timeout to ensure the app stays responsive.
 */
export async function getClientWeather(lat: number, lng: number): Promise<WeatherData> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`;
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.current) {
      throw new Error('Invalid response format from weather API');
    }

    return {
      tempC: Math.round(data.current.temperature_2m),
      condition: mapWMOCodeToCondition(data.current.weather_code)
    };
  } catch (error) {
    console.warn('Failed to fetch weather, using fallback:', error);
    // Fallback to average nice weather to ensure the app still functions
    return {
      tempC: 15,
      condition: 'Clear'
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
