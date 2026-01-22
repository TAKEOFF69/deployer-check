import { useState, useEffect } from 'react';
import { getFairScore, getTierFromScore } from './services/fairscale';
import { getTokenReport } from './services/rugcheck';
import { generateRoast } from './services/grok';
import { getDeployerInfo, findRealDeployer, getDeployerCreatedTokens } from './services/solscan';
import { getDeployerWalletInfo } from './services/birdeye';
import { loadLeaderboard, saveToLeaderboard, isValidSolanaAddress, cleanTwitterHandle } from './utils/storage';
import { fetchRecentChecks, saveRecentCheck } from './services/recentChecks';

// Custom emoji paths
const EMOJIS = {
  check: ['/emojis/check.webp', '/emojis/check-2.webp', '/emojis/check-3.webp', '/emojis/check-4.webp', '/emojis/check-6.webp'],
  good: ['/emojis/good.webp', '/emojis/good-2.webp', '/emojis/good-3.webp', '/emojis/good-4.webp'],
  mid: ['/emojis/mid.webp', '/emojis/mid-2.webp', '/emojis/mid-3.webp', '/emojis/mid-4.webp', '/emojis/mid-5.webp', '/emojis/mid-6.webp'],
  bad: ['/emojis/bad.webp', '/emojis/bad-2.webp', '/emojis/bad-3.webp', '/emojis/bad-4.webp', '/emojis/bad-5.webp'],
};

const getRandomEmoji = (category) => {
  const emojis = EMOJIS[category];
  return emojis[Math.floor(Math.random() * emojis.length)];
};

const getTierEmoji = (tier) => {
  if (tier === 'UNICORN' || tier === 'KEEP AN EYE') return getRandomEmoji('good');
  if (tier === 'POTENTIAL' || tier === 'MEH+' || tier === 'MEH') return getRandomEmoji('mid');
  return getRandomEmoji('bad');
};

