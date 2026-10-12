import { listDrinks } from '@/repositories';
import { rankForWeather } from '@/services/catalog';
import { fetchWeather } from '@/lib/openmeteo';
import { DEFAULT_STORE } from '@/data/stores';
import { fail, ok } from '@/lib/http';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    // Absent falls back to the default bar; 0 is a real coordinate, not absence.
    const coord = (raw: string | null, fallback: number, limit: number) => {
      const n = raw === null || raw === '' ? NaN : Number(raw);
      return Number.isFinite(n) && Math.abs(n) <= limit ? n : fallback;
    };
    const lat = coord(url.searchParams.get('lat'), DEFAULT_STORE.lat, 90);
    const lng = coord(url.searchParams.get('lng'), DEFAULT_STORE.lng, 180);
    const mood = url.searchParams.get('mood');

    const [drinks, weather] = await Promise.all([listDrinks(), fetchWeather(lat, lng)]);
    let picks = drinks.filter((d) => d.isAvailable);

    if (weather) picks = rankForWeather(picks, weather.suggestion);
    if (mood === 'strong') picks = [...picks].sort((a, b) => b.intensity - a.intensity);
    if (mood === 'gentle') picks = [...picks].sort((a, b) => a.intensity - b.intensity);

    return ok({ weather, picks: picks.slice(0, 4) });
  } catch (err) {
    return fail(err);
  }
}
