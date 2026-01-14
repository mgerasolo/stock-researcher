import { Router } from 'express';
import { pool } from '../db.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  try {
    // Check database connection
    const dbResult = await pool.query('SELECT NOW() as time');
    const lastUpdate = await pool.query(`
      SELECT MAX(updated_at) as last_update
      FROM monthly_prices
    `);

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        time: dbResult.rows[0].time,
      },
      data: {
        lastUpdate: lastUpdate.rows[0]?.last_update || null,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});
