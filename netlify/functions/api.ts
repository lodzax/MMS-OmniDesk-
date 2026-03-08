import serverless from 'serverless-http';
import express from 'express';
import apiRouter from '../../src/api-router.ts';

const app = express();
app.use(express.json());

// Mount the API router
app.use('/api', apiRouter);

// API 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.originalUrl}` });
});

export const handler = serverless(app);
