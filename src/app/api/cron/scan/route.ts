export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { sendTelegramAlert } from '@/lib/telegram';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const SPORT_ROTATION = ['basketball_nba', 'soccer_epl', 'baseball_mlb'];

// Minimum arb % to alert
const MIN_ARB_PCT = 0.5;

// Your funded bookmakers — arbs with BOTH from this list get priority
const FUNDED = new Set(['pinnacle', '1xbet', 'onexbet', '22bet']);

// Nigeria-accessible (no VPN) 
const NG_ACCESSIBLE = new Set([
  'pinnacle', '1xbet', 'onexbet', '22bet', 'betway', 'bet9ja',
  'sportybet', 'msport', 'melbet', 'betwinner', 'marathonbet',
  'betonlineag', 'bovada', 'mybookieag', 'betus', 'sport888',
]);

interface Outcome { name: string; price: number }
interface Market { key: string; outcomes: Outcome[] }
interface Bookmaker { key: string; title: string; markets: Market[] }
interface Event {
  id: string; sport_key: string; sport_title: string;
  commence_time: string; home_team: string; away_team: string;
  bookmakers: Bookmaker[];
}

function detectArbitrage(event: Event) {
  if (event.bookmakers.length < 2) return [];

  // Find best odds across ALL bookmakers (not filtered)
  const bestOdds: Record<string, { odds: number; key: string; title: string }> = {};
  for (const bm of event.bookmakers) {
    const market = bm.markets.find(m => m.key === 'h2h');
    if (!market) continue;
    for (const o of market.outcomes) {
      if (o.price <= 1.01) continue;
      if (!bestOdds[o.name] || o.price > bestOdds[o.name].odds) {
        bestOdds[o.name] = { odds: o.price, key: bm.key, title: bm.title };
      }
    }
  }

  const outcomes = Object.entries(bestOdds);
  if (outcomes.length < 2) return [];

  const arbFraction = outcomes.reduce((sum, [, o]) => sum + 1 / o.odds, 0);
  const arbPct = parseFloat(((1 - arbFraction) * 100).toFixed(3));

  if (arbFraction >= 1.05) return [];
  if (arbPct < MIN_ARB_PCT && arbFraction >= 1.0) return [];

  const bothFunded = outcomes.every(([, o]) => FUNDED.has(o.key.toLowerCase()));
  const bothNG = outcomes.every(([, o]) => NG_ACCESSIBLE.has(o.key.toLowerCase()));
  const hasPinnacle = outcomes.some(([, o]) => o.key.toLowerCase() === 'pinnacle');

  // Tag for user clarity
  let accessTag: string;
  if (bothFunded) accessTag = 'YOUR ACCOUNTS';
  else if (bothNG) accessTag = 'NG ACCESSIBLE';
  else accessTag = 'VPN NEEDED';

  return [{
    match:         `${event.home_team} vs ${event.away_team}`,
    sport:         event.sport_title,
    arbPercentage: arbPct,
    isGenuineArb:  arbFraction < 1.0,
    hasPinnacle,
    accessTag,
    bothFunded,
    outcomes: outcomes.map(([name, o]) => ({
      outcome:    name,
      odds:       o.odds,
      bookmaker:  o.title,
      key:        o.key,
      isFunded:   FUNDED.has(o.key.toLowerCase()),
      isNG:       NG_ACCESSIBLE.has(o.key.toLowerCase()),
    })),
  }];
}

function formatAlert(arb: ReturnType<typeof detectArbitrage>[0]): string {
  const icon = arb.isGenuineArb ? '\u{1F7E2}' : '\u{1F7E1}';
  const tag = arb.accessTag === 'YOUR ACCOUNTS' ? '\u{2705} YOUR BOOKS' :
              arb.accessTag === 'NG ACCESSIBLE' ? '\u{1F1F3}\u{1F1EC} NG' :
              '\u{1F310} VPN';

  const arbFraction = arb.outcomes.reduce((sum, o) => sum + 1 / o.odds, 0);
  const totalStake = 10;

  let msg = `${icon} <b>SUREBET ${arb.arbPercentage.toFixed(2)}%</b> [${tag}]\n`;
  msg += `<b>${arb.match}</b>\n`;
  msg += `${arb.sport}\n\n`;

  for (const o of arb.outcomes) {
    const stake = ((1 / o.odds / arbFraction) * totalStake).toFixed(2);
    const ret = (parseFloat(stake) * o.odds).toFixed(2);
    const funded = o.isFunded ? ' \u{2705}' : o.isNG ? ' \u{1F1F3}\u{1F1EC}' : ' \u{1F310}';
    msg += `\u{1F4CC} <b>${o.bookmaker}</b>${funded}\n`;
    msg += `   ${o.outcome} @ <b>${o.odds}</b>\n`;
    msg += `   Stake: $${stake} \u{2192} $${ret}\n\n`;
  }

  msg += `\u{1F4B0} Profit: <b>$${(totalStake * arb.arbPercentage / 100).toFixed(2)}</b> on $${totalStake}\n`;
  msg += `\u{23F0} Act fast — ~5 min window\n`;
  msg += `\u{1F517} <a href="https://sureedge-ai.vercel.app">Open SureEdge</a>`;

  return msg;
}

