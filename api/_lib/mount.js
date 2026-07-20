'use strict';
// Wrap a single Express router as a Vercel serverless handler.
// Vercel passes the full URL (e.g. /api/passkeys/verify). The Express router
// expects paths relative to its mount point, so we strip the /api/<name> prefix.
const express = require('express');

module.exports = function mount(routerFactory) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '128kb' }));
  app.use((req, _res, next) => {
    // Strip /api/<segment> so the router sees /verify, /register, etc.
    req.url = req.url.replace(/^\/api\/[^/?]+/, '') || '/';
    next();
  });
  app.use('/', routerFactory());
  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  return (req, res) => app(req, res);
};
