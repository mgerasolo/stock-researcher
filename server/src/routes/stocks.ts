import { Router } from 'express';
import { query, queryOne } from '../db.js';

export const stocksRouter = Router();

interface Stock {
  id: number;
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  tier: number;
  created_at: Date;
}

// GET /api/stocks - List all stocks
stocksRouter.get('/', async (_req, res) => {
  try {
    const stocks = await query<Stock>(`
      SELECT s.*,
             COUNT(mp.id) as month_count,
             MIN(mp.year) as data_start_year,
             MAX(mp.year) as data_end_year
      FROM stocks s
      LEFT JOIN monthly_prices mp ON s.ticker = mp.ticker
      GROUP BY s.id
      ORDER BY s.tier, s.ticker
    `);
    res.json(stocks);
  } catch (error) {
    console.error('Error fetching stocks:', error);
    res.status(500).json({ error: 'Failed to fetch stocks' });
  }
});

// GET /api/stocks/search?q=AAPL - Search stocks by ticker or company name
stocksRouter.get('/search', async (req, res) => {
  const searchQuery = (req.query.q as string)?.trim() || '';

  if (!searchQuery || searchQuery.length < 1) {
    return res.json([]);
  }

  try {
    // Search by ticker (starts with) OR name (contains)
    // Priority: exact ticker > ticker starts with > name starts with > name contains
    const stocks = await query<Stock>(
      `
      SELECT * FROM stocks
      WHERE ticker ILIKE $1 OR name ILIKE $2
      ORDER BY
        CASE
          WHEN UPPER(ticker) = UPPER($3) THEN 0
          WHEN ticker ILIKE $1 THEN 1
          WHEN name ILIKE $4 THEN 2
          ELSE 3
        END,
        tier,
        ticker
      LIMIT 15
    `,
      [`${searchQuery}%`, `%${searchQuery}%`, searchQuery, `${searchQuery}%`]
    );
    res.json(stocks);
  } catch (error) {
    console.error('Error searching stocks:', error);
    res.status(500).json({ error: 'Failed to search stocks' });
  }
});

// GET /api/stocks/:ticker - Get single stock details
stocksRouter.get('/:ticker', async (req, res) => {
  const { ticker } = req.params;

  try {
    const stock = await queryOne<Stock>(
      `SELECT * FROM stocks WHERE ticker = $1`,
      [ticker.toUpperCase()]
    );

    if (!stock) {
      return res.status(404).json({ error: 'Stock not found' });
    }

    res.json(stock);
  } catch (error) {
    console.error('Error fetching stock:', error);
    res.status(500).json({ error: 'Failed to fetch stock' });
  }
});
