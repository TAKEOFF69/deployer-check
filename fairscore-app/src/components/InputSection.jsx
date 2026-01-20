import { useState } from 'react';
import { isValidSolanaAddress, cleanTwitterHandle } from '../utils/storage';

export default function InputSection({ onSubmit, isLoading }) {
  const [tokenInput, setTokenInput] = useState('');
  const [twitterInput, setTwitterInput] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    const token = tokenInput.trim();
    const twitter = cleanTwitterHandle(twitterInput);

    if (!token) {
      setError('Please enter a token contract address');
      return;
    }

    if (!isValidSolanaAddress(token)) {
      setError('Invalid Solana token address');
      return;
    }

    onSubmit(token, twitter);
  };

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-2xl p-6 border border-[var(--color-border)]">
      <h2 className="text-xl font-semibold mb-4 text-[var(--color-text-primary)]">
        Check Token Deployer
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-2">
            Token Contract Address (CA) *
          </label>
          <input
            type="text"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Enter token CA (e.g. ...pump)"
            className="w-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-[var(--color-text-primary)] font-mono text-sm placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-accent-green)] transition-colors"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-2">
            Dev Twitter Handle (optional)
          </label>
          <input
            type="text"
            value={twitterInput}
            onChange={(e) => setTwitterInput(e.target.value)}
            placeholder="@username or twitter.com/username (optional)"
            className="w-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-accent-blue)] transition-colors"
            disabled={isLoading}
          />
        </div>

        {error && (
          <div className="text-[var(--color-accent-red)] text-sm bg-[var(--color-accent-red)]/10 px-4 py-2 rounded-lg">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-6 rounded-lg font-semibold text-[var(--color-bg-primary)] bg-gradient-to-r from-[var(--color-accent-green)] to-[#00cc6a] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Checking...
            </>
          ) : (
            'Check Deployer'
          )}
        </button>
      </form>
    </div>
  );
}
