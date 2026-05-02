export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) return error('Not authenticated', 401);

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { balance: true, totalProfit: true },
    });
    if (!user) return error('User not found', 404);

    const [transactions, pendingBets] = await Promise.all([
      db.transaction.findMany({
        where:   { userId },
        orderBy: { createdAt: 'desc' },
        take:    50,
      }),
      db.bet.aggregate({
        where:  { userId, status: 'PENDING' },
        _sum:   { stake: true },
        _count: true,
      }),
    ]);

    const deposits     = transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
    const withdrawals  = transactions.filter(t => t.type === 'withdraw').reduce((s, t) => s + t.amount, 0);
    const lockedStake  = pendingBets._sum.stake ?? 0;
    const availableBalance = Math.max(0, user.balance - lockedStake);

    // Real profit history from transactions
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const recentTx = await db.transaction.findMany({
      where:   { userId, type: 'profit', createdAt: { gte: thirtyDaysAgo } },
      orderBy: { createdAt: 'asc' },
    });

    const profitByDate = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      profitByDate.set(d.toISOString().split('T')[0], 0);
    }
    for (const tx of recentTx) {
      const key = tx.createdAt.toISOString().split('T')[0];
      if (profitByDate.has(key)) {
        profitByDate.set(key, (profitByDate.get(key) ?? 0) + tx.amount);
      }
    }

    const profitHistory = Array.from(profitByDate.entries()).map(([date, profit]) => ({
      date,
      profit: parseFloat(profit.toFixed(2)),
    }));

    return success({
      balance:          user.balance,
      totalProfit:      user.totalProfit,
      totalDeposits:    parseFloat(deposits.toFixed(2)),
      totalWithdrawals: parseFloat(withdrawals.toFixed(2)),
      availableBalance: parseFloat(availableBalance.toFixed(2)),
      lockedInBets:     parseFloat(lockedStake.toFixed(2)),
      activeBetCount:   pendingBets._count,
      transactionCount: transactions.length,
      profitHistory,
      recentTransactions: transactions.slice(0, 10),
    });
  } catch (err) {
    console.error('Bankroll error:', err);
    return error('Failed to load bankroll', 500);
  }
}
