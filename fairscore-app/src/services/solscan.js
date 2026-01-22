// Helius API key (free tier: 1M credits, 10 RPS) - get yours at https://helius.dev
const HELIUS_API_KEY = import.meta.env.VITE_HELIUS_API_KEY;

// Helius Enhanced API base URL (better than raw RPC for historical data)
const HELIUS_ENHANCED_API = HELIUS_API_KEY
  ? `https://api.helius.xyz/v0`
  : null;

// Multiple RPC endpoints for reliability (browser-compatible, CORS-enabled)
// Helius RPC is most reliable if API key is set
const RPC_ENDPOINTS = [
  ...(HELIUS_API_KEY ? [`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`] : []),
  'https://solana-rpc.publicnode.com'
];

// Known pump.fun / platform mint authorities (not real deployers)
const KNOWN_MINT_AUTHORITIES = [
  'TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM', // pump.fun mint authority
  '39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg', // Another pump.fun authority
  'Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1', // pump.fun bundled authority
];

// Known program IDs to skip when looking for deployer
const KNOWN_PROGRAMS = [
  '11111111111111111111111111111111', // System Program
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token Program
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token Program
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P', // Pump.fun program
  'ComputeBudget111111111111111111111111111111', // Compute Budget
  'Sysvar1111111111111111111111111111111111111', // Sysvar
  'SysvarRent111111111111111111111111111111111', // Rent Sysvar
];

// Legacy Solscan Pro API (requires paid tier for most endpoints)
const SOLSCAN_API_URL = 'https://pro-api.solscan.io/v2.0';
const SOLSCAN_API_KEY = import.meta.env.VITE_SOLSCAN_API_KEY;

/**
 * Make an RPC call with fallback to multiple endpoints
 */
async function rpcCall(method, params) {
  for (const rpcUrl of RPC_ENDPOINTS) {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method,
          params
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

      return data.result;
    } catch (error) {
      console.warn(`RPC ${rpcUrl} failed:`, error.message);
      continue;
    }
  }

  throw new Error('All RPC endpoints failed');
}

/**
 * Check if an address is a known program or authority (not a real user wallet)
 */
function isKnownProgramOrAuthority(pubkey) {
  if (!pubkey) return true;
  if (KNOWN_MINT_AUTHORITIES.includes(pubkey)) return true;
  if (KNOWN_PROGRAMS.includes(pubkey)) return true;
  // Check for system program pattern (ends with many 1s)
  if (pubkey.endsWith('1111111111111111111111')) return true;
  return false;
}

/**
 * Find the real deployer for a token using Helius Enhanced API
 * The feePayer of the token's first transaction is the real deployer
 * @param {string} tokenMint - The token mint address
 * @param {string} reportedCreator - The creator from rugcheck (fallback)
 * @returns {Promise<string>} The actual deployer wallet address
 */
export async function findRealDeployer(tokenMint, reportedCreator) {
  console.log('Finding real deployer for token:', tokenMint);

  // Try Helius first (fast and reliable)
  if (HELIUS_ENHANCED_API) {
    try {
      // Get the token's transactions (Helius returns newest first by default)
      const url = `${HELIUS_ENHANCED_API}/addresses/${tokenMint}/transactions?api-key=${HELIUS_API_KEY}&limit=50`;
      const response = await fetch(url);

      if (response.ok) {
        let transactions = await response.json();
        if (transactions && transactions.length > 0) {
          // Sort by timestamp ascending to get oldest first
          transactions = transactions.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          const firstTx = transactions[0];
          console.log('Oldest token tx timestamp:', firstTx.timestamp, 'feePayer:', firstTx.feePayer);
          // The feePayer of the first transaction is the real deployer
          if (firstTx.feePayer && !isKnownProgramOrAuthority(firstTx.feePayer)) {
            console.log('Found real deployer via Helius:', firstTx.feePayer);
            return firstTx.feePayer;
          }
        }
      }
    } catch (err) {
      console.warn('Helius deployer lookup failed:', err.message);
    }
  }

  // Fallback: if not a known mint authority, use reported creator
  if (!KNOWN_MINT_AUTHORITIES.includes(reportedCreator)) {
    return reportedCreator;
  }

  // Last resort for pump.fun tokens: use RPC
  console.log('Falling back to RPC for deployer lookup...');
  return findRealDeployerViaRPC(tokenMint, reportedCreator);
}

