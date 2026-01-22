// Always use our serverless proxy - API key stays server-side
const FAIRSCALE_PROXY_URL = '/api/fairscale';

export async function getFairScore(walletAddress, twitterHandle = null) {
  try {
    // Build query params
    const params = new URLSearchParams();
    params.append('wallet', walletAddress);
    if (twitterHandle) {
      params.append('twitter', twitterHandle);
    }

    const url = `${FAIRSCALE_PROXY_URL}?${params.toString()}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error('FairScale proxy error:', response.status);
      throw new Error(`FairScale API error: ${response.status}`);
    }

    const data = await response.json();

    // Scale score from 0-100 to 0-1000 for UI display
    const scaledScore = Math.round((data.fairscore ?? 50) * 10);

    // Return the full response data with fairscore
    // Note: We ignore the tier from API (silver/gold/etc) and calculate our own based on score
    return {
      score: scaledScore,
      tier: getTierFromScore(scaledScore),
      fairscore_base: data.fairscore_base,
      social_score: data.social_score,
      badges: data.badges || [],
      actions: data.actions || [],
      features: data.features || {},
      timestamp: data.timestamp
    };
  } catch (error) {
    console.error('FairScale API error:', error);
    // Fall back to mock data on error
    return getMockFairScore(walletAddress);
  }
}

// Mock data generator for development when API key is not available
function getMockFairScore(walletAddress) {
  // Generate a deterministic score based on wallet address
  const hash = walletAddress.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);

  const score = Math.abs(hash % 1000);
  const tier = getTierFromScore(score);

  return {
    score,
    tier,
    badges: [],
    actions: [],
    features: {}
  };
}

export function getTierFromScore(score) {
  if (score >= 700) return 'UNICORN';
  if (score >= 400) return 'KINDA OK';
  if (score >= 350) return 'MEH';
  if (score >= 200) return 'RISKY';
  return 'DANGER';
}

export function getTierColor(tier) {
  const colors = {
    ELITE: '#00ff88',
    TRUSTED: '#4dabf7',
    NEUTRAL: '#ffd93d',
    RISKY: '#ff8c42',
    DANGER: '#ff4757'
  };
  return colors[tier] || colors.NEUTRAL;
}

export function getTierGlowClass(tier) {
  const glowClasses = {
    ELITE: 'glow-green',
    TRUSTED: 'glow-blue',
    NEUTRAL: 'glow-yellow',
    RISKY: 'glow-orange',
    DANGER: 'glow-red'
  };
  return glowClasses[tier] || glowClasses.NEUTRAL;
}
