import { Router } from 'express';
import { query, queryOne, pool } from '../db.js';

export const patternFavoritesRouter = Router();

interface PatternFavorite {
  id: number;
  ticker: string;
  entry_month: number;
  holding_period: number;
  calc_method: 'openClose' | 'maxMax';
  rating: number | null;
  created_at: Date;
}

// GET /api/pattern-favorites - List all pattern favorites
patternFavoritesRouter.get('/', async (_req, res) => {
  try {
    const favorites = await query<PatternFavorite>(
      `SELECT * FROM pattern_favorites ORDER BY ticker, entry_month`
    );
    res.json(favorites);
  } catch (error) {
    console.error('Error fetching pattern favorites:', error);
    res.status(500).json({ error: 'Failed to fetch pattern favorites' });
  }
});

// GET /api/pattern-favorites/keys - Get favorites as array of keys for quick lookup
// Returns: ["AAPL-3-6", "TSLA-5-12", ...] format for Set compatibility
patternFavoritesRouter.get('/keys', async (_req, res) => {
  try {
    const favorites = await query<PatternFavorite>(
      `SELECT ticker, entry_month, holding_period FROM pattern_favorites`
    );
    // Format as keys matching frontend format: TICKER-MONTH-PERIOD
    const keys = favorites.map(f => `${f.ticker}-${f.entry_month}-${f.holding_period}`);
    res.json(keys);
  } catch (error) {
    console.error('Error fetching pattern favorite keys:', error);
    res.status(500).json({ error: 'Failed to fetch pattern favorite keys' });
  }
});

// GET /api/pattern-favorites/ratings - Get ratings as a map for quick lookup
// Returns: { "AAPL-3-6": 5, "TSLA-5-12": 3, ... } format
patternFavoritesRouter.get('/ratings', async (_req, res) => {
  try {
    const favorites = await query<PatternFavorite>(
      `SELECT ticker, entry_month, holding_period, rating FROM pattern_favorites WHERE rating IS NOT NULL`
    );
    const ratingsMap: Record<string, number> = {};
    favorites.forEach(f => {
      if (f.rating !== null) {
        ratingsMap[`${f.ticker}-${f.entry_month}-${f.holding_period}`] = f.rating;
      }
    });
    res.json(ratingsMap);
  } catch (error) {
    console.error('Error fetching pattern favorite ratings:', error);
    res.status(500).json({ error: 'Failed to fetch pattern favorite ratings' });
  }
});

