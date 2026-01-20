const STORAGE_KEY = 'fairscore_leaderboard';
const MAX_ENTRIES = 50;

export function loadLeaderboard() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading leaderboard:', error);
    return [];
  }
}

export function saveToLeaderboard(entry) {
  try {
    const current = loadLeaderboard();

    // Remove existing entry for same token
    const filtered = current.filter(e => e.tokenAddress !== entry.tokenAddress);

    // Add new entry at top
    const updated = [entry, ...filtered].slice(0, MAX_ENTRIES);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Error saving to leaderboard:', error);
    return loadLeaderboard();
  }
}

export function clearLeaderboard() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  } catch (error) {
    console.error('Error clearing leaderboard:', error);
    return [];
  }
}

// Format large numbers for display
export function formatMarketCap(value) {
  if (value == null) return '-';

  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

// Truncate wallet address for display
export function truncateAddress(address) {
  if (!address) return '';
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Validate Solana wallet address (base58, 32-44 chars)
export function isValidSolanaAddress(address) {
  if (!address || typeof address !== 'string') return false;

  // Length check: 32-44 characters
  if (address.length < 32 || address.length > 44) return false;

  // Base58 character check (no 0, O, I, l)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  return base58Regex.test(address);
}

// Clean Twitter handle (remove @ if present, extract from profile URL)
export function cleanTwitterHandle(handle) {
  if (!handle) return null;
  let cleaned = handle.trim();

  // Extract username from Twitter/X profile URLs
  // Handles: https://twitter.com/username, https://x.com/username, twitter.com/username, etc.
  const urlMatch = cleaned.match(/(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/(@?[\w]+)/i);
  if (urlMatch) {
    cleaned = urlMatch[1];
  }

  // Remove @ prefix if present
  cleaned = cleaned.replace(/^@/, '');

  // Validate: alphanumeric and underscore only, 1-15 chars (Twitter limit)
  if (!/^[a-zA-Z0-9_]{1,15}$/.test(cleaned)) return null;
  return cleaned || null;
}
