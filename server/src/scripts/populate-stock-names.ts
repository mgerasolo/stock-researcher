/**
 * One-time migration script to populate company names from Yahoo Finance
 * Run with: npx tsx src/scripts/populate-stock-names.ts
 */

import YahooFinance from 'yahoo-finance2';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'stock_researcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

const yahooFinance = new YahooFinance();

async function populateStockNames() {
  console.log('Starting stock name population...');

  // Get all stocks that need name updates (name equals ticker)
  const result = await pool.query<{ ticker: string }>(
    `SELECT ticker FROM stocks WHERE name = ticker OR name IS NULL ORDER BY tier, ticker`
  );

  console.log(`Found ${result.rows.length} stocks to update`);

  let updated = 0;
  let failed = 0;

  for (const row of result.rows) {
    const ticker = row.ticker;

    try {
      // Fetch quote from Yahoo Finance
      const quote = (await yahooFinance.quote(ticker)) as Record<string, unknown>;

      if (quote) {
        const name = (quote.longName as string) || (quote.shortName as string) || ticker;

        if (name && name !== ticker) {
          await pool.query(`UPDATE stocks SET name = $1 WHERE ticker = $2`, [name, ticker]);
          console.log(`✓ ${ticker}: ${name}`);
          updated++;
        } else {
          console.log(`- ${ticker}: no name available`);
        }
      }
    } catch (error) {
      console.error(`✗ ${ticker}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      failed++;
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(`\nDone! Updated: ${updated}, Failed: ${failed}`);
  await pool.end();
}

populateStockNames().catch(console.error);
