import { kv } from '@vercel/kv';

const MAX_ENTRIES = 100;
const KV_KEY = 'recent_checks';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // Fetch all recent checks
      const data = await kv.get(KV_KEY) || [];
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const entry = req.body;

      if (!entry || !entry.tokenAddress) {
        return res.status(400).json({ error: 'Invalid entry' });
      }

      // Get existing data
      const data = await kv.get(KV_KEY) || [];

      // Remove existing entry for same token
      const filtered = data.filter(e => e.tokenAddress !== entry.tokenAddress);

      // Add new entry at the beginning
      const newEntry = {
        ...entry,
        id: entry.tokenAddress,
        serverCheckedAt: Date.now()
      };

      const updated = [newEntry, ...filtered].slice(0, MAX_ENTRIES);

      // Save back to KV
      await kv.set(KV_KEY, updated);

      return res.status(200).json(newEntry);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
