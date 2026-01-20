const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const GROK_API_KEY = import.meta.env.VITE_GROK_API_KEY;

const fallbackRoasts = {
  ELITE: "This wallet touches grass AND money.",
  TRUSTED: "Probably won't rug you. Probably.",
  NEUTRAL: "Mid wallet energy detected.",
  RISKY: "Your funds are playing Russian roulette.",
  DANGER: "Sir, this is a crime scene."
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
            content: `You are a witty crypto degen roast master. Generate a single short sentence (max 15 words) about a Solana token deployer. Be funny, use crypto slang, and match the tone to the data:
            - High FairScore (700+): Complimentary but still edgy
            - Medium FairScore (400-699): Skeptical, backhanded compliments
            - Low FairScore (0-399): Full roast mode, warn people
            - Low rugcheck score: More sus vibes
            - Many tokens launched: Either serial builder or serial rugger
            - High top market cap: Has had success before
            - New deployer (few days old): Fresh wallet, could be sus`
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
