import { getTierColor } from '../services/fairscale';
import { truncateAddress, formatMarketCap } from '../utils/storage';

export default function Leaderboard({ data, onTokenClick, onClear }) {
  // Sort by FairScore descending
  const sortedData = [...data].sort((a, b) => b.fairScore - a.fairScore);

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
          Checked Tokens
        </h2>
        {data.length > 0 && (
          <button
            onClick={onClear}
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent-red)] transition-colors"
          >
            Clear History
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {data.length === 0 ? (
          <div className="p-8 text-center text-[var(--color-text-secondary)]">
            <div className="text-lg mb-2">No tokens checked yet</div>
            <div className="text-sm opacity-60">
              Check a token CA to see it appear here
            </div>
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-[var(--color-bg-secondary)]">
              <tr className="text-left text-sm text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                <th className="p-3 font-medium">Token</th>
                <th className="p-3 font-medium">FairScore</th>
                <th className="p-3 font-medium hidden md:table-cell">Dev Twitter</th>
                <th className="p-3 font-medium hidden lg:table-cell">Market Cap</th>
                <th className="p-3 font-medium hidden sm:table-cell">Top 10 Held</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((entry, index) => (
                <LeaderboardRow
                  key={entry.tokenAddress || entry.id}
                  entry={entry}
                  rank={index + 1}
                  onClick={() => onTokenClick(entry.tokenAddress, entry.twitterHandle)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function LeaderboardRow({ entry, rank, onClick }) {
  const tierColor = getTierColor(entry.tier || 'MEH');

  return (
    <tr
      onClick={onClick}
      className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] cursor-pointer transition-colors"
    >
      <td className="p-3">
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-text-secondary)] text-sm w-6">
            #{rank}
          </span>
          <div>
            <div className="font-medium text-[var(--color-text-primary)]">
              {entry.tokenName || truncateAddress(entry.tokenAddress)}
            </div>
            {entry.tokenName && (
              <div className="text-xs font-mono text-[var(--color-text-secondary)]">
                {truncateAddress(entry.tokenAddress)}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="p-3">
        <span
          className="font-mono font-semibold"
          style={{ color: tierColor }}
        >
          {entry.fairScore}
        </span>
      </td>
      <td className="p-3 hidden md:table-cell">
        {entry.twitterHandle ? (
          <a
            href={`https://twitter.com/${entry.twitterHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[var(--color-accent-blue)] hover:underline"
          >
            @{entry.twitterHandle}
          </a>
        ) : (
          <span className="text-[var(--color-text-secondary)]">-</span>
        )}
      </td>
      <td className="p-3 hidden lg:table-cell font-mono text-sm text-[var(--color-text-secondary)]">
        {formatMarketCap(entry.currentMarketCap)}
      </td>
      <td className="p-3 hidden sm:table-cell font-mono text-sm text-[var(--color-text-secondary)]">
        {entry.top10HeldPct != null ? `${entry.top10HeldPct.toFixed(1)}%` : '-'}
      </td>
    </tr>
  );
}
