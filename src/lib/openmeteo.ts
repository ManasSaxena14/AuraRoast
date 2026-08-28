/**
 * Weather (Blueprint §6.4). Free, no API key, no signup, CORS-enabled.
 * Cached on a 0.1° grid for an hour — the weather does not change faster than
 * that, and neither should our request volume.
 */
import { getWeatherCache, putWeatherCache } from '@/repositories';

export interface WeatherNow {
  temperatureC: number;
  apparentC: number;
  isDay: boolean;
  code: number;
  description: string;
  /** What the weather suggests we surface first. */
  suggestion: 'iced' | 'cold-brew' | 'dark-roast' | 'balanced';
  headline: string;
}

const CACHE_TTL_MS = 60 * 60 * 1000;

const WMO: Record<number, string> = {
  0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow',
  75: 'Heavy snow', 80: 'Showers', 81: 'Showers', 82: 'Violent showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail',
};

function gridKey(lat: number, lng: number): string {
  return `${lat.toFixed(1)},${lng.toFixed(1)}`;
}

export async function fetchWeather(lat: number, lng: number): Promise<WeatherNow | null> {
  const key = gridKey(lat, lng);
  const cached = await getWeatherCache(key, CACHE_TTL_MS);
  if (cached) return cached as WeatherNow;

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?` +
      new URLSearchParams({
        latitude: String(lat),
        longitude: String(lng),
        current: 'temperature_2m,apparent_temperature,is_day,weather_code',
        timezone: 'auto',
      });
    const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      current: {
        temperature_2m: number;
        apparent_temperature: number;
        is_day: number;
        weather_code: number;
      };
    };

    const temp = data.current.temperature_2m;
    const apparent = data.current.apparent_temperature;
    const code = data.current.weather_code;

    const suggestion: WeatherNow['suggestion'] =
      apparent >= 32 ? 'iced' : apparent >= 27 ? 'cold-brew' : apparent <= 18 ? 'dark-roast' : 'balanced';

    const out: WeatherNow = {
      temperatureC: temp,
      apparentC: apparent,
      isDay: data.current.is_day === 1,
      code,
      description: WMO[code] ?? 'Unsettled',
      suggestion,
      headline: headlineFor(suggestion, Math.round(apparent)),
    };
    await putWeatherCache(key, out);
    return out;
  } catch {
    return null;
  }
}

function headlineFor(s: WeatherNow['suggestion'], feels: number): string {
  switch (s) {
    case 'iced':
      return `${feels}° out there. We are putting the iced lots up front.`;
    case 'cold-brew':
      return `${feels}° and warm. Cold brew is the honest answer today.`;
    case 'dark-roast':
      return `${feels}° and cool. Something darker, something with weight.`;
    default:
      return `${feels}°. A good day to drink whatever you actually want.`;
  }
}
