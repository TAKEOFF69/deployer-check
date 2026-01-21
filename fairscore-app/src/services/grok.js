const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const GROK_API_KEY = import.meta.env.VITE_GROK_API_KEY;

const fallbackRoasts = {
  ELITE: "This dev actually ships instead of shitposting. Rare breed.",
  TRUSTED: "Won't rug you... unless rent is due. Keep one eye open.",
  NEUTRAL: "Aggressively mid. The human equivalent of a beige wall.",
  RISKY: "Your funds are one bad day away from becoming a tax write-off.",
  DANGER: "Congrats, you found a wallet that makes Nigerian princes look trustworthy."
};

export async function generateRoast(score, tier, deployerData = {}) {
  if (!GROK_API_KEY) {
    console.warn('Grok API key not configured, using fallback roast');
    return fallbackRoasts[tier] || fallbackRoasts.NEUTRAL;
  }

  try {
    const prompt = buildRoastPrompt(score, tier, deployerData);

    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-2-latest',
        messages: [
          {
            role: 'system',
            content: `You are a savage crypto roast master with zero filter. Generate a single short sentence (max 15 words) about a Solana token deployer. Be brutally honest, use crypto slang, roast hard but keep it funny. Match intensity to the data:
            - High FairScore (700+): Backhanded compliments, acknowledge they're legit but still mock them
            - Medium FairScore (400-699): Heavy skepticism, passive-aggressive warnings, trust issues
            - Low FairScore (0-399): Absolutely destroy them, call them out, warn people aggressively
            - Low rugcheck score: Maximum sus energy, call them a scammer
            - Many tokens launched: Either a chad builder or a serial rugpuller preying on degens
            - High top market cap: Had success but probably dumped on retail
            - New deployer (few days old): Fresh wallet = fresh scam vibes, roast the burner energy
            Be offensive but clever. No mercy. Make it hurt but make it funny.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 50,
        temperature: 0.9
      })
    });

    if (!response.ok) {
      throw new Error('Grok API error');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Grok API error:', error);
    return fallbackRoasts[tier] || fallbackRoasts.NEUTRAL;
  }
}

function buildRoastPrompt(score, tier, deployerData) {
  const {
    tokensLaunched = 0,
    currentMarketCap = null,
    totalHolders = null,
    top10HeldPct = null,
    risks = []
  } = deployerData;

  const formatMcap = (val) => {
    if (val == null) return null;
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
    return `$${val.toFixed(0)}`;
  };

  let prompt = `Token/Deployer stats: FairScore ${score}/1000 (${tier})`;

  if (tokensLaunched > 0) {
    prompt += `, deployer has launched ${tokensLaunched} token${tokensLaunched > 1 ? 's' : ''}`;
  }

  if (currentMarketCap !== null) {
    prompt += `, market cap: ${formatMcap(currentMarketCap)}`;
  }

  if (totalHolders !== null) {
    prompt += `, ${totalHolders.toLocaleString()} holders`;
  }

  if (top10HeldPct !== null) {
    prompt += `, top 10 wallets hold ${top10HeldPct.toFixed(1)}% of supply`;
  }

  if (risks.length > 0) {
    prompt += `, risks detected: ${risks.slice(0, 2).map(r => r.name || r.description).join(', ')}`;
  }

  prompt += `. Generate a one-liner roast/praise.`;
  return prompt;
}

export { fallbackRoasts };
