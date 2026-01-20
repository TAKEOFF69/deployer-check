const SOLSCAN_API_URL = 'https://pro-api.solscan.io/v2.0';
const SOLSCAN_API_KEY = import.meta.env.VITE_SOLSCAN_API_KEY;

// Native SOL token address
const SOL_TOKEN = 'So11111111111111111111111111111111111111111';

/**
 * Get deployer wallet information including age and funding source
 * @param {string} walletAddress - The deployer wallet address
 * @returns {Promise<{deployerAge: number|null, fundedBy: string|null, fundingTx: string|null}>}
 */
export async function getDeployerInfo(walletAddress) {
  if (!SOLSCAN_API_KEY) {
    console.warn('Solscan API key not configured');
    return { deployerAge: null, fundedBy: null, fundingTx: null };
  }

  try {
    // Get first incoming SOL transfer to determine wallet age and funder
    const params = new URLSearchParams({
      address: walletAddress,
      token: SOL_TOKEN,
      flow: 'in',
      page: 1,
      page_size: 10,
      sort_by: 'block_time',
      sort_order: 'asc' // Oldest first
    });

    const response = await fetch(`${SOLSCAN_API_URL}/account/transfer?${params}`, {
      headers: {
        'token': SOLSCAN_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Solscan API error response:', response.status, errorText);
      throw new Error(`Solscan API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Solscan transfer response:', JSON.stringify(data, null, 2));

    // Handle various response formats from Solscan Pro API v2.0
    // The response can be: { data: [...] }, { data: { items: [...] } }, or { items: [...] }
    let transfers = [];
    if (Array.isArray(data.data)) {
      transfers = data.data;
    } else if (data.data && Array.isArray(data.data.items)) {
      transfers = data.data.items;
    } else if (Array.isArray(data.items)) {
      transfers = data.items;
    }

    if (transfers.length > 0) {
      const firstTransfer = transfers[0];
      console.log('First transfer:', firstTransfer);

      // Calculate wallet age in days - handle different field names from Solscan
      const blockTime = firstTransfer.block_time || firstTransfer.blockTime || firstTransfer.time || firstTransfer.block_timestamp;
      const fromAddress = firstTransfer.from_address || firstTransfer.fromAddress || firstTransfer.from || firstTransfer.source;
      const txId = firstTransfer.trans_id || firstTransfer.txHash || firstTransfer.signature || firstTransfer.tx_hash;

      if (blockTime) {
        const firstTxTime = blockTime * 1000; // Convert to milliseconds
        const ageInDays = Math.floor((Date.now() - firstTxTime) / (1000 * 60 * 60 * 24));

        return {
          deployerAge: ageInDays,
          fundedBy: fromAddress || null,
          fundingTx: txId || null
        };
      }
    }

    // Fallback: try to get age from account details endpoint
    console.log('No transfers found, trying account details endpoint for age');
    try {
      const detailsResponse = await fetch(
        `${SOLSCAN_API_URL}/account/detail?address=${walletAddress}`,
        { headers: { 'token': SOLSCAN_API_KEY } }
      );

      if (detailsResponse.ok) {
        const detailsData = await detailsResponse.json();
        console.log('Account details response:', JSON.stringify(detailsData, null, 2));

        const firstTxTime = detailsData?.data?.first_tx_time || detailsData?.first_tx_time;
        if (firstTxTime) {
          const ageInDays = Math.floor((Date.now() - firstTxTime * 1000) / (1000 * 60 * 60 * 24));
          return { deployerAge: ageInDays, fundedBy: null, fundingTx: null };
        }
      }
    } catch (detailsError) {
      console.error('Account details fallback error:', detailsError);
    }

    return { deployerAge: null, fundedBy: null, fundingTx: null };
  } catch (error) {
    console.error('Solscan getDeployerInfo error:', error);
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
