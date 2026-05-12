import { DetectedArb } from './arb-detector';

const BOT = 'https://api.telegram.org/bot';

export async function sendTelegramAlert(msg: string): Promise<boolean> {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  try {
    const r = await fetch(`${BOT}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    return r.ok;
  } catch { return false; }
}

export function formatArbAlert(arb: DetectedArb): string {
  const now = new Date().toISOString();

  // Header based on tier
  const header = arb.tier === 'EXECUTE'    ? '\u{1F6A8} SUREEDGE LIVE ALERT' :
                 arb.tier === 'VERIFY'     ? '\u26A0\uFE0F SUREEDGE ALERT — VERIFY FIRST' :
                 arb.tier === 'SUSPICIOUS' ? '\u{1F534} SUSPICIOUS — DO NOT BET' :
                                             '\u{1F4CA} SUREEDGE DIVERGENCE ALERT';

  const voltEmoji = arb.volatility === 'HIGH' ? '\u{1F525}' :
                    arb.volatility === 'MEDIUM' ? '\u26A1' : '\u{1F4C9}';

  const divType = arb.divergenceType === 'PINNACLE_LAG'    ? 'Pinnacle lag detected' :
                  arb.divergenceType === 'SHARP_MOVEMENT'  ? 'Sharp movement detected' :
                  arb.divergenceType === 'ARBITRAGE'       ? 'True arbitrage found' :
                  'Price divergence detected';

  let msg = `<b>${header}</b>\n\n`;
  msg += `${arb.accessTag}\n`;
  msg += `\u{1F3C6} <b>${arb.match}</b>\n`;
  msg += `${arb.sport}\n\n`;

  // Intelligence summary
  msg += `\u{1F9E0} <b>EDGE SCORE: ${arb.edgeScore}/100</b>\n`;
  msg += `${voltEmoji} Volatility: <b>${arb.volatility}</b>\n`;
  msg += `\u{1F4CA} Divergence: <b>+${arb.arbPercentage.toFixed(2)}%</b>\n`;
  msg += `\u2728 Signal: ${divType}\n`;
  msg += `\u{1F513} Confidence: ${arb.confidence}%\n`;
  msg += `\u{23F1} Freshness: ${now.slice(11, 19)} UTC\n\n`;

  if (arb.tier !== 'SUSPICIOUS') {
    if (arb.isGenuineArb) {
      msg += `\u{1F4B0} <b>GUARANTEED PROFIT: $${arb.profit.toFixed(2)} on $10</b>\n\n`;
    }

    msg += `<b>PLACE BETS:</b>\n`;
    const sorted = [...arb.outcomes].sort((a, b) => b.odds - a.odds);
    for (let i = 0; i < sorted.length; i++) {
      const o   = sorted[i];
      const acc = o.isFunded ? '\u2705' : '\u{1F310}';
      const pin = o.isPinnacle ? ' \u{1F4A0}' : '';
      msg += `\n${i === 0 ? '\u{1F534} BET 1 (FIRST)' : `\u{1F535} BET ${i + 1}`} ${acc}${pin}\n`;
      msg += `<b>${o.bookmaker}</b>\n`;
      msg += `${o.outcome} @ <b>${o.odds}</b>\n`;
      msg += `Stake: <b>$${o.stakeRounded}</b> \u2192 $${o.potentialReturn.toFixed(2)}\n`;
      if (o.deposit) msg += `${o.deposit}\n`;
      if (o.url)     msg += `${o.url}\n`;
    }
  } else {
    msg += `<b>DO NOT BET — verify on live sites first:</b>\n`;
    for (const o of arb.outcomes) {
      msg += `${o.bookmaker}: ${o.outcome} @ ${o.odds}\n`;
      if (o.url) msg += `${o.url}\n`;
    }
  }

  for (const w of arb.warnings) msg += `\n\u26A0\uFE0F ${w}`;
  msg += `\n\n\u23F0 ~5 min window\n`;
  msg += `\u{1F517} <a href="https://sureedge-ai.vercel.app">SureEdge AI</a>`;
  return msg;
}
