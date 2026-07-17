'use strict';

// /api/trace — device breadcrumb + ping (S07).
//
//   POST /api/trace/ping     — a device heartbeat (repeated scans notice).
//   POST /api/trace/download — a dashboard-download breadcrumb (repeated pulls).
//
// The request supplies a coarse `subject` (e.g. a K1 bucket + device marker). It
// is reduced to an opaque trace key here and dropped; we never persist raw
// fingerprints, keys, seeds, or markers. Both endpoints ALSO pass through the
// anti-abuse limiter so repetition is throttled, but a breadcrumb never blocks a
// legitimate recovery — it is a coarse signal only.

const express = require('express');
const { record } = require('../lib/anti-abuse-kv');
const { bucketKey } = require('../lib/trace-key');
const { recordBreadcrumb } = require('../lib/trace-store');

const router = express.Router();

async function handle(kind, action, req, res) {
  const subject = (req.body && req.body.subject) || '';
  const tKey = bucketKey(kind, subject);
  try {
    const limit = await record(action, tKey);
    const crumb = await recordBreadcrumb(kind, tKey);
    return res.json({
      kind,
      allowed: limit.allowed,
      remaining: Math.max(0, limit.max - limit.count),
      repeatCount: crumb.count,
      flagged: crumb.flagged,
      durable: crumb.durable,
    });
  } catch (_) {
    return res.status(500).json({ error: 'could not record breadcrumb' });
  }
}

router.post('/ping', (req, res) => handle('ping', 'dashboard_ping', req, res));
router.post('/download', (req, res) => handle('download', 'dashboard_download', req, res));

module.exports = router;
