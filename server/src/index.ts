import express from 'express';
import cors from 'cors';
import pino from 'pino';
import { config } from './config.js';
import { stocksRouter } from './routes/stocks.js';
import { pricesRouter } from './routes/prices.js';
import { healthRouter } from './routes/health.js';
import { screenerRouter } from './routes/screener.js';
import { stockInfoRouter } from './routes/stockInfo.js';
import { tickerSentimentRouter } from './routes/tickerSentiment.js';
import { patternFavoritesRouter } from './routes/patternFavorites.js';
import { marketEventsRouter } from './routes/marketEvents.js';

const logger = pino({
  level: config.logLevel,
  transport: config.isDev
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

const app = express();

// Middleware
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// Simple request logging
app.use((req, _res, next) => {
  logger.info({ method: req.method, url: req.url }, 'request');
  next();
});

// Routes
app.use('/api/health', healthRouter);
app.use('/api/stocks', stocksRouter);
app.use('/api/prices', pricesRouter);
app.use('/api/screener', screenerRouter);
app.use('/api/stock-info', stockInfoRouter);
app.use('/api/ticker-sentiment', tickerSentimentRouter);
app.use('/api/pattern-favorites', patternFavoritesRouter);
app.use('/api/market-events', marketEventsRouter);

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    logger.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
);

app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
});

export { app, logger };