/**
 * Fallback: Find real deployer using RPC (slower)
 */
async function findRealDeployerViaRPC(tokenMint, reportedCreator) {
  try {
    // Get oldest signature
    const signatures = await rpcCall('getSignaturesForAddress', [tokenMint, { limit: 1 }]);

    if (!signatures || signatures.length === 0) {
      return reportedCreator;
    }

    // Get the transaction
    const tx = await rpcCall('getTransaction', [signatures[0].signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]);

    if (!tx) {
      return reportedCreator;
    }

    // Find the first signer that's not a program
    const accountKeys = tx.transaction?.message?.accountKeys || [];
    for (const key of accountKeys) {
      const pubkey = typeof key === 'string' ? key : key.pubkey;
      const isSigner = typeof key === 'string' ? false : key.signer;

      if (isSigner && !isKnownProgramOrAuthority(pubkey)) {
        console.log('Found real deployer via RPC:', pubkey);
        return pubkey;
      }
    }

    return reportedCreator;
  } catch (error) {
    console.error('RPC deployer lookup failed:', error);
    return reportedCreator;
  }
}

/**
 * Get deployer wallet information including age and funding source
 * Uses Helius Enhanced API (preferred) or falls back to RPC
 * @param {string} walletAddress - The deployer wallet address
 * @returns {Promise<{deployerAge: number|null, fundedBy: string|null, fundingTx: string|null}>}
 */
export async function getDeployerInfo(walletAddress) {
  // Try Helius first (faster and more reliable)
  if (HELIUS_ENHANCED_API) {
    try {
      const result = await getDeployerInfoViaHelius(walletAddress);
      if (result.fundedBy || result.deployerAge) {
        return result;
      }
    } catch (err) {
      console.warn('Helius failed, falling back to RPC:', err.message);
    }
  }

  // Fallback to RPC
  return getDeployerInfoViaRPC(walletAddress);
}

/**
 * Get deployer info using Helius Enhanced API
 */
