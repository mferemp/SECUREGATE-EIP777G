'use strict';

// GET /api/chains  — public chain metadata ONLY. No RPC URLs, no env names.

const express = require('express');
const chains = require('../config/chains');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ chains: chains.listPublic() });
});

module.exports = router;
