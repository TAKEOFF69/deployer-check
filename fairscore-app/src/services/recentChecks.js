// API URL - use proxy in dev, configure VITE_API_URL for production
const API_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');

/**
 * Fetch all recent checks from the server
 * @returns {Promise<Array>} Array of recent check entries
 */
export async function fetchRecentChecks() {
  try {
    const response = await fetch(`${API_URL}/api/recent-checks`);
    if (!response.ok) {
      throw new Error('Failed to fetch recent checks');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching recent checks:', error);
    return [];
  }
}

/**
 * Save a check to the server
 * @param {Object} entry - The check entry to save
 * @returns {Promise<Object|null>} The saved entry or null on error
 */
export async function saveRecentCheck(entry) {
  try {
    const response = await fetch(`${API_URL}/api/recent-checks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(entry)
    });

    if (!response.ok) {
      throw new Error('Failed to save check');
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving recent check:', error);
    return null;
  }
}
