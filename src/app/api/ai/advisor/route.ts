export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';

// Real AI advisor using Anthropic API
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `You are SureEdge AI's expert sports arbitrage advisor. You have deep knowledge of:
- Sports arbitrage and surebet mathematics (calculating arb %, stake distribution, ROI)
- Bookmaker risk management and detection avoidance
- Bankroll management strategies (Kelly Criterion, fixed stakes, tiered systems)
- Market analysis for football, basketball, tennis, baseball, and esports
- Risk scoring and account health monitoring

Respond concisely and practically. Always give specific, actionable advice. 
Format responses with clear sections when answering complex questions.
Do not recommend illegal activities. Always emphasize responsible gambling practices.`;

interface AdvisorRequest {
  question?: string;
  context?: {
    bankroll?: number;
    role?: string;
    recentBets?: number;
    winRate?: number;
    totalProfit?: number;
  };
  action?: 'bankroll' | 'strategy' | 'risk' | 'market' | 'custom';
}

const QUICK_ACTION_PROMPTS: Record<string, string> = {
  bankroll: 'Analyze my current bankroll situation and give me specific recommendations for optimal allocation across bookmakers. Focus on risk management and growth targets.',
  strategy: 'Review my current arbitrage strategy and suggest improvements. Cover market selection, timing, stake sizing, and bookmaker rotation.',
  risk:     'Evaluate my current risk exposure. What risk factors should I watch for? How can I reduce my chances of account limitations?',
  market:   'What sports markets have the best arbitrage opportunities right now? Which bookmakers typically offer the widest spreads?',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as AdvisorRequest;
    const { question, context, action } = body;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Graceful fallback when API key not configured
      return success({
        answer: 'AI Advisor requires ANTHROPIC_API_KEY to be configured in your environment variables. Once set, you\'ll get personalized arbitrage strategy recommendations powered by Claude.',
        configured: false,
      });
    }

    // Build user message
    let userMessage = question || (action ? QUICK_ACTION_PROMPTS[action] : '') || 'Give me a market overview and top arbitrage strategy recommendations.';

    if (context) {
      const contextStr = [
        context.bankroll    ? `My bankroll: $${context.bankroll}` : null,
        context.role        ? `My tier: ${context.role}` : null,
        context.recentBets  ? `Recent bets placed: ${context.recentBets}` : null,
        context.winRate     ? `Win rate: ${context.winRate}%` : null,
        context.totalProfit ? `Total profit: $${context.totalProfit}` : null,
      ].filter(Boolean).join('. ');
      if (contextStr) userMessage = `${contextStr}. ${userMessage}`;
    }

    const response = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type':         'application/json',
        'x-api-key':            apiKey,
        'anthropic-version':    '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Anthropic API error:', response.status, errBody);
      return error('AI service temporarily unavailable', 503);
    }

    const data = await response.json();
    const answer = data.content?.[0]?.text ?? 'No response generated.';

    return success({
      answer,
      configured: true,
      tokensUsed: data.usage?.output_tokens ?? 0,
      model:      data.model,
    });
  } catch (err) {
    console.error('AI Advisor error:', err);
    return error('AI Advisor failed', 500);
  }
}
