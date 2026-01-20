import { formatMarketCap, truncateAddress } from '../utils/storage';

export default function CreatorTokens({ tokens }) {
  if (!tokens || tokens.length === 0) {
    return null;
  }

  // Sort by creation date (newest first)
  const sortedTokens = [...tokens].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      <div className="p-4 border-b border-[var(--color-border)]">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Tokens by This Deployer ({tokens.length})
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          All tokens created by this wallet
        </p>
      </div>

      <div className="max-h-80 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-[var(--color-bg-secondary)]">
            <tr className="text-left text-xs text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
              <th className="p-3 font-medium">Token</th>
              <th className="p-3 font-medium text-right">Market Cap</th>
              <th className="p-3 font-medium text-right">Created</th>
            </tr>
          </thead>
          <tbody>
            {sortedTokens.map((token, index) => (
              <TokenRow key={token.mint} token={token} rank={index + 1} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TokenRow({ token, rank }) {
  const createdDate = new Date(token.createdAt);
  const timeAgo = getTimeAgo(createdDate);

  return (
    <tr className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] transition-colors">
      <td className="p-3">
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-text-secondary)] text-xs w-5">
            {rank}
          </span>
          <div>
            <a
              href={`https://solscan.io/token/${token.mint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-[var(--color-accent-blue)] hover:underline"
            >
              {truncateAddress(token.mint)}
            </a>
          </div>
        </div>
      </td>
      <td className="p-3 text-right">
        <span className="font-mono text-sm text-[var(--color-text-primary)]">
          {formatMarketCap(token.marketCap)}
        </span>
      </td>
      <td className="p-3 text-right">
        <span className="text-xs text-[var(--color-text-secondary)]" title={createdDate.toLocaleString()}>
          {timeAgo}
        </span>
      </td>
    </tr>
  );
}

function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 30) {
    return `${diffDays}d ago`;
  }
  return date.toLocaleDateString();
}
