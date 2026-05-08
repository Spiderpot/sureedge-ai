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

export function formatArbAlert(surebet: {
  match: string;
  sport: string;
  arbPercentage: number;
  isGenuineArb: boolean;
  hasPinnacle?: boolean;
  hasSharpSoft?: boolean;
  outcomes: { outcome: string; odds: number; bookmaker: string; impliedProb: number; depositMethod?: string; bookmakerUrl?: string; tier?: number }[];
}): string {
  const icon = surebet.isGenuineArb ? '\u{1F7E2} SUREBET' : '\u{1F7E1} NEAR-ARB';
  const pinnacleTag = surebet.hasPinnacle ? ' \u{1F4A0} PINNACLE' : '';
  const profit = surebet.arbPercentage.toFixed(3);

  // Calculate stakes for $10
  const arbFraction = surebet.outcomes.reduce((sum, o) => sum + 1 / o.odds, 0);
  const totalStake = 10;

  let msg = `${icon}${pinnacleTag}\n`;
  msg += `<b>${surebet.match}</b>\n`;
  msg += `${surebet.sport}\n`;
  msg += `Profit: <b>${profit}%</b> | $${(totalStake * parseFloat(profit) / 100).toFixed(2)} on $${totalStake}\n\n`;

  msg += `<b>PLACE THESE BETS:</b>\n`;
  for (const o of surebet.outcomes) {
    const stake = ((1 / o.odds / arbFraction) * totalStake).toFixed(2);
    const ret = (parseFloat(stake) * o.odds).toFixed(2);
    const tierLabel = o.tier === 1 ? ' [SHARP]' : o.tier === 2 ? ' [NAIRA]' : ' [CRYPTO]';
    msg += `\n\u{1F4CC} <b>${o.bookmaker}</b>${tierLabel}\n`;
    msg += `   Bet: <b>${o.outcome}</b> @ ${o.odds}\n`;
    msg += `   Stake: <b>$${stake}</b> \u{2192} Returns $${ret}\n`;
    if (o.depositMethod) msg += `   Deposit: ${o.depositMethod}\n`;
    if (o.bookmakerUrl) msg += `   ${o.bookmakerUrl}\n`;
  }

  msg += `\n\u{23F0} Window: ~5 minutes`;
  msg += `\n\u{1F517} <a href="https://sureedge-ai.vercel.app">Execute in SureEdge AI</a>`;

  return msg;
}