async function getDeployerInfoViaHelius(walletAddress) {
  console.log('Fetching deployer info via Helius...');

  // Fetch transactions (Helius returns newest first by default)
  // Use high limit to ensure we get the oldest transactions for wallets with lots of activity
  const url = `${HELIUS_ENHANCED_API}/addresses/${walletAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=1000`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Helius API returned ${response.status}`);
  }

  let transactions = await response.json();
  console.log(`Helius returned ${transactions.length} transactions`);

  // Sort by timestamp ascending (oldest first)
  transactions = transactions.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  console.log('Sorted oldest first, oldest timestamp:', transactions[0]?.timestamp);

  if (!transactions || transactions.length === 0) {
    return { deployerAge: null, fundedBy: null, fundingTx: null };
  }

  // First transaction is the oldest (wallet creation/first funding)
  const oldestTx = transactions[0];

  // Calculate wallet age from oldest transaction
  let deployerAge = null;
  if (oldestTx.timestamp) {
    const ageInDays = Math.floor((Date.now() / 1000 - oldestTx.timestamp) / (60 * 60 * 24));
    deployerAge = ageInDays;
  }

  // Find the funding source - look for the FIRST incoming SOL transfer
  let fundedBy = null;
  let fundingTx = oldestTx.signature;

  for (const tx of transactions) {
    if (tx.nativeTransfers) {
      for (const transfer of tx.nativeTransfers) {
        if (transfer.toUserAccount === walletAddress &&
            transfer.fromUserAccount &&
            transfer.fromUserAccount !== walletAddress &&
            transfer.amount > 10000) {
          fundedBy = transfer.fromUserAccount;
          fundingTx = tx.signature;
          console.log('Found funder:', fundedBy, 'tx:', tx.signature?.slice(0, 20));
          break;
        }
      }
      if (fundedBy) break;
    }
  }

  console.log('Deployer info from Helius:', { deployerAge, fundedBy, fundingTx });
  return { deployerAge, fundedBy, fundingTx };
}

/**
 * Fallback: Get deployer info using RPC
 */
async function getDeployerInfoViaRPC(walletAddress) {
  console.log('Fetching deployer info via RPC...');

  try {
    // Get signatures to find oldest transaction
    const signatures = await rpcCall('getSignaturesForAddress', [walletAddress, { limit: 1000 }]);

    if (!signatures || signatures.length === 0) {
      return { deployerAge: null, fundedBy: null, fundingTx: null };
    }

    // Get the oldest signature
    const oldestSig = signatures[signatures.length - 1];

    // Calculate age
    let deployerAge = null;
    if (oldestSig.blockTime) {
      deployerAge = Math.floor((Date.now() - oldestSig.blockTime * 1000) / (1000 * 60 * 60 * 24));
    }

    // Get transaction details
    const tx = await rpcCall('getTransaction', [oldestSig.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]);

    let fundedBy = null;
    if (tx) {
      // Look for transfer to this wallet
      const instructions = tx.transaction?.message?.instructions || [];
      for (const ix of instructions) {
        if (ix.parsed?.type === 'transfer' && ix.program === 'system') {
          if (ix.parsed.info?.destination === walletAddress) {
            fundedBy = ix.parsed.info?.source;
            break;
          }
        }
      }

      // Check inner instructions
      if (!fundedBy) {
        const innerInstructions = tx.meta?.innerInstructions || [];
        for (const group of innerInstructions) {
          for (const ix of group.instructions || []) {
            if (ix.parsed?.type === 'transfer' && ix.program === 'system') {
              if (ix.parsed.info?.destination === walletAddress) {
                fundedBy = ix.parsed.info?.source;
                break;
              }
            }
          }
          if (fundedBy) break;
        }
      }
    }

    console.log('Deployer info from RPC:', { deployerAge, fundedBy });
    return { deployerAge, fundedBy, fundingTx: oldestSig.signature };
  } catch (error) {
    console.error('RPC getDeployerInfo error:', error);
    return { deployerAge: null, fundedBy: null, fundingTx: null };
  }
}

/**
 * Generate Solscan URLs for wallet and transaction
 */
export function getSolscanWalletUrl(address) {
  return `https://solscan.io/account/${address}`;
}

/**
 * Get other tokens created by the same deployer
 * Scans deployer's transactions for pump.fun token creations
 * @param {string} deployerAddress - The deployer wallet address
 * @param {string} excludeToken - Current token to exclude from results
 * @returns {Promise<Array<{mint: string, createdAt: string}>>}
 */
