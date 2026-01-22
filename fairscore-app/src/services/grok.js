// Using Groq's free API with Llama 3.1 (not Grok/X.AI)
// Get your free API key at https://console.groq.com
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

const fallbackRoasts = {
  ELITE: "Like finding a parking spot in Manhattan. Suspicious but take it.",
  TRUSTED: "Surprisingly not a disaster. Your standards are low but met.",
  NEUTRAL: "Your grandma's meatloaf: nothing special but won't kill you.",
  RISKY: "About as stable as my dad's marriage. Third one.",
  DANGER: "This wallet makes Nigerian princes look like Warren Buffett."
};

export async function generateRoast(score, tier, deployerData = {}) {
  if (!GROQ_API_KEY) {
    console.warn('Groq API key not configured, using fallback roast');
    return fallbackRoasts[tier] || fallbackRoasts.NEUTRAL;
  }

  try {
    const prompt = buildRoastPrompt(score, tier, deployerData);

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `Roast this deployer in ONE funny sentence (max 15 words).

Style:
- Use colorful comparisons to everyday things (Nigerian princes, gas station sushi, your ex, carnival games, etc)
- ONE crypto term max. The rest should be normal words anyone understands.
- Be actually funny, not "crypto twitter funny"
- NO buzzword salads. NO forced slang stacking.

Tone by score:
- 700+: Backhanded compliment. "Like finding a unicorn. Probably fake but hey."
- 400-699: Light mockery. "Has the same energy as a participation trophy."
- Under 400: Savage warning with a joke. "Makes Nigerian princes look like Warren Buffett."

One punchy line. Make it cheeky, not cringe.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 40,
        temperature: 0.9
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error:', response.status, errorText);
      throw new Error('Groq API error');
    }

    const data = await response.json();
    return data.choices[0].message.content.replace(/^["']|["']$/g, '').trim();
  } catch (error) {
    console.error('Groq API error:', error);
    return fallbackRoasts[tier] || fallbackRoasts.NEUTRAL;
  }
}

function buildRoastPrompt(score, tier, deployerData) {
  const {
    tokensLaunched = 0,
    currentMarketCap = null,
    totalHolders = null,
    top10HeldPct = null,
    risks = [],
    deployerAge = null,
    rugcheckScore = null
  } = deployerData;

  const formatMcap = (val) => {
    if (val == null) return null;
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
    return `$${val.toFixed(0)}`;
  };

  let prompt = `DEPLOYER DATA TO ROAST:\n`;
  prompt += `- FairScore: ${score}/1000 (${tier} tier)\n`;

  if (rugcheckScore !== null) {
    prompt += `- Rugcheck score: ${rugcheckScore}/100 ${rugcheckScore < 50 ? '(SKETCHY AF)' : ''}\n`;
  }

  if (deployerAge !== null) {
    prompt += `- Wallet age: ${deployerAge} days ${deployerAge < 7 ? '(FRESH BURNER ALERT)' : deployerAge < 30 ? '(sus timing)' : ''}\n`;
  }

  if (tokensLaunched > 0) {
    prompt += `- Tokens launched: ${tokensLaunched} ${tokensLaunched > 5 ? '(serial deployer)' : ''}\n`;
  }

  if (currentMarketCap !== null) {
    prompt += `- Current market cap: ${formatMcap(currentMarketCap)}\n`;
  }

  if (totalHolders !== null) {
    prompt += `- Holders: ${totalHolders.toLocaleString()}\n`;
  }

  if (top10HeldPct !== null) {
    prompt += `- Top 10 wallets hold: ${top10HeldPct.toFixed(1)}% ${top10HeldPct > 50 ? '(concentrated = dump incoming)' : ''}\n`;
  }

  if (risks.length > 0) {
    prompt += `- Red flags: ${risks.slice(0, 3).map(r => r.name || r.description).join(', ')}\n`;
  }

  prompt += `\nRoast them with a funny comparison. Be clever, not try-hard.`;
  return prompt;
}

export { fallbackRoasts };
