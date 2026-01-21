// Use proxy in development to avoid CORS issues
const FAIRSCALE_API_URL = import.meta.env.DEV ? '/api/fairscale' : 'https://api.fairscale.xyz';
const FAIRSCALE_API_KEY = import.meta.env.VITE_FAIRSCALE_API_KEY;

export async function getFairScore(walletAddress, twitterHandle = null) {
  // Debug: log API key presence and URL
  console.log('FairScale config:', {
    apiUrl: FAIRSCALE_API_URL,
    hasApiKey: !!FAIRSCALE_API_KEY,
    isDev: import.meta.env.DEV
  });

  // If no API key is configured, return mock data for development
  if (!FAIRSCALE_API_KEY) {
    console.warn('FairScale API key not configured, using mock data');
    return getMockFairScore(walletAddress);
  }

  try {
    // Build query params
    const params = new URLSearchParams();
    params.append('wallet', walletAddress);
    if (twitterHandle) {
      params.append('twitter', twitterHandle);
    }

    const url = `${FAIRSCALE_API_URL}/score?${params.toString()}`;
    console.log('Calling FairScale API:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'fairkey': FAIRSCALE_API_KEY
      }
    });

    console.log('FairScale response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('FairScale API error:', response.status, errorText);
      throw new Error(`FairScale API error: ${response.status}`);
    }

    const text = await response.text();
    console.log('FairScale raw response:', text);

    const data = JSON.parse(text);
    console.log('FairScale API response parsed:', data);

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
