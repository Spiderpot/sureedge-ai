export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // User injected by middleware
    const userId = request.headers.get('x-user-id');
    if (!userId) return error('Not authenticated', 401);

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30d';
    const days  = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Real data from DB
    const bets = await db.bet.findMany({
      where:   { userId, placedAt: { gte: since } },
      include: { bookmaker: { select: { name: true } } },
      orderBy: { placedAt: 'asc' },
    });

    const totalBets = bets.length;
    const wins      = bets.filter(b => b.status === 'WON').length;
    const losses    = bets.filter(b => b.status === 'LOST').length;
    const winRate   = totalBets > 0 ? parseFloat(((wins / totalBets) * 100).toFixed(1)) : 0;

    const totalStaked = bets.reduce((s, b) => s + b.stake, 0);
    const totalReturn = bets
      .filter(b => b.status === 'WON')
      .reduce((s, b) => s + b.potentialWin, 0);
    const totalProfit = parseFloat((totalReturn - totalStaked).toFixed(2));
    const avgROI      = totalStaked > 0
      ? parseFloat(((totalProfit / totalStaked) * 100).toFixed(2))
      : 0;

    // Profit over time (daily buckets)
    const profitByDate = new Map<string, number>();
    for (let i = days; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      profitByDate.set(d.toISOString().split('T')[0], 0);
    }

    for (const bet of bets) {
      const dateKey = bet.placedAt.toISOString().split('T')[0];
      if (!profitByDate.has(dateKey)) continue;
      const betPnl = bet.status === 'WON'
        ? bet.potentialWin - bet.stake
        : bet.status === 'LOST' ? -bet.stake : 0;
      profitByDate.set(dateKey, (profitByDate.get(dateKey) ?? 0) + betPnl);
    }

    let cumulative = 0;
    const profitOverTime = Array.from(profitByDate.entries()).map(([date, profit]) => {
      cumulative += profit;
      return { date, profit: parseFloat(profit.toFixed(2)), cumulative: parseFloat(cumulative.toFixed(2)) };
    });

    // Profit by bookmaker
    const bmProfitMap = new Map<string, number>();
    for (const bet of bets) {
      const name = bet.bookmaker.name;
      const pnl  = bet.status === 'WON' ? bet.potentialWin - bet.stake : bet.status === 'LOST' ? -bet.stake : 0;
      bmProfitMap.set(name, (bmProfitMap.get(name) ?? 0) + pnl);
    }
    const profitByBookmaker = Array.from(bmProfitMap.entries())
      .map(([bookmaker, profit]) => ({ bookmaker, profit: parseFloat(profit.toFixed(2)) }))
      .sort((a, b) => b.profit - a.profit);

    const bestDay  = profitOverTime.reduce((a, b) => a.profit > b.profit ? a : b, { date: '', profit: 0, cumulative: 0 });
    const worstDay = profitOverTime.reduce((a, b) => a.profit < b.profit ? a : b, { date: '', profit: 0, cumulative: 0 });

    return success({
      summary: { totalBets, wins, losses, winRate, totalProfit, avgROI, bestDay, worstDay },
      profitOverTime,
      profitByBookmaker,
      range,
    });
  } catch (err) {
    console.error('Analytics error:', err);
    return error('Failed to load analytics', 500);
  }
}
