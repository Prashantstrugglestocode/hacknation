export interface WeatherData {
  temp_c: number;
  condition: string;
  description: string;
  icon: string;
  source: 'open-meteo';
}

function mapWMOCodeToCondition(code: number): string {
  if (code === 0) return 'Clear';
  if (code === 1 || code === 2 || code === 3) return 'Clouds';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain';
  if (code >= 85 && code <= 86) return 'Snow';
  if (code >= 95 && code <= 99) return 'Thunderstorm';
  return 'Clear';
}

function mapWMOCodeToDescription(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 85 && code <= 86) return 'Snow showers';
  if (code >= 95 && code <= 99) return 'Thunderstorm';
  return 'Clear sky';
}

export async function getWeather(lat: number, lng: number): Promise<WeatherData> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error('Weather API error');
    const data = await res.json() as any;
    
    if (!data.current) throw new Error('Invalid response');
    
    const condition = mapWMOCodeToCondition(data.current.weather_code);
    
    return {
      temp_c: Math.round(data.current.temperature_2m),
      condition,
      description: mapWMOCodeToDescription(data.current.weather_code),
      icon: '',
      source: 'open-meteo',
    };
  } catch (err) {
    console.warn('Failed to fetch weather from Open-Meteo:', err);
    return { temp_c: 15, condition: 'Clear', description: 'clear sky', icon: '', source: 'open-meteo' };
  }
}
