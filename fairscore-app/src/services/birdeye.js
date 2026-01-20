const BIRDEYE_API_URL = 'https://public-api.birdeye.so';
const BIRDEYE_API_KEY = import.meta.env.VITE_BIRDEYE_API_KEY;

/**
 * Get wallet net worth and portfolio data from Birdeye
 * @param {string} walletAddress - The wallet address to check
 * @returns {Promise<{netWorth: number|null, solBalance: number|null, tokenCount: number|null}>}
 */
export async function getWalletNetWorth(walletAddress) {
  if (!BIRDEYE_API_KEY) {
    console.warn('Birdeye API key not configured');
    return { netWorth: null, solBalance: null, tokenCount: null };
  }

  try {
    const response = await fetch(
      `${BIRDEYE_API_URL}/v1/wallet/token_list?wallet=${walletAddress}`,
      {
        headers: {
          'X-API-KEY': BIRDEYE_API_KEY,
          'x-chain': 'solana'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Birdeye API error:', response.status, errorText);
      throw new Error(`Birdeye API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.data) {
      const tokens = data.data.items || [];

      // Calculate total portfolio value
      let totalValue = 0;
      let solBalance = null;

      tokens.forEach(token => {
        if (token.valueUsd) {
          totalValue += token.valueUsd;
        }
        // Check for native SOL
        if (token.address === 'So11111111111111111111111111111111111111112' ||
            token.symbol === 'SOL') {
          solBalance = token.uiAmount || null;
        }
      });

      return {
        netWorth: totalValue > 0 ? totalValue : null,
        solBalance,
        tokenCount: tokens.length
      };
    }

    return { netWorth: null, solBalance: null, tokenCount: null };
  } catch (error) {
    console.error('Birdeye getWalletNetWorth error:', error);
    return { netWorth: null, solBalance: null, tokenCount: null };
  }
}

/**
 * Get wallet transaction history summary
 * @param {string} walletAddress - The wallet address to check
 * @returns {Promise<{txCount: number|null, lastActiveTime: number|null}>}
 */
export async function getWalletActivity(walletAddress) {
  if (!BIRDEYE_API_KEY) {
    return { txCount: null, lastActiveTime: null };
  }

  try {
    const response = await fetch(
      `${BIRDEYE_API_URL}/v1/wallet/tx_list?wallet=${walletAddress}&limit=1`,
      {
        headers: {
          'X-API-KEY': BIRDEYE_API_KEY,
          'x-chain': 'solana'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Birdeye API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.data) {
      const txs = data.data.items || [];
      return {
        txCount: data.data.total || null,
        lastActiveTime: txs.length > 0 ? txs[0].blockTime : null
      };
    }

    return { txCount: null, lastActiveTime: null };
  } catch (error) {
    console.error('Birdeye getWalletActivity error:', error);
    return { txCount: null, lastActiveTime: null };
  }
}

/**
 * Get combined deployer wallet info
 * @param {string} walletAddress - The deployer wallet address
 * @returns {Promise<Object>}
 */
export async function getDeployerWalletInfo(walletAddress) {
  const [netWorthData, activityData] = await Promise.all([
    getWalletNetWorth(walletAddress),
    getWalletActivity(walletAddress)
  ]);

  return {
    ...netWorthData,
    ...activityData
  };
}
