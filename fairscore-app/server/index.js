import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Data file path
const DATA_FILE = path.join(__dirname, 'recent-checks.json');
const MAX_ENTRIES = 100;

// Middleware
app.use(cors());
app.use(express.json());

// Load data from file
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading data:', error);
  }
  return [];
}

// Save data to file
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving data:', error);
  }
}

// GET /api/recent-checks - Get all recent checks
app.get('/api/recent-checks', (req, res) => {
  const data = loadData();
  res.json(data);
});

// POST /api/recent-checks - Add a new check
app.post('/api/recent-checks', (req, res) => {
  const entry = req.body;

  if (!entry || !entry.tokenAddress) {
    return res.status(400).json({ error: 'Invalid entry' });
  }

  const data = loadData();

  // Remove existing entry for same token (update it)
  const filtered = data.filter(e => e.tokenAddress !== entry.tokenAddress);

  // Add new entry at the beginning with server timestamp
  const newEntry = {
    ...entry,
    id: entry.tokenAddress,
    serverCheckedAt: Date.now()
  };

  const updated = [newEntry, ...filtered].slice(0, MAX_ENTRIES);
  saveData(updated);

  res.json(newEntry);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
