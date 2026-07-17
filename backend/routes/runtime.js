'use strict';

// GET /api/runtime — reports the Node runtime the backend process is ACTUALLY
// running under. Used by scripts/verify-node24-runtime.cjs to prove the server
// runtime (not just the build) is Node 24. Exposes no secrets and no RPC URLs.
//
// (The SDK already serves GET /api/health -> {status:"ok"}; this adds the
// version detail without shadowing that route.)

const express = require('express');

const router = express.Router();

router.get('/', (_req, res) => {
  const major = Number(process.versions.node.split('.')[0]);
  res.json({
    status: 'ok',
    node: process.version,
    nodeMajor: major,
    node24: major === 24,
    uptimeSec: Math.round(process.uptime()),
  });
});

module.exports = router;
