// Serverless proxy for FairScale API - keeps API key hidden from browser
const FAIRSCALE_API_URL = 'https://api.fairscale.xyz';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get API key from server-side environment variable (NOT exposed to browser)
  const apiKey = process.env.FAIRSCALE_API_KEY;

  if (!apiKey) {
    console.error('FAIRSCALE_API_KEY not configured in Vercel environment');
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { wallet, twitter } = req.query;

    if (!wallet) {
      return res.status(400).json({ error: 'wallet parameter required' });
    }

    // Build query params
    const params = new URLSearchParams();
    params.append('wallet', wallet);
    if (twitter) {
      params.append('twitter', twitter);
    }

    const url = `${FAIRSCALE_API_URL}/score?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'fairkey': apiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('FairScale API error:', response.status, errorText);
      return res.status(response.status).json({ error: 'FairScale API error' });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
