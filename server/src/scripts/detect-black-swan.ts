/**
 * Black Swan Detection Script
 *
 * Analyzes SPY monthly data to detect black swan events:
 * - 3+ consecutive months with negative returns
 * - Cumulative loss of at least 5%
 *
 * Run with: npx tsx src/scripts/detect-black-swan.ts
 */

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

interface MonthlyReturn {
  year: number;
  month: number;
  close_last: number;
  pct_change: number | null;
}

interface BlackSwanPeriod {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
  consecutiveMonths: number;
  cumulativeLoss: number;
  months: { year: number; month: number; pctChange: number }[];
}

async function detectBlackSwanPeriods(): Promise<BlackSwanPeriod[]> {
  console.log('Analyzing SPY monthly returns for black swan periods...');
  console.log('Criteria: 3+ consecutive months down, ≥5% cumulative loss\n');

  // Get SPY monthly returns with percentage change
  const result = await pool.query<MonthlyReturn>(`
    SELECT
      year,
      month,
      close_last,
      ROUND(((close_last - LAG(close_last) OVER (ORDER BY year, month)) /
             LAG(close_last) OVER (ORDER BY year, month) * 100)::numeric, 2) AS pct_change
    FROM monthly_prices
    WHERE ticker = 'SPY'
    ORDER BY year, month
  `);

  const rows = result.rows;
  const blackSwans: BlackSwanPeriod[] = [];

  let currentStreak: { year: number; month: number; pctChange: number }[] = [];
  let cumulativeLoss = 0;

  for (const row of rows) {
    if (row.pct_change === null) continue;

    const pctChange = parseFloat(String(row.pct_change));

    if (pctChange < 0) {
      // Down month - add to streak
      currentStreak.push({
        year: row.year,
        month: row.month,
        pctChange: pctChange
      });
      // Cumulative calculation: multiply the returns
      if (cumulativeLoss === 0) {
        cumulativeLoss = pctChange;
      } else {
        // Compound the returns
        cumulativeLoss = ((1 + cumulativeLoss / 100) * (1 + pctChange / 100) - 1) * 100;
      }
    } else {
      // Up month - check if previous streak qualifies
      if (currentStreak.length >= 3 && cumulativeLoss <= -5) {
        blackSwans.push({
          startYear: currentStreak[0].year,
          startMonth: currentStreak[0].month,
          endYear: currentStreak[currentStreak.length - 1].year,
          endMonth: currentStreak[currentStreak.length - 1].month,
          consecutiveMonths: currentStreak.length,
          cumulativeLoss: Math.round(cumulativeLoss * 100) / 100,
          months: [...currentStreak]
        });
      }
      // Reset streak
      currentStreak = [];
      cumulativeLoss = 0;
    }
  }

  // Check final streak if ends at current month
  if (currentStreak.length >= 3 && cumulativeLoss <= -5) {
    blackSwans.push({
      startYear: currentStreak[0].year,
      startMonth: currentStreak[0].month,
      endYear: currentStreak[currentStreak.length - 1].year,
      endMonth: currentStreak[currentStreak.length - 1].month,
      consecutiveMonths: currentStreak.length,
      cumulativeLoss: Math.round(cumulativeLoss * 100) / 100,
      months: [...currentStreak]
    });
  }

  return blackSwans;
}

function formatMonth(year: number, month: number): string {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[month - 1]} ${year}`;
}

async function saveBlackSwanEvents(periods: BlackSwanPeriod[]): Promise<void> {
  console.log('\nSaving detected black swan periods to database...');

  for (const period of periods) {
    const startDate = `${period.startYear}-${String(period.startMonth).padStart(2, '0')}-01`;
    const endDate = `${period.endYear}-${String(period.endMonth).padStart(2, '0')}-28`;

    // Generate a title based on the period
    let title = `Market Decline ${formatMonth(period.startYear, period.startMonth)} - ${formatMonth(period.endYear, period.endMonth)}`;

    // Check if this period overlaps with existing events
    const existing = await pool.query<{ id: number; title: string }>(
      `SELECT id, title FROM market_events
       WHERE event_type = 'black_swan'
       AND (
         (event_date <= $1 AND (end_date IS NULL OR end_date >= $1))
         OR (event_date <= $2 AND (end_date IS NULL OR end_date >= $2))
         OR (event_date >= $1 AND end_date <= $2)
       )`,
      [startDate, endDate]
    );

    if (existing.rows.length > 0) {
      console.log(`  ⚠ Skipping overlap with existing event: ${existing.rows[0].title}`);
      continue;
    }

    const description = `Auto-detected: ${period.consecutiveMonths} consecutive months of decline ` +
      `with ${period.cumulativeLoss.toFixed(2)}% cumulative loss in SPY.`;

    await pool.query(
      `INSERT INTO market_events (event_type, event_date, end_date, title, description, sp500_impact, impact, source)
       VALUES ('black_swan', $1, $2, $3, $4, $5, 'high', 'auto-detected')
       ON CONFLICT DO NOTHING`,
      [startDate, endDate, title, description, period.cumulativeLoss]
    );

    console.log(`  ✓ Saved: ${title} (${period.cumulativeLoss.toFixed(2)}%)`);
  }
}

async function main(): Promise<void> {
  console.log('Black Swan Detection Script\n');
  console.log('='.repeat(60) + '\n');

  try {
    const periods = await detectBlackSwanPeriods();

    console.log(`Found ${periods.length} black swan periods:\n`);

    for (const period of periods) {
      console.log(`📉 ${formatMonth(period.startYear, period.startMonth)} → ${formatMonth(period.endYear, period.endMonth)}`);
      console.log(`   ${period.consecutiveMonths} consecutive down months`);
      console.log(`   Cumulative loss: ${period.cumulativeLoss.toFixed(2)}%`);
      console.log(`   Monthly breakdown:`);
      for (const m of period.months) {
        console.log(`     - ${formatMonth(m.year, m.month)}: ${m.pctChange.toFixed(2)}%`);
      }
      console.log();
    }

    // Save to database
    await saveBlackSwanEvents(periods);

    // Show all black swan events in database
    const result = await pool.query(
      `SELECT title, event_date, end_date, sp500_impact
       FROM market_events
       WHERE event_type = 'black_swan' OR event_type = 'crash'
       ORDER BY event_date`
    );

    console.log('\n' + '='.repeat(60));
    console.log('All Black Swan/Crash Events in Database:');
    console.log('='.repeat(60));
    for (const row of result.rows) {
      console.log(`  ${row.title}: ${row.event_date} to ${row.end_date || 'ongoing'} (${row.sp500_impact}%)`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();
