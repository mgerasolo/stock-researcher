import { Router } from 'express';
import { query, queryOne, pool } from '../db.js';

export const tickerSentimentRouter = Router();

interface TickerSentiment {
  ticker: string;
  sentiment: 'up' | 'down' | 'investigate';
  note: string | null;
  updated_at: Date;
  created_at: Date;
}

interface TickerSentimentDetail {
  ticker: string;
  sentiment: 'up' | 'down' | 'investigate';
  name: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

// GET /api/ticker-sentiment - Get all ticker sentiments (simple map for quick lookup)
tickerSentimentRouter.get('/', async (_req, res) => {
  try {
    const sentiments = await query<TickerSentiment>(
      `SELECT ticker, sentiment, updated_at FROM ticker_sentiment ORDER BY ticker`
    );
    // Return as a map for easier client-side lookup
    const sentimentMap: Record<string, 'up' | 'down' | 'investigate'> = {};
    sentiments.forEach((s) => {
      sentimentMap[s.ticker] = s.sentiment;
    });
    res.json(sentimentMap);
  } catch (error) {
    console.error('Error fetching ticker sentiments:', error);
    res.status(500).json({ error: 'Failed to fetch ticker sentiments' });
  }
});

// GET /api/ticker-sentiment/detailed - Get all ticker sentiments with company names
tickerSentimentRouter.get('/detailed', async (_req, res) => {
  try {
    const sentiments = await query<TickerSentimentDetail>(
      `SELECT
        ts.ticker,
        ts.sentiment,
        s.name,
        ts.note,
        ts.created_at,
        ts.updated_at
      FROM ticker_sentiment ts
      LEFT JOIN stocks s ON ts.ticker = s.ticker
      ORDER BY ts.created_at DESC`
    );
    res.json(sentiments);
  } catch (error) {
    console.error('Error fetching detailed ticker sentiments:', error);
    res.status(500).json({ error: 'Failed to fetch detailed ticker sentiments' });
  }
});

// PUT /api/ticker-sentiment/:ticker - Set sentiment for a ticker
tickerSentimentRouter.put('/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const { sentiment } = req.body;

  if (!sentiment || !['up', 'down', 'investigate'].includes(sentiment)) {
    return res.status(400).json({ error: 'Invalid sentiment. Must be "up", "down", or "investigate"' });
  }

  try {
    await pool.query(
      `INSERT INTO ticker_sentiment (ticker, sentiment, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (ticker)
       DO UPDATE SET sentiment = $2, updated_at = NOW()`,
      [ticker, sentiment]
    );
    res.json({ ticker, sentiment });
  } catch (error) {
    console.error('Error setting ticker sentiment:', error);
    res.status(500).json({ error: 'Failed to set ticker sentiment' });
  }
});

// DELETE /api/ticker-sentiment/:ticker - Remove sentiment (back to neutral)
tickerSentimentRouter.delete('/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();

  try {
    await pool.query(`DELETE FROM ticker_sentiment WHERE ticker = $1`, [ticker]);
    res.json({ ticker, sentiment: null });
  } catch (error) {
    console.error('Error removing ticker sentiment:', error);
    res.status(500).json({ error: 'Failed to remove ticker sentiment' });
  }
});

// PATCH /api/ticker-sentiment/:ticker/note - Update note for a ticker
tickerSentimentRouter.patch('/:ticker/note', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const { note } = req.body;

  // Note can be null (to remove) or string up to 2000 chars
  if (note !== null && typeof note !== 'string') {
    return res.status(400).json({ error: 'Invalid note. Must be string or null' });
  }

  if (note && note.length > 2000) {
    return res.status(400).json({ error: 'Note too long. Maximum 2000 characters' });
  }

  try {
    const result = await pool.query(
      `UPDATE ticker_sentiment SET note = $1, updated_at = NOW()
       WHERE ticker = $2
       RETURNING ticker, sentiment, note`,
      [note || null, ticker]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticker sentiment not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error setting ticker note:', error);
    res.status(500).json({ error: 'Failed to set ticker note' });
  }
});