export async function GET(request: NextRequest) {
  const authHeader  = request.headers.get('authorization');
  const cronSecret  = process.env.CRON_SECRET;
  const querySecret = new URL(request.url).searchParams.get('secret');
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const isAuthed = cronSecret && (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret);

  if (!isVercelCron && !isAuthed && cronSecret) {
    return error('Unauthorized', 401);
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return error('ODDS_API_KEY not configured', 500);

  const minuteOfDay = new Date().getHours() * 60 + new Date().getMinutes();
  const rotationIndex = Math.floor(minuteOfDay / 15) % SPORT_ROTATION.length;
  const sportKey = SPORT_ROTATION[rotationIndex];

  const log: string[] = [];
  log.push(`Scanning: ${sportKey}`);

  let quotaUsed = 0;
  let quotaRemaining = 0;
  const allArbs: ReturnType<typeof detectArbitrage> = [];

  try {
    // ALL 4 REGIONS — this is what found the big arbs before
    const url = `${ODDS_API_BASE}/sports/${sportKey}/odds?` + new URLSearchParams({
      apiKey,
      regions:    'us,uk,eu,au',
      markets:    'h2h',
      oddsFormat: 'decimal',
      dateFormat: 'iso',
    });

    const res = await fetch(url, { cache: 'no-store' });
    quotaUsed      = parseInt(res.headers.get('x-requests-used') ?? '0', 10);
    quotaRemaining = parseInt(res.headers.get('x-requests-remaining') ?? '0', 10);

    log.push(`Credits: ${quotaUsed} used, ${quotaRemaining} left`);

    if (quotaRemaining < 5) {
      log.push('PAUSED — credits critically low');
      return success({ scannedAt: new Date().toISOString(), paused: true, quotaRemaining, log });
    }

    if (!res.ok) {
      log.push(`API error: ${res.status}`);
      return success({ scannedAt: new Date().toISOString(), error: res.status, log });
    }

    const events: Event[] = await res.json();
    log.push(`${sportKey}: ${events.length} events, ${events.reduce((s, e) => s + e.bookmakers.length, 0)} bookmakers`);

    for (const event of events) {
      allArbs.push(...detectArbitrage(event));
    }
  } catch (e) {
    log.push(`Error: ${String(e)}`);
  }

  // Sort: your funded books first, then by arb %
  allArbs.sort((a, b) => {
    if (a.bothFunded !== b.bothFunded) return a.bothFunded ? -1 : 1;
    return b.arbPercentage - a.arbPercentage;
  });

  let telegramSent = 0;

  // Send alerts for ALL genuine arbs above threshold
  for (const arb of allArbs) {
    if (arb.isGenuineArb && arb.arbPercentage >= MIN_ARB_PCT) {
      if (await sendTelegramAlert(formatAlert(arb))) telegramSent++;
    }
  }

  log.push(`Arbs: ${allArbs.filter(a => a.isGenuineArb).length} genuine, ${allArbs.length} total, Telegram: ${telegramSent}`);

  return success({
    scannedAt:      new Date().toISOString(),
    sport:          sportKey,
    totalArbs:      allArbs.length,
    genuineArbs:    allArbs.filter(a => a.isGenuineArb).length,
    yourBooksArbs:  allArbs.filter(a => a.bothFunded).length,
    ngArbs:         allArbs.filter(a => a.accessTag === 'NG ACCESSIBLE').length,
    vpnArbs:        allArbs.filter(a => a.accessTag === 'VPN NEEDED').length,
    telegramSent,
    quotaUsed,
    quotaRemaining,
    log,
  });
}