// Clean roast text - remove any quotes
const cleanRoast = (roast) => {
  if (!roast) return '';
  return roast.replace(/^["']+|["']+$/g, '').trim();
};

function App() {
  const [screen, setScreen] = useState('landing');
  const [tokenCA, setTokenCA] = useState('');
  const [devTwitter, setDevTwitter] = useState('');
  const [currentResult, setCurrentResult] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [error, setError] = useState(null);
  const [loadingEmoji, setLoadingEmoji] = useState(getRandomEmoji('check'));

  useEffect(() => {
    // Load from server first, fallback to local storage
    fetchRecentChecks().then(serverData => {
      if (serverData && serverData.length > 0) {
        setLeaderboard(serverData);
      } else {
        setLeaderboard(loadLeaderboard());
      }
    });
  }, []);

  // Cycle through check emojis during loading
  useEffect(() => {
    if (screen === 'loading') {
      const interval = setInterval(() => {
        setLoadingEmoji(getRandomEmoji('check'));
      }, 800);
      return () => clearInterval(interval);
    }
  }, [screen]);

  const checkToken = async () => {
    const cleanedTwitter = cleanTwitterHandle(devTwitter);

    if (!isValidSolanaAddress(tokenCA)) {
      setError('ngmi - invalid address');
      return;
    }

    setError(null);
    setScreen('loading');

    try {
      const tokenReport = await getTokenReport(tokenCA);

      if (!tokenReport) {
        setError('token not found ser');
        setScreen('landing');
        return;
      }

      const reportedCreator = tokenReport.creator;
      if (!reportedCreator) {
        setError('no deployer found');
        setScreen('landing');
        return;
      }

      // Find the real deployer (handles pump.fun tokens where creator is mint authority)
      const deployerWallet = await findRealDeployer(tokenCA, reportedCreator);
      console.log('Real deployer:', deployerWallet, '(reported:', reportedCreator, ')');

      // Get creator tokens from rugcheck initially (will be augmented after we get funder info)
      let rugcheckCreatorTokens = tokenReport.creatorTokens || [];
      console.log('Rugcheck creatorTokens:', rugcheckCreatorTokens);

      // tokensLaunched will be recalculated after we fetch from both deployer and funder
      let allCreatorTokens = rugcheckCreatorTokens;

      let currentMarketCap = null;
      if (tokenReport.price != null && tokenReport.token?.supply != null) {
        const decimals = tokenReport.token.decimals || 6;
        const supply = tokenReport.token.supply / Math.pow(10, decimals);
        currentMarketCap = tokenReport.price * supply;
      }

      const topMarketCap = allCreatorTokens.length > 0
        ? Math.max(...allCreatorTokens.map(t => t.marketCap || 0))
        : null;

      let top10HeldPct = null;
      if (tokenReport.topHolders && tokenReport.topHolders.length > 0) {
        const top10 = tokenReport.topHolders.slice(0, 10);
        top10HeldPct = top10.reduce((sum, holder) => sum + (holder.pct || 0), 0);
      }

      const totalHolders = tokenReport.totalHolders || null;

      // Calculate deployer age from token creation dates (more accurate than RPC)
      // Use the oldest token creation date from creatorTokens, or current token's detectedAt
      let tokenBasedAge = null;
      const allTokenDates = [];

      // Add current token's creation date if available
      if (tokenReport.detectedAt) {
        allTokenDates.push(new Date(tokenReport.detectedAt).getTime());
      }

      // Add all creator tokens' creation dates
      for (const t of allCreatorTokens) {
        if (t.createdAt) {
          allTokenDates.push(new Date(t.createdAt).getTime());
        }
      }

      if (allTokenDates.length > 0) {
        const oldestDate = Math.min(...allTokenDates);
        tokenBasedAge = Math.floor((Date.now() - oldestDate) / (1000 * 60 * 60 * 24));
      }

      // Fetch deployer info from multiple sources in parallel
      const [deployerInfo, walletInfo, fairScoreData] = await Promise.all([
        getDeployerInfo(deployerWallet),
        getDeployerWalletInfo(deployerWallet),
        getFairScore(deployerWallet, cleanedTwitter)
      ]);

      const { deployerAge: rpcDeployerAge, fundedBy, fundingTx } = deployerInfo;
      const { netWorth, solBalance, tokenCount } = walletInfo;

      // Now that we have fundedBy, fetch creator tokens from BOTH deployer AND funder
      if (rugcheckCreatorTokens.length === 0) {
        // Get tokens from deployer
        const deployerTokens = await getDeployerCreatedTokens(deployerWallet, tokenCA);

        // Get tokens from funder too (if different from deployer)
        let funderTokens = [];
        if (fundedBy && fundedBy !== deployerWallet) {
          funderTokens = await getDeployerCreatedTokens(fundedBy, tokenCA);
        }

        // Merge both (avoid duplicates)
        const seenMints = new Set(deployerTokens.map(t => t.mint));
        allCreatorTokens = [...deployerTokens];
        for (const token of funderTokens) {
          if (!seenMints.has(token.mint)) {
            allCreatorTokens.push(token);
          }
        }
      }

      // Recalculate tokensLaunched with the full creator tokens list
      const tokensLaunched = allCreatorTokens.length + 1;
      console.log('Final allCreatorTokens:', allCreatorTokens);

      // Prefer token-based age (more accurate), fallback to RPC-based age
      const deployerAge = tokenBasedAge ?? rpcDeployerAge;
      const score = fairScoreData?.score ?? 500;
      const tier = fairScoreData?.tier || getTierFromScore(score);

      let roast;
      try {
        const deployerDataForRoast = {
          tokensLaunched,
          deployerAge,
          topMarketCap,
          currentMarketCap,
          totalHolders,
          top10HeldPct,
          risks: tokenReport.risks || []
        };
        roast = await generateRoast(score, tier, deployerDataForRoast);
      } catch (e) {
        roast = "this deployer is hiding something";
      }

      const tokenName = tokenReport.tokenMeta?.name ||
        tokenReport.token_extensions?.tokenMetadata?.name || null;
      const tokenSymbol = tokenReport.tokenMeta?.symbol ||
        tokenReport.token_extensions?.tokenMetadata?.symbol || null;

      const result = {
        tokenAddress: tokenCA,
        deployerWallet,
        twitterHandle: cleanedTwitter,
        fairScore: score,
        tier,
        roast: cleanRoast(roast),
        tokensLaunched,
        deployerAge,
        fundedBy,
        fundingTx,
        topMarketCap,
        currentMarketCap,
        top10HeldPct,
        totalHolders,
        tokenName,
        tokenSymbol,
        creatorTokens: allCreatorTokens,
        risks: tokenReport.risks || [],
        rugged: tokenReport.rugged || false,
        // Birdeye wallet data
        deployerNetWorth: netWorth,
        deployerSolBalance: solBalance,
        deployerTokenCount: tokenCount,
        checkedAt: Date.now()
      };

      setCurrentResult(result);

      const leaderboardEntry = {
        id: tokenCA,
        tokenAddress: tokenCA,
        deployerWallet,
        tokenName: result.tokenName,
        fairScore: result.fairScore,
        tier: result.tier,
        twitterHandle: cleanedTwitter,
        topMarketCap: result.topMarketCap,
        currentMarketCap: result.currentMarketCap,
        top10HeldPct: result.top10HeldPct,
        totalHolders: result.totalHolders,
        tokensLaunched: result.tokensLaunched,
        checkedAt: result.checkedAt
      };

      // Save to local storage as fallback
      const updatedLeaderboard = saveToLeaderboard(leaderboardEntry);
      setLeaderboard(updatedLeaderboard);

      // Also save to server for global visibility
      saveRecentCheck(leaderboardEntry).then(serverEntry => {
        if (serverEntry) {
          // Refresh from server to get latest data
          fetchRecentChecks().then(serverData => {
            if (serverData && serverData.length > 0) {
              setLeaderboard(serverData);
            }
          });
        }
      });
      setScreen('roast');

    } catch (err) {
      console.error('Error:', err);
      setError('something broke lmao');
      setScreen('landing');
    }
  };

  const handleBack = () => {
    setScreen('landing');
    setCurrentResult(null);
    setTokenCA('');
    setDevTwitter('');
  };

  const handleTokenClick = (entry) => {
    setTokenCA(entry.tokenAddress);
    setDevTwitter(entry.twitterHandle || '');
    checkToken();
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] bg-grid bg-noise">
      {screen === 'landing' && (
        <LandingScreen
          tokenCA={tokenCA}
          setTokenCA={setTokenCA}
          devTwitter={devTwitter}
          setDevTwitter={setDevTwitter}
          onSubmit={checkToken}
          error={error}
        />
      )}

      {screen === 'loading' && <LoadingScreen emoji={loadingEmoji} />}

      {screen === 'roast' && (
        <RoastScreen
          result={currentResult}
          onFindOut={() => setScreen('results')}
        />
      )}

      {screen === 'results' && (
        <ResultsScreen
          result={currentResult}
          leaderboard={leaderboard}
          onBack={handleBack}
          onTokenClick={handleTokenClick}
        />
      )}
    </div>
  );
}

// ==============================================
// LANDING SCREEN
// ==============================================
function LandingScreen({ tokenCA, setTokenCA, devTwitter, setDevTwitter, onSubmit, error }) {
  const [emoji] = useState(getRandomEmoji('check'));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-[5%]">
      <div className="w-full max-w-md animate-scale-pop">
        <div className="card-funky p-[8%]">
          {/* Header */}
          <div className="text-center mb-[8%]">
            <img
              src={emoji}
              alt="emoji"
              className="w-20 h-20 mx-auto mb-[6%] animate-float"
            />
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] uppercase tracking-tight">
              why trust the dev?
            </h1>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-[5%]">
            <div>
              <label className="block text-[var(--color-accent)] text-xs mb-2 uppercase tracking-widest font-bold">
                token ca
              </label>
              <input
                type="text"
                value={tokenCA}
                onChange={(e) => setTokenCA(e.target.value)}
                placeholder="paste that shit"
                className="input-funky"
                autoComplete="off"
                spellCheck="false"
              />
            </div>

            <div>
              <label className="block text-[var(--color-accent)] text-xs mb-2 uppercase tracking-widest font-bold">
                dev twitter <span className="text-[var(--color-text-tertiary)]">(optional)</span>
              </label>
              <input
                type="text"
                value={devTwitter}
                onChange={(e) => setDevTwitter(e.target.value)}
                placeholder="@degen_dev"
                className="input-funky"
                autoComplete="off"
              />
            </div>

            {error && (
              <div className="border-2 border-[var(--color-danger)] bg-[var(--color-danger)]/10 p-[4%] text-[var(--color-danger)] text-sm text-center font-bold uppercase animate-shake">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!tokenCA.trim()}
              className="btn-funky w-full mt-[4%]"
            >
              <span>VERIFY!</span>
            </button>
            <p className="text-center text-[var(--color-text-tertiary)] text-[10px] mt-3">
              may take up to 1 minute
            </p>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[var(--color-text-tertiary)] text-xs mt-[6%]">
          powered by{' '}
          <a
            href="https://app.fairscale.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-accent)] hover:underline font-bold"
          >
            FairScale
          </a>
        </p>
      </div>
    </div>
  );
}

