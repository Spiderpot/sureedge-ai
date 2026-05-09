/**
 * SureEdge AI — Telegram Alert Engine
 * 
 * Sends formatted, actionable arb alerts.
 * Only genuine arbs ≥ 2.5% trigger alerts.
 */

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
      body: JSON.stringify({
        chat_id:    chatId,
        text:       message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function formatArbAlert(arb: DetectedArb): string {
  const profitEmoji = arb.arbPercentage >= 5 ? '\u{1F525}' :
                      arb.arbPercentage >= 3 ? '\u{1F7E2}' : '\u{1F7E1}';

  const accessIcon = arb.accessTag;
  const pinnacleTag = arb.hasPinnacle ? ' \u{1F4A0}' : '';
  const confidence = arb.confidence >= 80 ? '\u{2B50}' :
                     arb.confidence >= 60 ? '\u{1F44D}' : '\u26A0\uFE0F';

  let msg = `${profitEmoji} <b>SUREBET +${arb.arbPercentage.toFixed(2)}%</b>${pinnacleTag}\n`;
  msg += `${accessIcon}\n`;
  msg += `\u{1F3C6} <b>${arb.match}</b>\n`;
  msg += `${arb.sport}\n`;
  msg += `${confidence} Confidence: ${arb.confidence}%\n\n`;

  msg += `<b>\u{1F4B0} GUARANTEED PROFIT: $${arb.guaranteedProfit.toFixed(2)} on $10</b>\n\n`;

  msg += `<b>PLACE THESE BETS:</b>\n`;
  
  // Sort: longer odds first (place this bet first — more likely to move)
  const sortedOutcomes = [...arb.outcomes].sort((a, b) => b.odds - a.odds);
  
  for (let i = 0; i < sortedOutcomes.length; i++) {
    const o = sortedOutcomes[i];
    const step = i === 0 ? '\u{1F534} BET 1 (place FIRST)' : `\u{1F535} BET ${i + 1}`;
    const fundedIcon = o.isFunded ? ' \u{2705}' :
                       o.access === 'ng' ? ' \u{1F1F3}\u{1F1EC}' : ' \u{1F310}';
    
    msg += `\n${step}${fundedIcon}\n`;
    msg += `<b>${o.bookmaker}</b>\n`;
    msg += `Bet: <b>${o.outcome}</b> @ <b>${o.odds.toFixed(2)}</b>\n`;
    msg += `Stake: <b>$${o.stake.toFixed(2)}</b> \u{2192} Returns $${o.potentialReturn.toFixed(2)}\n`;
    if (o.depositMethod) msg += `Deposit: ${o.depositMethod}\n`;
    if (o.bookmakerUrl) msg += `\u{1F517} ${o.bookmakerUrl}\n`;
  }

  msg += `\n\u{23F0} <b>ACT NOW — ~5 min window</b>\n`;
  msg += `\u{26A0}\uFE0F Place BET 1 first (longer odds move faster)\n`;
  msg += `\u{26A0}\uFE0F Round stakes: $${sortedOutcomes[0]?.stake.toFixed(2)} \u{2192} $${Math.round(sortedOutcomes[0]?.stake || 0)}\n\n`;
  msg += `\u{1F517} <a href="https://sureedge-ai.vercel.app">Execute in SureEdge AI</a>`;

  return msg;
}
