'use strict';
// Serverless adapter — mounts backend routes without calling app.listen()
const express = require('express');
const path = require('path');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '128kb' }));

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

function mount(route, file) {
  const routePath = path.join(__dirname, '..', '..', 'backend', 'routes', file);
  app.use(route, require(routePath));
}

mount('/api/chains',        'chains.js');
mount('/api/funding',       'funding.js');
mount('/api/rpc',           'rpc.js');
mount('/api/deploy',        'deploy.js');
mount('/api/passkeys',      'passkeys.js');
mount('/api/admin-passkey', 'admin-passkey.js');
mount('/api/artifact',      'artifact.js');
mount('/api/anti-abuse',    'anti-abuse.js');
mount('/api/thank-you',     'thank-you.js');
mount('/api/trace',         'trace.js');
mount('/api/runtime',       'runtime.js');

app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'securegate-eip777g' });
});

// 404 for any unmatched /api route
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not_found', path: req.path });
});

module.exports = app;
