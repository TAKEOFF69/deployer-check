// Using Groq's free API with Llama 3.1 (not Grok/X.AI)
// Get your free API key at https://console.groq.com
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

const fallbackRoasts = {
  'UNICORN': [
    "Like finding a parking spot in Manhattan. Suspicious but take it.",
    "This wallet is cleaner than your browser history. Somehow.",
    "The crypto equivalent of someone who returns their shopping cart.",
    "Either genuinely legit or playing 4D chess. Either way, respect.",
    "Your mom would approve. That's either good or concerning."
  ],
  'KEEP AN EYE': [
    "Surprisingly not a disaster. Your standards are low but met.",
    "Like a Costco rotisserie chicken - reliable, no surprises.",
    "The Honda Civic of deployers. Boring but probably won't explode.",
    "Passed the vibe check but just barely.",
    "Good enough for government work, as they say."
  ],
  'POTENTIAL': [
    "Shows promise like a junior dev who googles everything.",
    "Could be the next big thing. Could also be nothing.",
    "Diamond hands or paper hands? Time will tell.",
    "Has potential. So did my ex. Just saying.",
    "Interesting enough to watch, not enough to YOLO."
  ],
  'MEH+': [
    "Your grandma's meatloaf: nothing special but won't kill you.",
    "Could go either way, like your fantasy football picks.",
    "The human equivalent of a participation trophy.",
    "Mid-plus. The plus is doing a lot of heavy lifting here.",
    "Better than average, which is a low bar but still."
  ],
  'MEH': [
    "This wallet has the same energy as gas station sushi.",
    "Mid. Just aggressively, unapologetically mid.",
    "The human equivalent of beige wallpaper.",
    "Not great, not terrible. The Chernobyl of wallets.",
    "About as exciting as watching paint dry. Beige paint."
  ],
  'RISKY': [
    "About as stable as my dad's marriage. Third one.",
    "This wallet gives off 'trust me bro' energy.",
    "Red flags so bright they're visible from space.",
    "Would not leave this wallet alone with your drink.",
    "The crypto equivalent of a carnival goldfish."
  ],
  'DANGER': [
    "This wallet makes Nigerian princes look like Warren Buffett.",
    "Run. Don't walk. Actually, maybe drive.",
    "This deployer's risk level is 'hold my beer' personified.",
    "More red flags than a Chinese parade.",
    "If this wallet was a restaurant, it would have a C health rating."
  ]
};

const getRandomFallback = (tier) => {
  const roasts = fallbackRoasts[tier] || fallbackRoasts['MEH'];
  return roasts[Math.floor(Math.random() * roasts.length)];
};

export async function generateRoast(score, tier, deployerData = {}) {
  console.log('generateRoast called, API key exists:', !!GROQ_API_KEY, 'key length:', GROQ_API_KEY?.length || 0);

  if (!GROQ_API_KEY) {
    console.warn('Groq API key not configured, using fallback roast');
    return getRandomFallback(tier);
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
- 700+ (UNICORN): Backhanded compliment. "Like finding a unicorn. Probably fake but hey."
- 600-699 (KEEP AN EYE): Cautiously optimistic. "Shows promise. So did my ex."
- 500-599 (POTENTIAL): Hopeful but skeptical. "Could be the next big thing. Or nothing."
- 400-499 (MEH+): Light mockery. "Has the same energy as a participation trophy."
- 300-399 (MEH): Unimpressed. "The human equivalent of beige wallpaper."
- Under 300: Savage warning with a joke. "Makes Nigerian princes look like Warren Buffett."

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
    const roast = data.choices[0].message.content.replace(/^["']|["']$/g, '').trim();
    console.log('Groq roast generated:', roast);
    return roast;
  } catch (error) {
    console.error('Groq API failed:', error.message || error);
    return getRandomFallback(tier);
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
