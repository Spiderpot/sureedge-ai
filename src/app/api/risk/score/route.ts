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

    const [activeBets, recentBets, recentLosses] = await Promise.all([
      db.bet.count({ where: { userId, status: 'PENDING' } }),
      db.bet.findMany({ where: { userId }, orderBy: { placedAt: 'desc' }, take: 20 }),
      db.bet.count({ where: { userId, status: 'LOST', placedAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
    ]);

    // Real risk scoring
    const totalRecentBets = recentBets.length;
    const activeExposure  = recentBets
      .filter(b => b.status === 'PENDING')
      .reduce((s, b) => s + b.stake, 0);

    // Factor 1: Bankroll utilisation (0-100)
    const bankrollUtilisation = user.balance > 0
      ? Math.min(100, (activeExposure / user.balance) * 100)
      : 0;

    // Factor 2: Loss streak (0-100)
    let lossStreak = 0;
    for (const bet of recentBets) {
      if (bet.status === 'LOST') lossStreak++;
      else break;
    }
    const lossStreakScore = Math.min(100, lossStreak * 15);

    // Factor 3: Bet frequency (0-100)
    const freqScore = Math.min(100, (activeBets / 5) * 100);

    // Factor 4: Recent loss rate (0-100)
    const lossRate = totalRecentBets > 0 ? (recentLosses / totalRecentBets) * 100 : 0;

    // Weighted overall score (higher = safer)
    const overallScore = Math.round(
      100 -
      (bankrollUtilisation * 0.35 +
       lossStreakScore     * 0.30 +
       freqScore           * 0.20 +
       lossRate            * 0.15)
    );

    const clampedScore = Math.max(0, Math.min(100, overallScore));
    const riskLevel = clampedScore >= 70 ? 'LOW' : clampedScore >= 45 ? 'MEDIUM' : 'HIGH';

    const recommendations = riskLevel === 'LOW'
      ? ['Risk profile looks healthy. Continue your current strategy.', 'Consider slightly increasing stakes for higher returns.']
      : riskLevel === 'MEDIUM'
      ? ['Reduce active bet count by 20-30%.', 'Diversify across more bookmakers.', 'Review your recent loss pattern.']
      : ['Pause betting immediately and review your strategy.', 'Withdraw excess funds to reduce exposure.', 'Switch to lower-risk markets only.'];

    return success({
      overallScore:    clampedScore,
      riskLevel,
      factors: {
        bankrollUtilisation: { score: Math.round(100 - bankrollUtilisation), detail: `${activeExposure.toFixed(2)} active exposure` },
        lossStreak:          { score: Math.round(100 - lossStreakScore), detail: `${lossStreak} consecutive losses` },
        betFrequency:        { score: Math.round(100 - freqScore), detail: `${activeBets} pending bets` },
        recentLossRate:      { score: Math.round(100 - lossRate), detail: `${recentLosses} losses in last 7 days` },
      },
      recommendations,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Risk score error:', err);
    return error('Failed to calculate risk score', 500);
  }
}