// ==============================================
// LOADING SCREEN
// ==============================================
function LoadingScreen({ emoji }) {
  const phrases = [
    "scanning blockchain",
    "interrogating deployer",
    "checking for rugs",
    "computing vibes",
    "asking grok"
  ];

  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % phrases.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-[5%]">
      <div className="text-center">
        <img
          src={emoji}
          alt="checking"
          className="w-28 h-28 mx-auto mb-[8%] animate-chaos-spin"
        />
        <p className="text-[var(--color-text-primary)] text-lg font-bold uppercase tracking-wider">
          checking
        </p>
        <p className="text-[var(--color-text-secondary)] text-sm mt-[2%]">
          {phrases[phraseIndex]}
          <span className="typing-dots" />
        </p>
      </div>
    </div>
  );
}

// ==============================================
// ROAST SCREEN
// ==============================================
function RoastScreen({ result, onFindOut }) {
  const [emoji] = useState(getTierEmoji(result.tier));

  const tierColor = {
    'UNICORN': 'var(--color-elite)',
    'KEEP AN EYE': 'var(--color-trusted)',
    'POTENTIAL': 'var(--color-potential)',
    'MEH+': 'var(--color-neutral)',
    'MEH': 'var(--color-meh)',
    'RISKY': 'var(--color-risky)',
    'DANGER': 'var(--color-danger)'
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-[5%]">
      <div className="w-full max-w-lg animate-bounce-in">
        <div className="card-funky p-[8%] text-center">
          <img
            src={emoji}
            alt="result"
            className="w-24 h-24 mx-auto mb-[6%] animate-float"
          />

          {result.tokenName && (
            <div className="mb-[4%]">
              <span className="text-[var(--color-text-secondary)] text-sm">
                {result.tokenName}
                {result.tokenSymbol && ` $${result.tokenSymbol}`}
              </span>
            </div>
          )}

          {/* Roast - no quotes */}
          <div className="mb-[8%]">
            <p
              className="text-xl font-bold leading-relaxed"
              style={{ color: tierColor[result.tier] }}
            >
              {result.roast}
            </p>
            <p className="text-[var(--color-text-tertiary)] text-xs mt-[4%] uppercase tracking-wider">
              — grok
            </p>
          </div>

          <button onClick={onFindOut} className="btn-funky w-full">
            <span>find out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ==============================================
// RESULTS SCREEN
// ==============================================
function ResultsScreen({ result, leaderboard, onBack, onTokenClick }) {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b-2 border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
        <div className="px-[3vw] py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors text-sm font-bold uppercase"
          >
            <span>←</span>
            <span>new check</span>
          </button>

          <div className="flex items-center gap-3">
            <img src={getRandomEmoji('check')} alt="" className="w-6 h-6" />
            <span className="font-bold text-[var(--color-text-primary)] uppercase tracking-wide">why trust dev</span>
          </div>

          <div className="w-24" />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-[3vw] py-[2vh] overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[2vw] h-full">
          <div className="animate-fade-slide-in h-full">
            <DeployerCard result={result} />
          </div>

          <div className="animate-fade-slide-in stagger-2 h-full">
            <RecentChecks
              leaderboard={leaderboard}
              onTokenClick={onTokenClick}
              currentToken={result.tokenAddress}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

// ==============================================
// DEPLOYER CARD
// ==============================================
function DeployerCard({ result }) {
  // Get 2 different emojis for top corners (ensure they're different)
  const [cornerEmojis] = useState(() => {
    const emoji1 = getTierEmoji(result.tier);
    let emoji2 = getTierEmoji(result.tier);
    // Keep picking until we get a different one
    while (emoji2 === emoji1) {
      emoji2 = getTierEmoji(result.tier);
    }
    return [emoji1, emoji2];
  });

  const tierColor = {
    'UNICORN': 'var(--color-elite)',
    'KEEP AN EYE': 'var(--color-trusted)',
    'POTENTIAL': 'var(--color-potential)',
    'MEH+': 'var(--color-neutral)',
    'MEH': 'var(--color-meh)',
    'RISKY': 'var(--color-risky)',
    'DANGER': 'var(--color-danger)'
  };

  const tierGlow = {
    'UNICORN': 'glow-elite',
    'KEEP AN EYE': 'glow-trusted',
    'POTENTIAL': 'glow-potential',
    'MEH+': 'glow-neutral',
    'MEH': 'glow-meh',
    'RISKY': 'glow-risky',
    'DANGER': 'glow-danger'
  };

  // Dev trust label based on tier
  const getTierLabel = (tier) => {
    if (tier === 'UNICORN') return 'unicorn dev';
    if (tier === 'KEEP AN EYE') return 'keep an eye';
    if (tier === 'POTENTIAL') return 'has potential';
    if (tier === 'MEH+' || tier === 'MEH') return 'meh';
    return 'dev not trusted';
  };

  const formatMarketCap = (value) => {
    if (value == null) return '-';
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const truncateAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div
      className="card-funky overflow-hidden h-full flex flex-col relative"
    >
      {/* Score header with corner emojis */}
      <div
        className="px-[6%] text-center border-b-2 border-[var(--color-border)] relative"
        style={{ paddingTop: '8vh', paddingBottom: '5vh' }}
      >
        {/* Top-left emoji */}
        <img
          src={cornerEmojis[0]}
          alt=""
          className="absolute animate-dvd-bounce"
          style={{ top: '3vh', left: '3%', width: '8vw', height: '8vw', minWidth: '60px', minHeight: '60px', maxWidth: '100px', maxHeight: '100px' }}
        />
        {/* Top-right emoji */}
        <img
          src={cornerEmojis[1]}
          alt=""
          className="absolute animate-dvd-bounce"
          style={{ top: '3vh', right: '3%', width: '8vw', height: '8vw', minWidth: '60px', minHeight: '60px', maxWidth: '100px', maxHeight: '100px', animationDelay: '2s' }}
        />

        {result.tokenName && (
          <div className="text-[var(--color-text-secondary)] text-sm" style={{ marginBottom: '3vh', marginTop: '2vh' }}>
            {result.tokenName}
            {result.tokenSymbol && <span className="opacity-60"> ${result.tokenSymbol}</span>}
          </div>
        )}

        <div className="animate-score-reveal" style={{ marginTop: '4vh', marginBottom: '4vh' }}>
          <span
            className={`text-8xl font-black ${tierGlow[result.tier]}`}
            style={{ color: tierColor[result.tier] }}
          >
            {result.fairScore}
          </span>
          <span className="text-xl text-[var(--color-text-tertiary)] font-bold">/1000</span>
        </div>

        <div
          className="text-lg font-black uppercase tracking-widest"
          style={{ color: tierColor[result.tier], marginTop: '3vh' }}
        >
          {getTierLabel(result.tier)}
        </div>

        {/* Grok quote - moved here beneath the score */}
        <div className="px-[10%]" style={{ marginTop: '4vh', marginBottom: '4vh' }}>
          <p
            className="text-xl italic leading-relaxed"
            style={{ color: tierColor[result.tier] }}
          >
            {result.roast}
          </p>
        </div>

        {/* Bottom-right: powered by FairScale */}
        <a
          href="https://app.fairscale.xyz"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute text-[var(--color-text-tertiary)] text-[11px] hover:text-[var(--color-accent)] transition-colors"
          style={{ bottom: '2vh', right: '3%' }}
        >
          powered by FairScale
        </a>
      </div>

      {/* Risks - moved above deployer info */}
      {result.risks && result.risks.length > 0 && (
        <div className="px-[3%] py-[2.5%] border-b-2 border-[var(--color-border)] bg-[var(--color-danger)]/5">
          <div className="text-[var(--color-danger)] text-xs uppercase tracking-widest mb-3 font-black">
            ⚠ risks detected
          </div>
          <ul className="space-y-2">
            {result.risks.slice(0, 3).map((risk, i) => (
              <li key={i} className="text-[var(--color-text-secondary)] text-sm flex items-start gap-2">
                <span className="text-[var(--color-danger)]">!</span>
                <span>{risk.name || risk.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Deployer + Funder + Age */}
      <div className="px-[3%] py-[2.5%] border-b-2 border-[var(--color-border)] grid grid-cols-3 gap-[2%]">
        <div>
          <div className="text-[var(--color-accent)] text-xs uppercase tracking-widest mb-2 font-bold">
            deployer
          </div>
          <a
            href={`https://solscan.io/account/${result.deployerWallet}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-text-primary)] hover:text-[var(--color-accent)] text-sm transition-colors"
          >
            {truncateAddress(result.deployerWallet)} ↗
          </a>
        </div>
        <div>
          <div className="text-[var(--color-accent)] text-xs uppercase tracking-widest mb-2 font-bold">
            funded by
          </div>
          {result.fundedBy ? (
            <a
              href={`https://solscan.io/account/${result.fundedBy}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-text-primary)] hover:text-[var(--color-accent)] text-sm transition-colors"
            >
              {truncateAddress(result.fundedBy)} ↗
            </a>
          ) : (
            <span className="text-[var(--color-text-tertiary)] text-sm">-</span>
          )}
        </div>
        <div>
          <div className="text-[var(--color-accent)] text-xs uppercase tracking-widest mb-2 font-bold">
            age
          </div>
          <div className="text-[var(--color-text-primary)] text-sm">
            {result.deployerAge != null ? `${result.deployerAge} days` : '-'}
          </div>
        </div>
      </div>

      {/* Deployer Wallet Info */}
      <div className="px-[3%] py-[2.5%] border-b-2 border-[var(--color-border)]">
        <div className="text-[var(--color-accent)] text-xs uppercase tracking-widest mb-[3%] font-bold">
          deployer wallet
        </div>
        <div className="grid grid-cols-3 gap-[2%]">
          <MetricItem label="net worth" value={formatMarketCap(result.deployerNetWorth)} />
          <MetricItem label="sol balance" value={result.deployerSolBalance != null ? `${result.deployerSolBalance.toFixed(2)} SOL` : '-'} />
          <MetricItem label="tokens launched" value={result.tokensLaunched || '-'} />
        </div>
      </div>

      {/* Creator tokens */}
      {result.creatorTokens && result.creatorTokens.length > 0 && (
        <CreatorTokensList tokens={result.creatorTokens} />
      )}
    </div>
  );
}

function MetricItem({ label, value }) {
  return (
    <div className="bg-[var(--color-bg-tertiary)] p-[8%] border border-[var(--color-border)]">
      <div className="text-[var(--color-text-tertiary)] text-xs mb-1 uppercase">{label}</div>
      <div className="text-[var(--color-text-primary)] text-sm font-bold">{value}</div>
    </div>
  );
}

function CreatorTokensList({ tokens }) {
  const sortedTokens = [...tokens].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const formatMarketCap = (value) => {
    if (value == null) return '-';
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const truncateAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 4)}...${addr.slice(-3)}`;
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="px-[3%] py-[2%] border-b-2 border-[var(--color-border)]">
        <span className="text-[var(--color-accent)] text-xs uppercase tracking-widest font-bold">
          other tokens by this dev ({tokens.length})
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        {sortedTokens.slice(0, 10).map((token) => (
          <a
            key={token.mint}
            href={`https://solscan.io/token/${token.mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-[3%] py-3 hover:bg-[var(--color-bg-tertiary)] transition-colors border-b border-[var(--color-border-light)]"
          >
            <span className="text-[var(--color-text-primary)] text-sm">
              {truncateAddress(token.mint)}
            </span>
            <span className="text-[var(--color-text-secondary)] text-xs">
              {formatMarketCap(token.marketCap)}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ==============================================
// RECENT CHECKS
// ==============================================
function RecentChecks({ leaderboard, onTokenClick, currentToken }) {
  const [copiedAddress, setCopiedAddress] = useState(null);

  const tierColor = {
    'UNICORN': 'var(--color-elite)',
    'KEEP AN EYE': 'var(--color-trusted)',
    'POTENTIAL': 'var(--color-potential)',
    'MEH+': 'var(--color-neutral)',
    'MEH': 'var(--color-meh)',
    'RISKY': 'var(--color-risky)',
    'DANGER': 'var(--color-danger)'
  };

  const truncateAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const copyToClipboard = (e, address) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 1500);
  };

  const sortedData = [...leaderboard].sort((a, b) => b.checkedAt - a.checkedAt);

  return (
    <div className="card-funky h-full flex flex-col">
      <div className="px-[3%] py-[2.5%] border-b-2 border-[var(--color-border)]">
        <h2 className="font-bold text-[var(--color-text-primary)] uppercase tracking-wide">
          recent checks
        </h2>
      </div>

      <div className="flex-1 overflow-auto">
        {leaderboard.length === 0 ? (
          <div className="p-[5%] text-center text-[var(--color-text-tertiary)]">
            <img src={getRandomEmoji('mid')} alt="" className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm uppercase">no tokens checked yet</p>
          </div>
        ) : (
          <div>
            {sortedData.map((entry) => (
              <div
                key={entry.tokenAddress}
                onClick={() => onTokenClick(entry)}
                className={`px-[3%] py-[3%] border-b-2 border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] cursor-pointer transition-colors ${
                  entry.tokenAddress === currentToken ? 'bg-[var(--color-bg-tertiary)]' : ''
                }`}
              >
                {/* Row 1: Score + Token Name + Tier Badge */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-4">
                    <span
                      className="font-black text-xl"
                      style={{ color: tierColor[entry.tier] }}
                    >
                      {entry.fairScore}
                    </span>
                    <span className="text-[var(--color-text-primary)] font-medium">
                      {entry.tokenName || truncateAddress(entry.tokenAddress)}
                    </span>
                  </div>
                  <span
                    className="text-xs font-black px-2 py-1 uppercase"
                    style={{
                      color: tierColor[entry.tier],
                      background: `${tierColor[entry.tier]}20`
                    }}
                  >
                    {entry.tier}
                  </span>
                </div>

                {/* Row 2: Contract (copyable) + Twitter (clickable) */}
                <div className="flex items-center gap-4 text-xs">
                  {/* Contract Address - copyable */}
                  <button
                    onClick={(e) => copyToClipboard(e, entry.tokenAddress)}
                    className="text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] transition-colors flex items-center gap-1"
                    title="Click to copy"
                  >
                    <span>{truncateAddress(entry.tokenAddress)}</span>
                    <span className="text-[10px]">
                      {copiedAddress === entry.tokenAddress ? '✓' : '⧉'}
                    </span>
                  </button>

                  {/* Twitter Handle - clickable link */}
                  {entry.twitterHandle && (
                    <a
                      href={`https://twitter.com/${entry.twitterHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors font-bold"
                    >
                      @{entry.twitterHandle}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
