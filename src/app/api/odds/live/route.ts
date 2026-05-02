export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const SPORT_KEYS: Record<string, string> = {
  football:   'soccer_epl',
  basketball: 'basketball_nba',
  tennis:     'tennis_atp_french_open',
  baseball:   'baseball_mlb',
  hockey:     'icehockey_nhl',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport    = searchParams.get('sport') || 'football';
    const sportKey = SPORT_KEYS[sport] ?? 'soccer_epl';
    const apiKey   = process.env.ODDS_API_KEY;

    if (!apiKey) {
      return success({
        events: [],
        updatedAt: new Date().toISOString(),
        message: 'ODDS_API_KEY not configured',
        demoMode: true,
      });
    }

    const url = `${ODDS_API_BASE}/sports/${sportKey}/odds?` + new URLSearchParams({
      apiKey,
      regions:    'uk,us,eu',
      markets:    'h2h',
      oddsFormat: 'decimal',
      dateFormat: 'iso',
    });

    const res = await fetch(url, { next: { revalidate: 30 } });

    if (!res.ok) {
      if (res.status === 401) return error('Invalid ODDS_API_KEY', 401);
      if (res.status === 422) return success({ events: [], updatedAt: new Date().toISOString() });
      return error('Odds API error', res.status);
    }

    const events = await res.json();

    // Reshape for frontend consumption
    const shaped = events.slice(0, 10).map((event: {
      id: string; home_team: string; away_team: string;
      sport_title: string; commence_time: string;
      bookmakers: { title: string; markets: { key: string; outcomes: { name: string; price: number }[] }[] }[];
    }) => {
      const h2hByBook = event.bookmakers
        .map((bm: typeof event.bookmakers[0]) => {
          const market = bm.markets.find(m => m.key === 'h2h');
          if (!market) return null;
          const outcomes: Record<string, number> = {};
          for (const o of market.outcomes) outcomes[o.name] = o.price;
          return { bookmaker: bm.title, ...outcomes };
        })
        .filter(Boolean);

      // Best odds for each team
      const bestHome = h2hByBook.reduce<{ bookmaker: string; price: number } | null>((best, bm) => {
        if (!bm) return best;
        const price = ((bm as Record<string, unknown>)[event.home_team] as number) ?? 0;
        return (!best || price > best.price) ? { bookmaker: bm.bookmaker, price } : best;
      }, null);

      const bestAway = h2hByBook.reduce<{ bookmaker: string; price: number } | null>((best, bm) => {
        if (!bm) return best;
        const price = ((bm as Record<string, unknown>)[event.away_team] as number) ?? 0;
        return (!best || price > best.price) ? { bookmaker: bm.bookmaker, price } : best;
      }, null);

      const arbCheck = bestHome && bestAway
        ? (1 / bestHome.price) + (1 / bestAway.price)
        : 999;

      return {
        id:          event.id,
        home:        event.home_team,
        away:        event.away_team,
        sport:       event.sport_title,
        startTime:   event.commence_time,
        bookmakers:  h2hByBook,
        bestHome,
        bestAway,
        hasSurebet:  arbCheck < 1.0,
        arbMargin:   arbCheck < 1.0 ? parseFloat(((1 - arbCheck) * 100).toFixed(2)) : 0,
      };
    });

    return success({ events: shaped, updatedAt: new Date().toISOString(), sport });
  } catch (err) {
    console.error('Live odds error:', err);
    return error('Failed to fetch live odds', 500);
  }
}
