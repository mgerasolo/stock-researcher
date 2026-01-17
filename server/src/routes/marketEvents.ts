import { Router } from 'express';
import { query } from '../db.js';

export const marketEventsRouter = Router();

interface MarketEvent {
  id: number;
  event_type: string;
  event_date: Date;
  end_date: Date | null;
  title: string;
  description: string | null;
  sp500_impact: number | null;
  sectors_affected: string[] | null;
  impact: string | null;
  source: string | null;
}

interface BlackSwanMonth {
  year: number;
  month: number;
  event_id: number;
  event_title: string;
  event_type: string;
  sp500_impact: number | null;
}

// GET /api/market-events - List all market events
marketEventsRouter.get('/', async (_req, res) => {
  try {
    const events = await query<MarketEvent>(`
      SELECT *
      FROM market_events
      ORDER BY event_date DESC
    `);
    res.json(events);
  } catch (error) {
    console.error('Error fetching market events:', error);
    res.status(500).json({ error: 'Failed to fetch market events' });
  }
});

// GET /api/market-events/black-swan-months - Get all months affected by black swan events
// Returns year/month combinations that fall within black swan periods
marketEventsRouter.get('/black-swan-months', async (_req, res) => {
  try {
    // Get all black swan and crash events
    const events = await query<MarketEvent>(`
      SELECT id, event_type, event_date, end_date, title, sp500_impact
      FROM market_events
      WHERE event_type IN ('black_swan', 'crash')
      ORDER BY event_date
    `);

    // Build a list of all affected months
    const affectedMonths: BlackSwanMonth[] = [];

    for (const event of events) {
      const startDate = new Date(event.event_date);
      const endDate = event.end_date ? new Date(event.end_date) : startDate;

      // Generate all months between start and end
      const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

      while (current <= end) {
        affectedMonths.push({
          year: current.getFullYear(),
          month: current.getMonth() + 1,
          event_id: event.id,
          event_title: event.title,
          event_type: event.event_type,
          sp500_impact: event.sp500_impact ? parseFloat(String(event.sp500_impact)) : null,
        });
        current.setMonth(current.getMonth() + 1);
      }
    }

    // Group by year-month to handle overlapping events
    const monthMap = new Map<string, BlackSwanMonth[]>();
    for (const month of affectedMonths) {
      const key = `${month.year}-${month.month}`;
      if (!monthMap.has(key)) {
        monthMap.set(key, []);
      }
      monthMap.get(key)!.push(month);
    }

    // Convert to array format with deduplication
    const result = Array.from(monthMap.entries()).map(([key, events]) => {
      const [year, month] = key.split('-').map(Number);
      return {
        year,
        month,
        events: events.map(e => ({
          id: e.event_id,
          title: e.event_title,
          type: e.event_type,
          impact: e.sp500_impact,
        })),
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching black swan months:', error);
    res.status(500).json({ error: 'Failed to fetch black swan months' });
  }
});

// GET /api/market-events/black-swans - Get all black swan events
// Returns events with type 'black_swan' or 'crash'
marketEventsRouter.get('/black-swans', async (_req, res) => {
  try {
    const events = await query<MarketEvent>(`
      SELECT id, event_type, event_date as start_date, end_date, title as name,
             description, sp500_impact, sectors_affected, impact
      FROM market_events
      WHERE event_type IN ('black_swan', 'crash')
      ORDER BY event_date DESC
    `);
    // Convert sp500_impact to number
    const formattedEvents = events.map(e => ({
      ...e,
      sp500_impact: e.sp500_impact ? parseFloat(String(e.sp500_impact)) : null
    }));
    res.json(formattedEvents);
  } catch (error) {
    console.error('Error fetching black swan events:', error);
    res.status(500).json({ error: 'Failed to fetch black swan events' });
  }
});

// GET /api/market-events/types - Get event type summary
marketEventsRouter.get('/types', async (_req, res) => {
  try {
    const types = await query<{ event_type: string; count: number }>(`
      SELECT event_type, COUNT(*)::int as count
      FROM market_events
      GROUP BY event_type
      ORDER BY count DESC
    `);
    res.json(types);
  } catch (error) {
    console.error('Error fetching event types:', error);
    res.status(500).json({ error: 'Failed to fetch event types' });
  }
});
