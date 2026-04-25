export interface WeatherData {
  temp_c: number;
  condition: string;
  description: string;
  icon: string;
  source: 'owm' | 'dwd';
}

// DWD via Brightsky (no key, GDPR-friendly, wraps DWD open data)
// https://brightsky.dev/docs/
async function getWeatherDWD(lat: number, lng: number): Promise<WeatherData | null> {
  try {
    const url = `https://api.brightsky.dev/current_weather?lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const w = data.weather;
    if (!w) return null;

    // Map DWD condition codes to OWM-style condition strings
    const condition = mapDWDCondition(w.condition ?? w.icon ?? 'dry');

    return {
      temp_c: Math.round(w.temperature ?? 15),
      condition,
      description: w.condition ?? condition,
      icon: w.icon ?? '',
      source: 'dwd',
    };
  } catch {
    return null;
  }
}

function mapDWDCondition(dwdCondition: string): string {
  const map: Record<string, string> = {
    dry: 'Clear',
    fog: 'Fog',
    rain: 'Rain',
    sleet: 'Sleet',
    snow: 'Snow',
    hail: 'Hail',
    thunderstorm: 'Thunderstorm',
    'partly-cloudy': 'Clouds',
    cloudy: 'Clouds',
    night: 'Clear',
    'partly-cloudy-night': 'Clouds',
    overcast: 'Clouds',
    drizzle: 'Drizzle',
    mist: 'Mist',
  };
  return map[dwdCondition.toLowerCase()] ?? 'Clear';
}

// OpenWeatherMap (primary when key available)
async function getWeatherOWM(lat: number, lng: number, key: string): Promise<WeatherData | null> {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${key}&units=metric`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = await res.json() as any;
    return {
      temp_c: Math.round(data.main.temp),
      condition: data.weather[0]?.main ?? 'Clear',
      description: data.weather[0]?.description ?? '',
      icon: data.weather[0]?.icon ?? '',
      source: 'owm',
    };
  } catch {
    return null;
  }
}

export async function getWeather(lat: number, lng: number): Promise<WeatherData> {
  const key = process.env.OPENWEATHER_API_KEY;

  // Try OWM first if key provided, fall back to DWD Brightsky
  if (key) {
    const owm = await getWeatherOWM(lat, lng, key);
    if (owm) return owm;
  }

  const dwd = await getWeatherDWD(lat, lng);
  if (dwd) return dwd;

  // Last resort: neutral default so generation still proceeds
  return { temp_c: 15, condition: 'Clear', description: 'clear sky', icon: '', source: 'dwd' };
}
