# FairScore Checker - Claude Code Build Spec

## Overview
A single-page web app that checks the "FairScore" of a Solana wallet address, displays trust metrics, and maintains a leaderboard of checked wallets.

## Tech Stack
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS
- **State**: React useState/useEffect (no external state library needed)
- **Storage**: localStorage for leaderboard persistence
- **Deployment**: Vercel-ready (just `npm run build`)

## Project Setup Commands
```bash
npm create vite@latest fairscore-checker -- --template react
cd fairscore-checker
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

## File Structure
```
fairscore-checker/
├── src/
│   ├── App.jsx              # Main app component
│   ├── components/
│   │   ├── InputSection.jsx # Wallet input form
│   │   ├── ResultCard.jsx   # Score display card
│   │   ├── Leaderboard.jsx  # Right column table
│   │   └── ScoreBadge.jsx   # Visual score indicator
│   ├── services/
│   │   ├── fairscale.js     # FairScale API calls
│   │   ├── solscan.js       # Solscan API calls
│   │   ├── rugcheck.js      # Rugcheck API calls
│   │   └── grok.js          # Grok API for roasts
│   ├── utils/
│   │   └── storage.js       # localStorage helpers
│   ├── index.css            # Tailwind imports
│   └── main.jsx             # Entry point
├── .env.example             # API key template
├── tailwind.config.js
└── package.json
```

---

## Design Specifications

### Color Palette (Dark Theme - Crypto Native)
```css
:root {
  --bg-primary: #0a0a0f;      /* Near black */
  --bg-secondary: #12121a;    /* Card backgrounds */
  --bg-tertiary: #1a1a24;     /* Input backgrounds */
  --accent-green: #00ff88;    /* Good scores, CTAs */
  --accent-yellow: #ffd93d;   /* Medium scores */
  --accent-red: #ff4757;      /* Bad scores, warnings */
  --accent-blue: #4dabf7;     /* Links, info */
  --text-primary: #ffffff;
  --text-secondary: #8b8b9a;
  --border: #2a2a3a;
}
```

### Typography
- **Headings**: "Space Grotesk" or "Outfit" (Google Fonts)
- **Body**: "IBM Plex Mono" for addresses, numbers
- **Score display**: Large, bold, with subtle glow effect

### Score Tiers & Colors
| Tier | Score Range | Color | Glow |
|------|-------------|-------|------|
| ELITE | 900+ | #00ff88 (green) | green glow |
| TRUSTED | 700-899 | #4dabf7 (blue) | blue glow |
| NEUTRAL | 500-699 | #ffd93d (yellow) | yellow glow |
| RISKY | 300-499 | #ff8c42 (orange) | orange glow |
| DANGER | 0-299 | #ff4757 (red) | red glow |

---

## Component Specifications

### 1. App.jsx (Main Layout)
```jsx
// Two-column layout: 40% left (input/result), 60% right (leaderboard)
// Mobile: stack vertically
// State: currentResult, leaderboardData, isLoading
```

**Layout structure:**
- Full viewport height, dark background
- Header with "FairScore" logo/title
- Two-column grid below header
- Subtle gradient mesh background for depth

### 2. InputSection.jsx
**Elements:**
- Solana address input (required)
  - Placeholder: "Enter Solana wallet address..."
  - Validation: 32-44 characters, base58
- Twitter handle input (optional)
  - Placeholder: "@username (optional)"
  - Auto-strip @ if user includes it
- "Check Wallet" button
  - Gradient background (green)
  - Loading state with spinner
  - Disabled while loading

**Behavior:**
- On submit, trigger all API calls in parallel
- Show loading skeleton in ResultCard
- On error, show toast/inline error

### 3. ResultCard.jsx
**States:**
1. **Empty**: Show placeholder "Enter a wallet to check"
2. **Loading**: Skeleton with pulse animation
3. **Result**: Full display

**Result display elements:**
```
┌────────────────────────────────────┐
│  FAIR SCORE                        │
│  ┌──────────────────────────────┐  │
│  │         847                  │  │  ← Large number with glow
│  │      ━━━━━━━━━━              │  │  ← Progress bar
│  └──────────────────────────────┘  │
│                                    │
│  Tier: TRUSTED                     │  ← Badge with tier color
│                                    │
│  ┌──────────────────────────────┐  │
│  │ "This wallet is cleaner than │  │  ← Grok-generated roast
│  │  your browser history. Ship  │  │
│  │  with confidence."           │  │
│  └──────────────────────────────┘  │
│                                    │
│  ── Additional Metrics ──          │
│                                    │
│  🛡️ Rugcheck Score: 92/100        │
│  🪙 Tokens Launched: 3             │
│  📅 Wallet Age: 847 days           │
│  💰 Total Volume: $2.4M            │
│                                    │
│  [View on Solscan ↗]               │
└────────────────────────────────────┘
```

### 4. Leaderboard.jsx
**Table columns:**
| Column | Width | Content |
|--------|-------|---------|
| Token/Address | 30% | Token name if known, else truncated address |
| FairScore | 15% | Score with color badge |
| Dev Twitter | 15% | @handle or "-" |
| Top MCap | 15% | Highest market cap reached |
| Current MCap | 15% | Current market cap |
| Rugcheck | 10% | Score badge |

**Features:**
- Sorted by FairScore descending (highest first)
- Click row to re-check that wallet
- Persist to localStorage
- Max 50 entries, FIFO when exceeded
- "Clear History" button in header

**Row styling:**
- Alternating row backgrounds
- Hover highlight
- Score column color-coded by tier

---

## API Service Specifications

### services/fairscale.js
```javascript
const FAIRSCALE_API_URL = import.meta.env.VITE_FAIRSCALE_API_URL;

