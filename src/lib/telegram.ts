import { DetectedArb } from './arb-detector';

const TELEGRAM_API = 'https://api.telegram.org/bot';

export async function sendTelegramAlert(message: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId   = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return false;

  try {
    const res = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    return res.ok;
  } catch { return false; }
}

export function formatArbAlert(arb: DetectedArb): string {
  // Tier-based header
  const tierEmoji: Record<string, string> = {
    EXECUTE: '\u{1F525}', VERIFY: '\u26A0\uFE0F', SUSPICIOUS: '\u{1F6A8}', NEAR_ARB: '\u{1F7E1}',
  };

  const emoji = tierEmoji[arb.tier] || '\u{1F7E2}';
  const pinnacle = arb.hasPinnacle ? ' \u{1F4A0}' : '';

  let msg = `${emoji} <b>${arb.tier === 'EXECUTE' ? 'SUREBET' : arb.tier === 'VERIFY' ? 'VERIFY FIRST' : arb.tier === 'SUSPICIOUS' ? 'SUSPICIOUS — CHECK MANUALLY' : 'NEAR-ARB'} +${arb.arbPercentage.toFixed(2)}%</b>${pinnacle}\n`;
  msg += `${arb.accessTag}\n`;
  msg += `\u{1F3C6} <b>${arb.match}</b>\n`;
  msg += `${arb.sport} | ${arb.bookmakerCount} bookmakers\n`;
  msg += `Confidence: ${arb.confidence}% | ${arb.tierLabel}\n\n`;

  if (arb.tier !== 'SUSPICIOUS') {
    msg += `<b>\u{1F4B0} PROFIT: $${arb.guaranteedProfit.toFixed(2)} on $10</b>\n\n`;
  }

  // Warnings
  if (arb.warnings.length > 0) {
    for (const w of arb.warnings) {
      msg += `\u26A0\uFE0F ${w}\n`;
    }
    msg += '\n';
  }

  if (arb.tier !== 'SUSPICIOUS') {
    msg += `<b>BETS:</b>\n`;
    const sorted = [...arb.outcomes].sort((a, b) => b.odds - a.odds);
    for (let i = 0; i < sorted.length; i++) {
      const o = sorted[i];
      const step = i === 0 ? '\u{1F534} BET 1 (FIRST)' : `\u{1F535} BET ${i + 1}`;
      const access = o.isFunded ? '\u2705' : o.access === 'ng' ? '\u{1F1F3}\u{1F1EC}' : '\u{1F310}';
      msg += `\n${step} ${access}\n`;
      msg += `<b>${o.bookmaker}</b>: ${o.outcome} @ <b>${o.odds}</b>\n`;
      msg += `Stake: <b>$${o.stakeRounded}</b> (exact: $${o.stake.toFixed(2)})\n`;
      if (o.bookmakerUrl) msg += `\u{1F517} ${o.bookmakerUrl}\n`;
    }
  } else {
    msg += `<b>DO NOT BET</b> — verify odds on live sites first:\n`;
    for (const o of arb.outcomes) {
      msg += `${o.bookmaker}: ${o.outcome} @ ${o.odds}\n`;
      if (o.bookmakerUrl) msg += `\u{1F517} ${o.bookmakerUrl}\n`;
    }
  }

  msg += `\n\u{1F517} <a href="https://sureedge-ai.vercel.app">SureEdge AI</a>`;
  return msg;
}
