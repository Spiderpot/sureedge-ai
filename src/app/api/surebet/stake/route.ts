export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const { totalStake, outcomes } = await request.json();

    if (!totalStake || !outcomes || !Array.isArray(outcomes) || outcomes.length < 2) {
      return error('Total stake and at least 2 outcomes required', 400);
    }

    const inverseOdds = outcomes.map((o: { odds: number }) => 1 / o.odds);
    const totalInverse = inverseOdds.reduce((a: number, b: number) => a + b, 0);
    const impliedProbability = totalInverse * 100;

    const stakes = outcomes.map((o: { odds: number; outcome?: string }, i: number) => {
      const stake = parseFloat(((inverseOdds[i] / totalInverse) * totalStake).toFixed(2));
      const potentialReturn = parseFloat((stake * o.odds).toFixed(2));
      return {
        outcome: o.outcome || `Outcome ${i + 1}`,
        odds: o.odds,
        stake,
        potentialReturn,
      };
    });

    const minReturn = Math.min(...stakes.map((s: { potentialReturn: number }) => s.potentialReturn));
    const maxReturn = Math.max(...stakes.map((s: { potentialReturn: number }) => s.potentialReturn));
    const guaranteedProfit = parseFloat((minReturn - totalStake).toFixed(2));
    const isArbitrage = minReturn > totalStake;
    const roi = parseFloat(((guaranteedProfit / totalStake) * 100).toFixed(2));

    return success({
      totalStake,
      stakes,
      minReturn,
      maxReturn,
      guaranteedProfit,
      isArbitrage,
      roi,
      impliedProbability: parseFloat(impliedProbability.toFixed(2)),
    });
  } catch (err) {
    console.error('Stake calc error:', err);
    return error('Calculation failed', 500);
  }
}
