================================================================================
                    DEPLOYER ADDRESS DETECTION - TECHNICAL NOTES
================================================================================

PROJECT: FairScore - Solana Token Deployer Checker
PURPOSE: Finding the REAL deployer wallet address for pump.fun tokens

================================================================================
                              THE PROBLEM
================================================================================

When analyzing Solana tokens (especially those created via pump.fun), the
"creator" address returned by APIs like RugCheck is often NOT the actual
human deployer. Instead, it returns the pump.fun mint authority:

  TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM  (pump.fun mint authority)

This is useless for trust analysis because it's the same for ALL pump.fun
tokens. We need to find the actual wallet that initiated the token creation.

================================================================================
                         APPROACHES ATTEMPTED
================================================================================

1. RUGCHECK API (Initial Approach)
   --------------------------------
   - Used rugcheck.xyz/v1/tokens/{mint}/report
   - Returns `creator` field
   - PROBLEM: Returns pump.fun mint authority for pump.fun tokens
   - STATUS: Works for non-pump.fun tokens only

2. SOLSCAN PRO API
   ----------------
   - Endpoint: pro-api.solscan.io/v2.0
   - Requires paid API key for most useful endpoints
   - Can get account details, token accounts, transactions
   - PROBLEM: Paid tier required for transaction history deep dive
   - STATUS: Partially implemented with mock fallbacks

3. DIRECT SOLANA RPC - SIGNATURE PAGINATION (Current Approach)
   -----------------------------------------------------------
   File: fairscore-app/src/services/solscan.js

   Strategy:
   a) Get ALL transaction signatures for the token mint address
   b) Paginate backwards using getSignaturesForAddress (1000 at a time)
   c) Find the OLDEST transaction (the creation tx)
   d) Fetch full transaction details with getTransaction
   e) Analyze the transaction to find the real deployer

   RPC Endpoints Used (free, CORS-enabled):
   - https://solana-rpc.publicnode.com
   - https://go.getblock.io/d7dab8149ec7410aaa0f892c011420c1
   - https://api.mainnet-beta.solana.com

   Deployer Detection Strategies (in order):

   Strategy A: Fee Payer / First Signer
   - Look at accountKeys in the transaction
   - Find the first signer that's NOT a known program/authority
   - The fee payer (first account) is usually the deployer

   Strategy B: Inner Instructions Analysis
   - Check innerInstructions for transfer source addresses
   - Look for the wallet that initiated token transfers

   Strategy C: Log Message Parsing
   - Some programs log "creator: {address}" in transaction logs
   - Parse logMessages array for creator patterns

   Known Programs/Authorities to Skip:
   - 11111111111111111111111111111111 (System Program)
   - TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA (Token Program)
   - ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL (Associated Token)
   - 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P (Pump.fun program)
   - TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM (pump.fun authority)
   - 39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg (pump.fun authority)
   - Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1 (pump.fun bundled)

4. PUMP.FUN DETECTION
   ------------------
   - Tokens ending in 'pump' are pump.fun tokens
   - Example: 2eXamy7t3kvKhfV6aJ6Uwe3eh8cuREFcTKs1mFKZpump
   - These require the special deployer detection logic above

================================================================================
                           DEPLOYER INFO RETRIEVAL
================================================================================

Once we have the deployer address, we get additional info:

File: fairscore-app/src/services/solscan.js - getDeployerInfo()

1. WALLET AGE
   - Paginate through deployer's transaction history
   - Find oldest transaction timestamp
   - Calculate days since first activity

2. FUNDING SOURCE
   - Get the oldest transaction for the wallet
   - Analyze transfer instructions to find who sent initial SOL
   - Check inner instructions (CEX withdrawals use these)
   - Fall back to pre/post balance analysis

File: fairscore-app/src/services/birdeye.js - getWalletNetWorth()

3. CURRENT BALANCE
   - Use getBalance RPC call
   - Convert lamports to SOL
   - Multiply by SOL price from Birdeye API

================================================================================
                              KNOWN LIMITATIONS
================================================================================

1. Rate Limiting
   - Free RPC endpoints have rate limits
   - Pagination through thousands of signatures can be slow
   - Max 20 iterations (20k transactions) to prevent timeout

2. Complex Token Creation
   - Some tokens are created through multiple nested programs
   - Jupiter aggregator, Raydium, etc. add complexity
   - May return program address instead of user wallet in edge cases

3. CEX Withdrawals
   - When wallet is funded by CEX (Binance, Coinbase, etc.)
   - The "funder" will be the CEX hot wallet, not useful info
   - Could add CEX address detection in future

4. Bundled Transactions
   - Some deployers use transaction bundlers (Jito, etc.)
   - May obscure the actual initiator
   - Need to trace through bundle to find real user

================================================================================
                              SAMPLE DATA FILES
================================================================================

temp_rugcheck.json - Sample rugcheck API response showing:
  - creator: TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM (pump.fun authority)
  - This is why we need the custom deployer detection

tx_result.json - Sample transaction showing:
  - Complex Jupiter swap transaction
  - Multiple inner instructions
  - Address lookup tables
  - Shows complexity of Solana transaction parsing

================================================================================
                              FUTURE IMPROVEMENTS
================================================================================

1. Add caching layer for deployer lookups
2. Implement CEX hot wallet detection
3. Add more pump.fun authority addresses as discovered
4. Consider paid Helius/Triton RPC for better reliability
5. Add retry logic with exponential backoff
6. Consider indexing service (Helius DAS API) for faster lookups

================================================================================
                              FILE STRUCTURE
================================================================================

fairscore-app/
  src/
    services/
      solscan.js     - Deployer detection & wallet info (main logic)
      birdeye.js     - Wallet balance & SOL price
      rugcheck.js    - Initial token data (creator often wrong for pump.fun)
    components/
      TokenChecker.jsx - Main UI component
  server/
    index.js         - Express server for recent checks storage

================================================================================