// POST /api/pattern-favorites - Add a pattern favorite
patternFavoritesRouter.post('/', async (req, res) => {
  const { ticker, entryMonth, holdingPeriod, calcMethod = 'openClose' } = req.body;

  // Validate inputs
  if (!ticker || typeof ticker !== 'string') {
    return res.status(400).json({ error: 'Invalid ticker' });
  }
  if (!entryMonth || entryMonth < 1 || entryMonth > 12) {
    return res.status(400).json({ error: 'Invalid entryMonth. Must be 1-12' });
  }
  if (!holdingPeriod || ![1, 3, 6, 12].includes(holdingPeriod)) {
    return res.status(400).json({ error: 'Invalid holdingPeriod. Must be 1, 3, 6, or 12' });
  }
  if (!['openClose', 'maxMax'].includes(calcMethod)) {
    return res.status(400).json({ error: 'Invalid calcMethod. Must be "openClose" or "maxMax"' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO pattern_favorites (ticker, entry_month, holding_period, calc_method)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (ticker, entry_month, holding_period, calc_method)
       DO NOTHING
       RETURNING *`,
      [ticker.toUpperCase(), entryMonth, holdingPeriod, calcMethod]
    );

    if (result.rows.length === 0) {
      // Already exists, fetch it
      const existing = await queryOne<PatternFavorite>(
        `SELECT * FROM pattern_favorites
         WHERE ticker = $1 AND entry_month = $2 AND holding_period = $3 AND calc_method = $4`,
        [ticker.toUpperCase(), entryMonth, holdingPeriod, calcMethod]
      );
      return res.json(existing);
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding pattern favorite:', error);
    res.status(500).json({ error: 'Failed to add pattern favorite' });
  }
});

// DELETE /api/pattern-favorites/:id - Remove a pattern favorite
patternFavoritesRouter.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  try {
    const result = await pool.query(
      `DELETE FROM pattern_favorites WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pattern favorite not found' });
    }

    res.json({ deleted: true, id });
  } catch (error) {
    console.error('Error removing pattern favorite:', error);
    res.status(500).json({ error: 'Failed to remove pattern favorite' });
  }
});

// PATCH /api/pattern-favorites/:id/rating - Set rating for a pattern
patternFavoritesRouter.patch('/:id/rating', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { rating } = req.body;

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  // Rating can be null (to remove) or 1-5
  if (rating !== null && (typeof rating !== 'number' || rating < 1 || rating > 5)) {
    return res.status(400).json({ error: 'Invalid rating. Must be 1-5 or null' });
  }

  try {
    const result = await pool.query(
      `UPDATE pattern_favorites SET rating = $1 WHERE id = $2 RETURNING *`,
      [rating, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pattern favorite not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error setting pattern rating:', error);
    res.status(500).json({ error: 'Failed to set pattern rating' });
  }
});

// DELETE by pattern details (alternative to id-based delete)
// calcMethod is optional - if not provided, deletes any matching pattern regardless of calc_method
patternFavoritesRouter.delete('/', async (req, res) => {
  const { ticker, entryMonth, holdingPeriod, calcMethod } = req.body;

  if (!ticker || !entryMonth || !holdingPeriod) {
    return res.status(400).json({ error: 'Missing required fields: ticker, entryMonth, holdingPeriod' });
  }

  try {
    let result;
    if (calcMethod) {
      result = await pool.query(
        `DELETE FROM pattern_favorites
         WHERE ticker = $1 AND entry_month = $2 AND holding_period = $3 AND calc_method = $4
         RETURNING *`,
        [ticker.toUpperCase(), entryMonth, holdingPeriod, calcMethod]
      );
    } else {
      // Delete regardless of calc_method
      result = await pool.query(
        `DELETE FROM pattern_favorites
         WHERE ticker = $1 AND entry_month = $2 AND holding_period = $3
         RETURNING *`,
        [ticker.toUpperCase(), entryMonth, holdingPeriod]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pattern favorite not found' });
    }

    res.json({ deleted: true, pattern: result.rows[0] });
  } catch (error) {
    console.error('Error removing pattern favorite:', error);
    res.status(500).json({ error: 'Failed to remove pattern favorite' });
  }
});

// PATCH by key (TICKER-MONTH-PERIOD) - Update rating
patternFavoritesRouter.patch('/key/:key/rating', async (req, res) => {
  const keyParts = req.params.key.split('-');
  if (keyParts.length < 3) {
    return res.status(400).json({ error: 'Invalid key format. Expected TICKER-MONTH-PERIOD' });
  }

  const holdingPeriod = parseInt(keyParts[keyParts.length - 1], 10);
  const month = parseInt(keyParts[keyParts.length - 2], 10);
  const ticker = keyParts.slice(0, -2).join('-'); // Handle tickers with dashes

  const { rating } = req.body;

  // Rating can be null (to remove) or 1-5
  if (rating !== null && (typeof rating !== 'number' || rating < 1 || rating > 5)) {
    return res.status(400).json({ error: 'Invalid rating. Must be 1-5 or null' });
  }

  try {
    const result = await pool.query(
      `UPDATE pattern_favorites SET rating = $1
       WHERE ticker = $2 AND entry_month = $3 AND holding_period = $4
       RETURNING *`,
      [rating, ticker.toUpperCase(), month, holdingPeriod]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pattern favorite not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error setting pattern rating:', error);
    res.status(500).json({ error: 'Failed to set pattern rating' });
  }
});
