const RUGCHECK_API_URL = 'https://api.rugcheck.xyz/v1';

export async function getTokenReport(tokenMint) {
  try {
    const response = await fetch(
      `${RUGCHECK_API_URL}/tokens/${tokenMint}/report`
    );

    if (!response.ok) {
      throw new Error('Rugcheck API error');
    }

    return response.json();
  } catch (error) {
    console.error('Rugcheck API error:', error);
    return null;
  }
}

// Get deployer data by checking their most recent token
// The token report includes creatorTokens array with all tokens by that creator
export async function getDeployerData(walletAddress) {
  try {
    // First, get recent tokens to find one created by this wallet
    const recentTokens = await fetch(
      `${RUGCHECK_API_URL}/stats/new_tokens?limit=100`
    );

    if (!recentTokens.ok) {
      return null;
    }

    const tokens = await recentTokens.json();

    // Find a token created by this wallet
    const creatorToken = tokens.find(t => t.creator === walletAddress);

    if (!creatorToken) {
      // If not in recent tokens, we can't get creator data easily
      // Return null and let the app handle it
      return null;
    }

    // Get the full report for this token which includes creatorTokens
    const report = await getTokenReport(creatorToken.mint);

    if (!report) {
      return null;
    }

    return {
      creator: report.creator,
      creatorTokens: report.creatorTokens || [],
      // Get the normalized score (0-100 scale)
      latestTokenScore: report.score_normalised,
      latestTokenRisks: report.risks || [],
      detectedAt: report.detectedAt
    };
  } catch (error) {
    console.error('Error getting deployer data:', error);
    return null;
  }
}

// Get detailed deployer info from a specific token mint
export async function getDeployerDataFromToken(tokenMint) {
  try {
    const report = await getTokenReport(tokenMint);

    if (!report || !report.creator) {
      return null;
    }

    // Calculate stats from creatorTokens
    const creatorTokens = report.creatorTokens || [];
    const topMarketCap = creatorTokens.length > 0
      ? Math.max(...creatorTokens.map(t => t.marketCap || 0))
      : null;

    // Get wallet age from first token creation
    const firstTokenDate = creatorTokens.length > 0
      ? new Date(Math.min(...creatorTokens.map(t => new Date(t.createdAt).getTime())))
      : null;

    const walletAge = firstTokenDate
      ? Math.floor((Date.now() - firstTokenDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      creator: report.creator,
      creatorTokens: creatorTokens,
      tokensLaunched: creatorTokens.length,
      topMarketCap: topMarketCap,
      // Normalize rugcheck score to 0-100 (score_normalised is already 0-100)
      rugcheckScore: report.score_normalised != null ? Math.round(100 - report.score_normalised) : null,
      walletAge: walletAge,
      latestTokenName: report.tokenMeta?.name || report.token_extensions?.tokenMetadata?.name || null,
      latestTokenSymbol: report.tokenMeta?.symbol || report.token_extensions?.tokenMetadata?.symbol || null,
      latestTokenMint: report.mint,
      risks: report.risks || [],
      rugged: report.rugged
    };
  } catch (error) {
    console.error('Error getting deployer data from token:', error);
    return null;
  }
}

// Search recent tokens for a creator wallet
export async function findCreatorTokens(walletAddress, limit = 200) {
  try {
    const response = await fetch(
      `${RUGCHECK_API_URL}/stats/new_tokens?limit=${limit}`
    );

    if (!response.ok) {
      return [];
    }

    const tokens = await response.json();
    return tokens.filter(t => t.creator === walletAddress);
  } catch (error) {
    console.error('Error finding creator tokens:', error);
    return [];
  }
}