export async function getFairScore(walletAddress, twitterHandle = null) {
  const response = await fetch(`${FAIRSCALE_API_URL}/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet: walletAddress,
      twitter: twitterHandle
    })
  });
  
  if (!response.ok) throw new Error('FairScale API error');
  
  return response.json();
  // Expected: { score: number, tier: string }
}
```

### services/solscan.js
```javascript
const SOLSCAN_API_URL = 'https://pro-api.solscan.io/v2.0';
const SOLSCAN_API_KEY = import.meta.env.VITE_SOLSCAN_API_KEY;

export async function getAccountDetails(walletAddress) {
  const response = await fetch(
    `${SOLSCAN_API_URL}/account/detail?address=${walletAddress}`,
    {
      headers: { 'token': SOLSCAN_API_KEY }
    }
  );
  
  if (!response.ok) throw new Error('Solscan API error');
  
  return response.json();
}

export async function getTokensCreated(walletAddress) {
  // Check if wallet has deployed any tokens
  const response = await fetch(
    `${SOLSCAN_API_URL}/account/token-accounts?address=${walletAddress}`,
    {
      headers: { 'token': SOLSCAN_API_KEY }
    }
  );
  
  return response.json();
}
```

### services/rugcheck.js
```javascript
const RUGCHECK_API_URL = 'https://api.rugcheck.xyz/v1';

export async function getTokenReport(tokenMint) {
  const response = await fetch(
    `${RUGCHECK_API_URL}/tokens/${tokenMint}/report`
  );
  
  if (!response.ok) throw new Error('Rugcheck API error');
  
  return response.json();
  // Returns: { score: number, risks: array, ... }
}

export async function getWalletTokens(walletAddress) {
  // Get all tokens associated with wallet and their rugcheck scores
  const response = await fetch(
    `${RUGCHECK_API_URL}/wallets/${walletAddress}/tokens`
  );
  
  return response.json();
}
```

### services/grok.js
```javascript
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const GROK_API_KEY = import.meta.env.VITE_GROK_API_KEY;

export async function generateRoast(score, tier, tokenHistory) {
  const prompt = buildRoastPrompt(score, tier, tokenHistory);
  
  const response = await fetch(GROK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'grok-2-latest',
      messages: [
        {
          role: 'system',
          content: `You are a witty crypto degen roast master. Generate a single short sentence (max 15 words) about a wallet based on their FairScore. Be funny, use crypto slang, and match the tone to the score:
          - High scores (700+): Complimentary but still edgy
          - Medium scores (400-699): Skeptical, backhanded compliments
          - Low scores (0-399): Full roast mode, warn people`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 50,
      temperature: 0.9
    })
  });
  
  const data = await response.json();
  return data.choices[0].message.content;
}

function buildRoastPrompt(score, tier, tokenHistory) {
  const launchedTokens = tokenHistory?.length || 0;
  return `FairScore: ${score}/1000, Tier: ${tier}, Tokens launched: ${launchedTokens}. Generate a one-liner roast/praise.`;
}
```

---

## State Management

### Main App State
```javascript
const [walletInput, setWalletInput] = useState('');
const [twitterInput, setTwitterInput] = useState('');
const [isLoading, setIsLoading] = useState(false);
const [currentResult, setCurrentResult] = useState(null);
const [leaderboard, setLeaderboard] = useState([]);
const [error, setError] = useState(null);
```

### Result Object Shape
```javascript
{
  walletAddress: string,
  twitterHandle: string | null,
  fairScore: number,
  tier: string,
  roast: string,
  rugcheckScore: number | null,
  tokensLaunched: number,
  walletAge: number, // days
  topMarketCap: number | null,
  currentMarketCap: number | null,
  tokenName: string | null,
  checkedAt: timestamp
}
```

### Leaderboard Entry Shape
```javascript
{
  id: string, // walletAddress
  walletAddress: string,
  tokenName: string | null,
  fairScore: number,
  twitterHandle: string | null,
  topMarketCap: number | null,
  currentMarketCap: number | null,
  rugcheckScore: number | null,
  checkedAt: timestamp
}
```

---

## localStorage Helpers (utils/storage.js)
```javascript
const STORAGE_KEY = 'fairscore_leaderboard';
const MAX_ENTRIES = 50;

export function loadLeaderboard() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveToLeaderboard(entry) {
  const current = loadLeaderboard();
  
  // Remove existing entry for same wallet
  const filtered = current.filter(e => e.walletAddress !== entry.walletAddress);
  
  // Add new entry at top
  const updated = [entry, ...filtered].slice(0, MAX_ENTRIES);
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function clearLeaderboard() {
  localStorage.removeItem(STORAGE_KEY);
  return [];
}
```

---

## Environment Variables (.env.example)
```
VITE_FAIRSCALE_API_URL=https://api.fairscale.xyz
VITE_SOLSCAN_API_KEY=your_solscan_api_key
VITE_GROK_API_KEY=your_grok_api_key
```

---

## Error Handling

### API Error States
- **FairScale down**: Show "Unable to fetch FairScore" with retry button
- **Solscan rate limited**: Show partial results, note "Some data unavailable"
- **Rugcheck timeout**: Show "-" for rugcheck score
- **Grok error**: Use fallback roasts based on tier:
  ```javascript
  const fallbackRoasts = {
    ELITE: "This wallet touches grass AND money.",
    TRUSTED: "Probably won't rug you. Probably.",
    NEUTRAL: "Mid wallet energy detected.",
    RISKY: "Your funds are playing Russian roulette.",
    DANGER: "Sir, this is a crime scene."
  };
  ```

### Input Validation
- Wallet: Check base58 characters, 32-44 length
- Twitter: Strip @, validate alphanumeric + underscore

---

## Animations & Polish

### Score Reveal Animation
```css
@keyframes scoreReveal {
  0% { opacity: 0; transform: scale(0.5); }
  50% { transform: scale(1.1); }
  100% { opacity: 1; transform: scale(1); }
}

.score-number {
  animation: scoreReveal 0.6s ease-out;
}
```

### Score Glow Effect
```css
.score-glow-green {
  text-shadow: 0 0 20px rgba(0, 255, 136, 0.5),
               0 0 40px rgba(0, 255, 136, 0.3);
}
```

### Loading Skeleton
- Pulse animation on placeholder cards
- Shimmer effect on table rows

---

## Mobile Responsiveness

### Breakpoints
- **Desktop** (1024px+): Two columns, 40/60 split
- **Tablet** (768px-1023px): Two columns, 50/50 split
- **Mobile** (<768px): Single column, stacked

### Mobile Adjustments
- Leaderboard: horizontal scroll or card view
- Result card: full width
- Input section: sticky at top

---

## Build & Deploy

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Deploy to Vercel
```bash
npm i -g vercel
vercel
```

---

## Testing Checklist
- [ ] Valid Solana address returns score
- [ ] Invalid address shows error
- [ ] Empty Twitter field works
- [ ] Leaderboard persists on refresh
- [ ] Leaderboard sorts correctly
- [ ] Mobile layout works
- [ ] Loading states display
- [ ] Error states display
- [ ] Score colors match tiers
- [ ] Grok roast generates
- [ ] Fallback roast works when Grok fails

---

## Future Enhancements (v2)
- Token search (input token address, find deployer)
- Share score card as image (html2canvas)
- Wallet comparison mode
- Historical score tracking
- Discord bot integration
- Webhook alerts for new checks
