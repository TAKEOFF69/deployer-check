import ScoreBadge, { ScoreNumber } from './ScoreBadge';
import { truncateAddress, formatMarketCap } from '../utils/storage';

export default function ResultCard({ result, isLoading, error }) {
  // Empty state
  if (!result && !isLoading && !error) {
    return (
      <div className="bg-[var(--color-bg-secondary)] rounded-2xl p-8 border border-[var(--color-border)] text-center">
        <div className="text-[var(--color-text-secondary)] text-lg">
          Enter a token CA to check its deployer
        </div>
        <div className="mt-2 text-sm text-[var(--color-text-secondary)]/60">
          Get the FairScore and trust metrics for any Solana token deployer
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-[var(--color-bg-secondary)] rounded-2xl p-8 border border-[var(--color-border)]">
        <div className="animate-pulse space-y-6">
          <div className="text-center">
            <div className="h-4 w-24 bg-[var(--color-bg-tertiary)] rounded mx-auto mb-4" />
            <div className="h-20 w-32 bg-[var(--color-bg-tertiary)] rounded mx-auto" />
            <div className="h-2 w-full bg-[var(--color-bg-tertiary)] rounded mt-4" />
          </div>
          <div className="h-6 w-20 bg-[var(--color-bg-tertiary)] rounded mx-auto" />
          <div className="h-20 bg-[var(--color-bg-tertiary)] rounded" />
          <div className="space-y-3">
            <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-3/4" />
            <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-2/3" />
            <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-[var(--color-bg-secondary)] rounded-2xl p-8 border border-[var(--color-accent-red)]/30">
        <div className="text-center">
          <div className="text-[var(--color-accent-red)] text-lg font-semibold mb-2">
            Error
          </div>
          <div className="text-[var(--color-text-secondary)]">
            {error}
          </div>
        </div>
      </div>
    );
  }

  // Result state
  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-2xl p-8 border border-[var(--color-border)]">
      {/* Token info header */}
      {result.tokenName && (
        <div className="text-center mb-4 pb-4 border-b border-[var(--color-border)]">
          <div className="text-lg font-semibold text-[var(--color-text-primary)]">
            {result.tokenName} {result.tokenSymbol && <span className="text-[var(--color-text-secondary)]">({result.tokenSymbol})</span>}
          </div>
          <div className="text-xs font-mono text-[var(--color-text-secondary)] mt-1">
            {truncateAddress(result.tokenAddress)}
          </div>
        </div>
      )}

      <div className="text-center mb-6">
        <div className="text-sm text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
          Deployer Fair Score
        </div>
        <ScoreNumber score={result.fairScore} tier={result.tier} />
      </div>

      <div className="flex justify-center mb-6">
        <ScoreBadge tier={result.tier} size="large" />
      </div>

      {/* Deployer wallet info */}
      {result.deployerWallet && (
        <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-3 mb-6">
          <div className="text-xs text-[var(--color-text-secondary)] mb-1">Deployer Wallet</div>
          <div className="font-mono text-sm text-[var(--color-accent-blue)]">
            <a
              href={`https://solscan.io/account/${result.deployerWallet}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {truncateAddress(result.deployerWallet)}
            </a>
          </div>
        </div>
      )}

      {/* Risk warnings */}
      {result.risks && result.risks.length > 0 && (
        <div className="bg-[var(--color-accent-red)]/10 rounded-xl p-4 mb-6 border border-[var(--color-accent-red)]/30">
          <div className="text-sm font-semibold text-[var(--color-accent-red)] mb-2">
            Risks Detected
          </div>
          <ul className="text-sm text-[var(--color-text-secondary)] space-y-1">
            {result.risks.slice(0, 3).map((risk, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-[var(--color-accent-red)]">!</span>
                <span>{risk.name || risk.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Roast quote */}
      <div className="bg-[var(--color-bg-tertiary)] rounded-xl p-4 mb-6 border-l-4 border-[var(--color-accent-blue)]">
        <p className="text-[var(--color-text-primary)] italic">
          "{result.roast}"
        </p>
      </div>

      {/* Deployer metrics */}
      <div className="border-t border-[var(--color-border)] pt-6">
        <div className="text-sm text-[var(--color-text-secondary)] uppercase tracking-wider mb-4">
          Deployer Metrics
        </div>

        <div className="space-y-3">
          <MetricRow
            icon="chart"
            label="Market Cap"
            value={formatMarketCap(result.currentMarketCap)}
          />
          <MetricRow
            icon="users"
            label="Holders"
            value={result.totalHolders != null ? result.totalHolders.toLocaleString() : '-'}
          />
          <MetricRow
            icon="pie"
            label="Top 10 Held"
            value={result.top10HeldPct != null ? `${result.top10HeldPct.toFixed(1)}%` : '-'}
          />
          <MetricRow
            icon="coin"
            label="Tokens Launched"
            value={result.tokensLaunched ?? '-'}
          />
          <MetricRow
            icon="calendar"
            label="Deployer Age"
            value={result.deployerAge != null ? `${result.deployerAge} days` : '-'}
          />
        </div>
      </div>

      {/* Funded By section */}
      {result.fundedBy && (
        <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
          <div className="text-sm text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
            Funded By
          </div>
          <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-3">
            <div className="flex items-center justify-between">
              <a
                href={`https://solscan.io/account/${result.fundedBy}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-[var(--color-accent-blue)] hover:underline"
              >
                {truncateAddress(result.fundedBy)}
              </a>
              {result.fundingTx && (
                <a
                  href={`https://solscan.io/tx/${result.fundingTx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent-blue)] flex items-center gap-1"
                >
                  View TX
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View on Solscan links */}
      <div className="mt-6 pt-4 border-t border-[var(--color-border)] flex flex-col gap-2">
        <a
          href={`https://solscan.io/token/${result.tokenAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 text-[var(--color-accent-blue)] hover:underline text-sm"
        >
          View Token on Solscan
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
        {result.deployerWallet && (
          <a
            href={`https://solscan.io/account/${result.deployerWallet}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-[var(--color-text-secondary)] hover:text-[var(--color-accent-blue)] hover:underline text-sm"
          >
            View Deployer on Solscan
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}

function MetricRow({ icon, label, value, valueColor }) {
  const icons = {
    coin: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    chart: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    ),
    users: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    ),
    pie: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
    ),
    calendar: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    )
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icons[icon]}
        </svg>
        <span>{label}</span>
      </div>
      <span
        className="font-mono text-[var(--color-text-primary)]"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
