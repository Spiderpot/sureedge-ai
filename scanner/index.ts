/**
 * SureEdge AI — Continuous Scanner Service
 * 
 * Runs on VPS with PM2. Scans every 10 seconds.
 * Sends Telegram alerts instantly when arb detected.
 * 
 * Deploy: pm2 start dist/index.js --name "sureedge-scanner"
 */

import https from 'https';

const CONFIG = {
  SCAN_INTERVAL_MS:    10_000,   // 10 seconds
  LIVE_INTERVAL_MS:     5_000,   // 5 seconds for live events
  IDLE_INTERVAL_MS:    30_000,   // 30 seconds when no live events
  MIN_ARB_YOUR_BOOKS:   0.5,     // % threshold for funded books
  MIN_ARB_NG:           1.5,     // % for NG accessible
  MIN_ARB_VPN:          3.0,     // % for VPN required
  TELEGRAM_BOT_TOKEN:   process.env.TELEGRAM_BOT_TOKEN ?? '',
  TELEGRAM_CHAT_ID:     process.env.TELEGRAM_CHAT_ID ?? '',
  ODDS_API_KEY:         process.env.ODDS_API_KEY ?? '',
  CRON_SECRET:          process.env.CRON_SECRET ?? 'sureedge-cron-2026',
  SUREEDGE_URL:         process.env.SUREEDGE_URL ?? 'https://sureedge-ai.vercel.app',
};

// Sport rotation — volatility ranked
const SPORTS = [
  'icehockey_nhl',
  'baseball_mlb', 
  'tennis_atp_french_open',
  'basketball_nba',
  'soccer_spain_la_liga',
  'soccer_germany_bundesliga',
  'soccer_italy_serie_a',
  'soccer_france_ligue_one',
  'soccer_epl',
  'mma_mixed_martial_arts',
];

// Track alerts to avoid duplicates (match + arb% within 5 minutes)
const recentAlerts = new Map<string, number>();

function dedupeKey(match: string, pct: number): string {
  return `${match}_${pct.toFixed(1)}`;
}

function isRecent(key: string): boolean {
  const ts = recentAlerts.get(key);
  if (!ts) return false;
  const age = Date.now() - ts;
  if (age > 5 * 60 * 1000) { recentAlerts.delete(key); return false; }
  return true;
}

async function fetchJSON(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { reject(new Error('JSON parse error')); }
      });
    }).on('error', reject);
  });
}

async function sendTelegram(msg: string): Promise<void> {
  if (!CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) return;
  const body = JSON.stringify({ chat_id: CONFIG.TELEGRAM_CHAT_ID, text: msg, parse_mode: 'HTML', disable_web_page_preview: true });
  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  };
  return new Promise((resolve) => {
    const req = https.request(options, () => resolve());
    req.on('error', () => resolve());
    req.write(body);
    req.end();
  });
}

async function scanSport(sport: string): Promise<void> {
  try {
    const url = `${CONFIG.SUREEDGE_URL}/api/cron/scan?secret=${CONFIG.CRON_SECRET}&sport=${sport}`;
    const result = await fetchJSON(url) as { success: boolean; data: { genuineArbs: number; topArbs: unknown[]; log: string[] } };
    
    if (!result.success) return;
    const data = result.data;
    
    // Log activity
    const timestamp = new Date().toLocaleTimeString('en-GB');
    console.log(`[${timestamp}] ${sport}: ${data.genuineArbs} arbs | Credits: ${data.log?.find(l => l.includes('left'))?.match(/(\d+) left/)?.[1] ?? '?'}`);

    // Alerts handled by the API endpoint — just log locally
    if (data.genuineArbs > 0) {
      console.log(`🚨 ALERT: ${data.genuineArbs} arbs found on ${sport}`);
      for (const arb of (data.topArbs ?? []) as { match: string; arbPercentage: number }[]) {
        console.log(`  → ${arb.match}: ${arb.arbPercentage?.toFixed(3)}%`);
      }
    }
  } catch (err) {
    console.error(`Scan error [${sport}]:`, err);
  }
}

let currentSportIndex = 0;
let scanCount = 0;

async function scan(): Promise<void> {
  const sport = SPORTS[currentSportIndex % SPORTS.length];
  currentSportIndex++;
  scanCount++;

  if (scanCount % 10 === 0) {
    const ts = new Date().toLocaleTimeString('en-GB');
    console.log(`[${ts}] ─── Scan #${scanCount} | Sport: ${sport} ───`);
  }

  await scanSport(sport);
}

// Start continuous scanning
console.log('🚀 SureEdge AI Scanner starting...');
console.log(`📡 Scanning every ${CONFIG.SCAN_INTERVAL_MS / 1000}s across ${SPORTS.length} sports`);
console.log(`🎯 Sports: ${SPORTS.join(', ')}`);
console.log('');

// Initial scan immediately
scan();

// Then every 10 seconds
setInterval(scan, CONFIG.SCAN_INTERVAL_MS);

// Heartbeat every 5 minutes
setInterval(() => {
  const ts = new Date().toISOString();
  console.log(`💓 Heartbeat [${ts}] | Scans: ${scanCount} | Sports: ${SPORTS.length}`);
}, 5 * 60 * 1000);
