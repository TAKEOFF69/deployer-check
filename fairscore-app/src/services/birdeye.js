const BIRDEYE_API_URL = 'https://public-api.birdeye.so';
const BIRDEYE_API_KEY = import.meta.env.VITE_BIRDEYE_API_KEY;

// Lamports per SOL
const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Get SOL balance from Solana RPC (free, no API key required)
 * @param {string} walletAddress - The wallet address to check
 * @returns {Promise<number|null>} SOL balance or null
 */
async function getSolBalanceFromRPC(walletAddress) {
  // Try multiple RPC endpoints for reliability (browser-compatible, CORS-enabled, truly free)
  const RPC_ENDPOINTS = [
    'https://solana-rpc.publicnode.com',
    'https://go.getblock.io/d7dab8149ec7410aaa0f892c011420c1',
    'https://api.mainnet-beta.solana.com'
  ];

  for (const rpcUrl of RPC_ENDPOINTS) {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [walletAddress]
        })
      });

      if (!response.ok) {
        console.warn(`RPC ${rpcUrl} returned status ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (data.error) {
        console.warn(`RPC ${rpcUrl} error:`, data.error);
        continue;
      }

      const lamports = data.result?.value;

      if (lamports !== undefined && lamports !== null) {
        console.log(`Got SOL balance from ${rpcUrl}:`, lamports / LAMPORTS_PER_SOL);
        return lamports / LAMPORTS_PER_SOL;
      }
    } catch (error) {
      console.warn(`RPC ${rpcUrl} failed:`, error.message);
      continue;
    }
  }

  console.error('All RPC endpoints failed for getBalance');
  return null;
}

/**
 * Get SOL price in USD from Birdeye (this endpoint works on free tier)
 * @returns {Promise<number|null>} SOL price in USD or null
 */
async function getSolPrice() {
  if (!BIRDEYE_API_KEY) {
    console.warn('Birdeye API key not configured, using fallback price');
    return 125; // Fallback approximate SOL price
  }

  try {
    const response = await fetch(
      `${BIRDEYE_API_URL}/defi/price?address=So11111111111111111111111111111111111111112`,
      {
        headers: {
          'X-API-KEY': BIRDEYE_API_KEY,
          'x-chain': 'solana'
        }
      }
    );

    if (!response.ok) {
      console.warn('Birdeye price API failed, using fallback');
      return 125; // Fallback
    }

    const data = await response.json();
    const price = data.success ? data.data?.value : null;
    console.log('SOL price from Birdeye:', price);
    return price || 125; // Fallback if null
  } catch (error) {
    console.error('getSolPrice error:', error);
    return 125; // Fallback
  }
}

/**
 * Get wallet net worth and portfolio data
 * Uses free Solana RPC for balance + Birdeye for price
 * @param {string} walletAddress - The wallet address to check
 * @returns {Promise<{netWorth: number|null, solBalance: number|null, tokenCount: number|null}>}
 */
export async function getWalletNetWorth(walletAddress) {
  try {
    // Get SOL balance from RPC and price from Birdeye in parallel
    const [solBalance, solPrice] = await Promise.all([
      getSolBalanceFromRPC(walletAddress),
      getSolPrice()
    ]);

    // Calculate net worth (SOL balance * SOL price)
    let netWorth = null;
    if (solBalance !== null && solPrice !== null) {
      netWorth = solBalance * solPrice;
    }

    console.log('Wallet net worth data:', { solBalance, solPrice, netWorth });

    return {
      netWorth,
      solBalance,
      tokenCount: null // We can't get token count without the paid API
    };
  } catch (error) {
    console.error('getWalletNetWorth error:', error);
    return { netWorth: null, solBalance: null, tokenCount: null };
  }
}

/**
 * Get wallet transaction history summary using free Solana RPC
 * @param {string} walletAddress - The wallet address to check
 * @returns {Promise<{txCount: number|null, lastActiveTime: number|null}>}
 */
export async function getWalletActivity(walletAddress) {
  const RPC_ENDPOINTS = [
    'https://solana-rpc.publicnode.com',
    'https://go.getblock.io/d7dab8149ec7410aaa0f892c011420c1',
    'https://api.mainnet-beta.solana.com'
  ];

  for (const rpcUrl of RPC_ENDPOINTS) {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getSignaturesForAddress',
          params: [walletAddress, { limit: 1 }]
        })
      });

      if (!response.ok) {
        console.warn(`RPC ${rpcUrl} returned status ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (data.error) {
        console.warn(`RPC ${rpcUrl} error:`, data.error);
        continue;
      }

      const signatures = data.result || [];
      return {
        txCount: null,
        lastActiveTime: signatures.length > 0 ? signatures[0].blockTime : null
      };
    } catch (error) {
      console.warn(`RPC ${rpcUrl} failed:`, error.message);
      continue;
    }
  }

  console.error('All RPC endpoints failed for getWalletActivity');
  return { txCount: null, lastActiveTime: null };
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