export async function getDeployerCreatedTokens(deployerAddress, excludeToken) {
  if (!HELIUS_ENHANCED_API || !deployerAddress) {
    return [];
  }

  console.log('Finding other tokens created by wallet:', deployerAddress);

  try {
    // Get wallet's transactions
    const url = `${HELIUS_ENHANCED_API}/addresses/${deployerAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=100`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn('Failed to fetch transactions for wallet:', deployerAddress, response.status);
      return [];
    }

    const transactions = await response.json();
    const excludeLower = excludeToken?.toLowerCase();

    // Look for CREATE transactions where this wallet is the feePayer
    // This avoids needing to verify each token separately (which causes rate limiting)
    const createdTokens = [];
    const seenMints = new Set();

    for (const tx of transactions) {
      // Only look at transactions where this wallet paid the fee (they initiated it)
      if (tx.feePayer !== deployerAddress) continue;

      // Look for PUMP_FUN CREATE transactions
      if (tx.source === 'PUMP_FUN' && tx.type === 'CREATE') {
        // Get the token from tokenTransfers
        if (tx.tokenTransfers) {
          for (const transfer of tx.tokenTransfers) {
            if (transfer.mint && transfer.mint.toLowerCase().endsWith('pump')) {
              const mintLower = transfer.mint.toLowerCase();
              if (mintLower !== excludeLower && !seenMints.has(mintLower)) {
                seenMints.add(mintLower);
                createdTokens.push({
                  mint: transfer.mint,
                  createdAt: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : null
                });
                console.log('Found created token:', transfer.mint);
              }
            }
          }
        }
      }
    }

    console.log(`Found ${createdTokens.length} tokens created by wallet ${deployerAddress}`);
    return createdTokens;
  } catch (error) {
    console.error('Error finding deployer tokens:', error);
    return [];
  }
}

export function getSolscanTxUrl(txHash) {
  return `https://solscan.io/tx/${txHash}`;
}

export async function getAccountDetails(walletAddress) {
  if (!SOLSCAN_API_KEY) {
    console.warn('Solscan API key not configured');
    return getMockAccountDetails(walletAddress);
  }

  try {
    const response = await fetch(
      `${SOLSCAN_API_URL}/account/detail?address=${walletAddress}`,
      {
        headers: { 'token': SOLSCAN_API_KEY }
      }
    );

    if (!response.ok) {
      throw new Error('Solscan API error');
    }

    return response.json();
  } catch (error) {
    console.error('Solscan API error:', error);
    return getMockAccountDetails(walletAddress);
  }
}

export async function getTokensCreated(walletAddress) {
  if (!SOLSCAN_API_KEY) {
    console.warn('Solscan API key not configured');
    return getMockTokensCreated();
  }

  try {
    const response = await fetch(
      `${SOLSCAN_API_URL}/account/token-accounts?address=${walletAddress}`,
      {
        headers: { 'token': SOLSCAN_API_KEY }
      }
    );

    if (!response.ok) {
      throw new Error('Solscan API error');
    }

    return response.json();
  } catch (error) {
    console.error('Solscan token API error:', error);
    return getMockTokensCreated();
  }
}

export async function getAccountTransactions(walletAddress) {
  if (!SOLSCAN_API_KEY) {
    console.warn('Solscan API key not configured');
    return { data: [] };
  }

  try {
    const response = await fetch(
      `${SOLSCAN_API_URL}/account/transactions?address=${walletAddress}&limit=50`,
      {
        headers: { 'token': SOLSCAN_API_KEY }
      }
    );

    if (!response.ok) {
      throw new Error('Solscan transactions API error');
    }

    return response.json();
  } catch (error) {
    console.error('Solscan transactions API error:', error);
    return { data: [] };
  }
}

// Calculate wallet age from account creation
export function calculateWalletAge(accountData) {
  if (accountData?.data?.first_tx_time) {
    const firstTxDate = new Date(accountData.data.first_tx_time * 1000);
    const now = new Date();
    const diffTime = Math.abs(now - firstTxDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return null;
}

// Mock data for development
function getMockAccountDetails(walletAddress) {
  const hash = walletAddress.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);

  const daysAgo = Math.abs(hash % 1000) + 30;
  const firstTxTime = Math.floor(Date.now() / 1000) - (daysAgo * 24 * 60 * 60);

  return {
    data: {
      address: walletAddress,
      lamports: Math.abs(hash % 10000000000),
      first_tx_time: firstTxTime,
      executable: false
    }
  };
}

function getMockTokensCreated() {
  return {
    data: {
      tokens: Array(Math.floor(Math.random() * 5)).fill(null).map((_, i) => ({
        mint: `mock_token_${i}`,
        amount: Math.floor(Math.random() * 1000000)
      }))
    }
  };
}
