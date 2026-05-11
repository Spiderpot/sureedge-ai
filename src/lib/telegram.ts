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
  const emoji = arb.tier === 'EXECUTE'    ? '\u{1F525}' :
                arb.tier === 'VERIFY'     ? '\u26A0\uFE0F' :
                arb.tier === 'SUSPICIOUS' ? '\u{1F6A8}' : '\u{1F7E1}';

  const pinnTag = arb.hasPinnacle ? ' \u{1F4A0} PINNACLE' : '';

  let msg = `${emoji} <b>${arb.tier} +${arb.arbPercentage.toFixed(2)}%</b>${pinnTag}\n`;
  msg += `${arb.accessTag}\n`;
  msg += `\u{1F3C6} <b>${arb.match}</b>\n`;
  msg += `${arb.sport} | Confidence: ${arb.confidence}%\n`;
  msg += `${arb.tierLabel}\n\n`;

  if (arb.tier !== 'SUSPICIOUS') {
    msg += `\u{1F4B0} <b>PROFIT: $${arb.profit.toFixed(2)} on $10</b>\n\n`;
  }

  for (const w of arb.warnings) msg += `\u26A0\uFE0F ${w}\n`;
  if (arb.warnings.length) msg += '\n';

  if (arb.tier !== 'SUSPICIOUS') {
    // Sort: longer odds first (place first — more likely to move)
    const sorted = [...arb.outcomes].sort((a, b) => b.odds - a.odds);
    msg += '<b>PLACE BETS:</b>\n';
    for (let i = 0; i < sorted.length; i++) {
      const o = sorted[i];
      const step = i === 0 ? '\u{1F534} BET 1 (FIRST)' : `\u{1F535} BET ${i + 1}`;
      const acc  = o.isFunded ? '\u2705' : '\u{1F310}';
      msg += `\n${step} ${acc} <b>${o.bookmaker}</b>${o.isPinnacle ? ' \u{1F4A0}' : ''}\n`;
      msg += `${o.outcome} @ <b>${o.odds}</b>\n`;
      msg += `Stake: <b>$${o.stakeRounded}</b> \u2192 $${o.potentialReturn.toFixed(2)}\n`;
      if (o.deposit) msg += `${o.deposit}\n`;
      if (o.url)     msg += `${o.url}\n`;
    }
  } else {
    msg += '<b>DO NOT BET — verify on live sites:</b>\n';
    for (const o of arb.outcomes) {
      msg += `${o.bookmaker}: ${o.outcome} @ ${o.odds}\n${o.url}\n`;
    }
  }

  msg += `\n\u{23F0} ~5 min window\n`;
  msg += `\u{1F517} <a href="https://sureedge-ai.vercel.app">SureEdge AI</a>`;
  return msg;
}
