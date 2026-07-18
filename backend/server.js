'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/chains', require('./routes/chains'));
app.use('/api/deploy', require('./routes/deploy'));
app.use('/api/passkeys', require('./routes/passkeys'));
app.use('/api/admin-passkey', require('./routes/admin-passkey'));
app.use('/api/rpc', require('./routes/rpc'));
app.use('/api/artifact', require('./routes/artifact'));
app.use('/api/runtime', require('./routes/runtime'));
app.use('/api/funding', require('./routes/funding'));
app.use('/api/deliverables', require('./routes/deliverables'));
app.use('/api/thank-you', require('./routes/thank-you'));
app.use('/api/trace', require('./routes/trace'));
app.use('/api/anti-abuse', require('./routes/anti-abuse'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', project: 'SecureGate EIP-777G' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`SecureGate EIP-777G backend running on port ${PORT}`);
});

module.exports = app;
