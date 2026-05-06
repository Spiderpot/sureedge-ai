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
    console.error('Telegram send failed');
    return false;
  }
}

export function formatArbAlert(surebet: {
  match: string;
  sport: string;
  arbPercentage: number;
  isGenuineArb: boolean;
  outcomes: { outcome: string; odds: number; bookmaker: string; impliedProb: number }[];
}): string {
  const icon = surebet.isGenuineArb ? '🟢 SUREBET' : '🟡 NEAR-ARB';
  const profit = surebet.arbPercentage.toFixed(3);

  let msg = `${icon} <b>${surebet.match}</b>\n`;
  msg += `⚾ ${surebet.sport}\n`;
  msg += `💰 Profit: <b>${profit}%</b>\n\n`;

  for (const o of surebet.outcomes) {
    msg += `  📌 <b>${o.outcome}</b>: ${o.odds} @ ${o.bookmaker}\n`;
  }

  msg += `\n⏰ Window: ~5 minutes\n`;
  msg += `🔗 <a href="https://sureedge-ai.vercel.app">Open SureEdge AI</a>`;

  return msg;
}
