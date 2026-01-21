// Multiple RPC endpoints for reliability (browser-compatible, CORS-enabled, truly free)
const RPC_ENDPOINTS = [
  'https://solana-rpc.publicnode.com',
  'https://go.getblock.io/d7dab8149ec7410aaa0f892c011420c1',
  'https://api.mainnet-beta.solana.com'
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
 * Find the real deployer for a token (handles pump.fun tokens where creator is mint authority)
 * @param {string} tokenMint - The token mint address
 * @param {string} reportedCreator - The creator from rugcheck (may be pump.fun authority)
 * @returns {Promise<string>} The actual deployer wallet address
 */
export async function findRealDeployer(tokenMint, reportedCreator) {
  // Check if this is a pump.fun token (mint ends with 'pump')
  const isPumpFunToken = tokenMint.toLowerCase().endsWith('pump');

  // If reported creator is not a known mint authority AND not a pump.fun token, return as-is
  if (!KNOWN_MINT_AUTHORITIES.includes(reportedCreator) && !isPumpFunToken) {
    return reportedCreator;
  }

  console.log('Detected pump.fun token, finding real deployer...');

  try {
    // Find the creation transaction
    let signatures = [];
    let beforeSig = undefined;
    let iterations = 0;
    const maxIterations = 20; // Max 20k transactions

    while (iterations < maxIterations) {
      const params = { limit: 1000 };
      if (beforeSig) {
        params.before = beforeSig;
      }

      try {
        const batch = await rpcCall('getSignaturesForAddress', [tokenMint, params]);

        if (!batch || batch.length === 0) {
          break;
        }

        signatures = batch; // Keep latest batch (oldest sigs)
        beforeSig = batch[batch.length - 1].signature;
        iterations++;

        console.log(`Fetched ${iterations * 1000} signatures, continuing...`);

        if (batch.length < 1000) {
          break; // Reached the end
        }
      } catch (err) {
        console.warn('Error fetching signatures batch:', err.message);
        break; // Stop pagination on error but continue with what we have
      }
    }

    if (signatures.length === 0) {
      console.warn('No signatures found for token');
      return reportedCreator;
    }

    // Get the oldest signature (the creation tx) - last in the final batch
    const oldestSig = signatures[signatures.length - 1];
    console.log('Found oldest signature:', oldestSig.signature);

    // Get the transaction details
    const tx = await rpcCall('getTransaction', [oldestSig.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]);

    if (!tx) {
      return reportedCreator;
    }

    // Find the fee payer (the actual deployer who paid for the transaction)
    const accountKeys = tx.transaction?.message?.accountKeys || [];

    // The first signer that's not a program or known authority is usually the deployer
    for (const key of accountKeys) {
      const pubkey = typeof key === 'string' ? key : key.pubkey;
      const isSigner = typeof key === 'string' ? false : key.signer;

      if (isSigner && !isKnownProgramOrAuthority(pubkey)) {
        console.log('Found real deployer from transaction signer:', pubkey);
        return pubkey;
      }
    }

    // Strategy 3: Check inner instructions for the user who initiated
    const innerInstructions = tx.meta?.innerInstructions || [];
    for (const group of innerInstructions) {
      for (const ix of group.instructions || []) {
        const source = ix.parsed?.info?.source;
        if (source && !isKnownProgramOrAuthority(source)) {
          console.log('Found real deployer from inner instruction:', source);
          return source;
        }
      }
    }

    // Strategy 4: Check log messages for pump.fun create instruction
    const logMessages = tx.meta?.logMessages || [];
    for (const log of logMessages) {
      // Pump.fun logs often contain the creator address
      if (log.includes('Program log: creator:')) {
        const match = log.match(/creator:\s*([A-Za-z0-9]{32,44})/);
        if (match && match[1] && !isKnownProgramOrAuthority(match[1])) {
          console.log('Found real deployer from log message:', match[1]);
          return match[1];
        }
      }
    }

    return reportedCreator;
  } catch (error) {
    console.error('Error finding real deployer:', error);
    return reportedCreator;
  }
}

/**
 * Get deployer wallet information including age and funding source
 * Uses free Solana RPC instead of paid Solscan Pro API
 * @param {string} walletAddress - The deployer wallet address
 * @returns {Promise<{deployerAge: number|null, fundedBy: string|null, fundingTx: string|null}>}
 */
export async function getDeployerInfo(walletAddress) {
  try {
    // Step 1: Get transaction signatures, paginating to find the oldest one
    let signatures = [];
    let beforeSig = undefined;
    let iterations = 0;
    const maxIterations = 10; // Max 10k transactions to check

    // Paginate through signatures to find the oldest
    while (iterations < maxIterations) {
      const params = { limit: 1000 };
      if (beforeSig) {
        params.before = beforeSig;
      }

      try {
        const batch = await rpcCall('getSignaturesForAddress', [walletAddress, params]);

        if (!batch || batch.length === 0) {
          break; // No more signatures
        }

        signatures = batch; // Keep the latest batch (we want the oldest from the last batch)
        beforeSig = batch[batch.length - 1].signature;
        iterations++;

        // If we got less than 1000, we've reached the end
        if (batch.length < 1000) {
          break;
        }
      } catch (err) {
        console.warn('Failed to get signatures:', err.message);
        break;
      }
    }

    if (signatures.length === 0) {
      console.log('No transactions found for wallet');
      return { deployerAge: null, fundedBy: null, fundingTx: null };
    }

    // Get the oldest signature (last in the final batch)
    const oldestSig = signatures[signatures.length - 1];
    const oldestSignature = oldestSig.signature;
    const oldestBlockTime = oldestSig.blockTime;

    // Calculate wallet age in days
    let deployerAge = null;
    if (oldestBlockTime) {
      const ageInDays = Math.floor((Date.now() - oldestBlockTime * 1000) / (1000 * 60 * 60 * 24));
      deployerAge = ageInDays;
    }

    // Step 2: Get transaction details to find the funder
    let transaction = null;
    try {
      transaction = await rpcCall('getTransaction', [oldestSignature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]);
    } catch (err) {
      console.warn('Failed to get transaction:', err.message);
      return { deployerAge, fundedBy: null, fundingTx: oldestSignature };
    }

    if (!transaction) {
      return { deployerAge, fundedBy: null, fundingTx: oldestSignature };
    }

    // Find the funder by looking at transfer instructions (including inner instructions for CEX withdrawals)
    let fundedBy = null;
    const instructions = transaction.transaction?.message?.instructions || [];
    const innerInstructions = transaction.meta?.innerInstructions || [];

    // Helper to check transfer instructions
    const checkTransferInstruction = (ix) => {
      // Check for system program transfer
      if (ix.parsed?.type === 'transfer' && ix.program === 'system') {
        const dest = ix.parsed.info?.destination;
        const source = ix.parsed.info?.source;
        if (dest === walletAddress && source) {
          return source;
        }
      }
      // Check for createAccount instruction
      if (ix.parsed?.type === 'createAccount' && ix.program === 'system') {
        const newAccount = ix.parsed.info?.newAccount;
        const source = ix.parsed.info?.source;
        if (newAccount === walletAddress && source) {
          return source;
        }
      }
      return null;
    };

    // Check main instructions
    for (const ix of instructions) {
      const funder = checkTransferInstruction(ix);
      if (funder) {
        fundedBy = funder;
        break;
      }
    }

    // If not found, check inner instructions (CEX withdrawals often use these)
    if (!fundedBy) {
      for (const innerGroup of innerInstructions) {
        for (const ix of innerGroup.instructions || []) {
          const funder = checkTransferInstruction(ix);
          if (funder) {
            fundedBy = funder;
            break;
          }
        }
        if (fundedBy) break;
      }
    }

    // If still not found, check pre/post balances to find who sent SOL
    if (!fundedBy && transaction.meta) {
      const preBalances = transaction.meta.preBalances || [];
      const postBalances = transaction.meta.postBalances || [];
      const accountKeys = transaction.transaction?.message?.accountKeys || [];

      // Find our wallet's index
      const walletIndex = accountKeys.findIndex(
        key => (typeof key === 'string' ? key : key.pubkey) === walletAddress
      );

      if (walletIndex !== -1) {
        const walletPreBalance = preBalances[walletIndex] || 0;
        const walletPostBalance = postBalances[walletIndex] || 0;
        const received = walletPostBalance - walletPreBalance;

        // If we received SOL, find who sent it (their balance decreased)
        if (received > 0) {
          for (let i = 0; i < accountKeys.length; i++) {
            if (i === walletIndex) continue;
            const preBal = preBalances[i] || 0;
            const postBal = postBalances[i] || 0;
            const sent = preBal - postBal;

            // Account that sent roughly the same amount we received (allowing for fees)
            if (sent > 0 && Math.abs(sent - received) < 10000000) { // Within 0.01 SOL for fees
              const key = accountKeys[i];
              fundedBy = typeof key === 'string' ? key : key.pubkey;
              break;
            }
          }
        }
      }
    }

    // If no funder found in instructions, check if fee payer is different from wallet
    if (!fundedBy) {
      const accountKeys = transaction.transaction?.message?.accountKeys || [];
      const feePayer = accountKeys.find(key => key.signer && key.writable);
      if (feePayer && feePayer.pubkey !== walletAddress) {
        fundedBy = feePayer.pubkey;
      }
    }

    console.log('Deployer info from Solana RPC:', { deployerAge, fundedBy, fundingTx: oldestSignature });

    return {
      deployerAge,
      fundedBy,
      fundingTx: oldestSignature
    };
  } catch (error) {
    console.error('getDeployerInfo error:', error);
    return { deployerAge: null, fundedBy: null, fundingTx: null };
  }
}

/**
 * Generate Solscan URLs for wallet and transaction
 */
export function getSolscanWalletUrl(address) {
  return `https://solscan.io/account/${address}`;
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
