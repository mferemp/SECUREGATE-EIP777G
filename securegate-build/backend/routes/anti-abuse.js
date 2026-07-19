'use strict';

// POST /api/anti-abuse/event — record a rate-limit event using privacy-preserving
// trace keys. The request supplies a coarse subject (e.g. a K1 address bucket) and
// an action name; we store ONLY the opaque HMAC digest and an integer count.
//
// We never store raw fingerprints, private keys, seed phrases, raw markers, or raw
// K1 values — the raw subject is reduced to a trace key here and immediately dropped.

const express = require('express');
const { record, isKnownAction } = require('../lib/anti-abuse-kv');
const { bucketKey } = require('../lib/trace-key');

const router = express.Router();

router.post('/event', async (req, res) => {
  const action = req.body && req.body.action;
  if (!isKnownAction(action)) {
    return res.status(400).json({ error: 'unknown action' });
  }

  // `subject` is any coarse identifier (K1 address, device marker, etc). It is
  // hashed into a trace key and never persisted in raw form.
  const subject = (req.body && req.body.subject) || '';
  const tKey = bucketKey(action, subject);

  try {
    const result = await record(action, tKey);
    return res.json({
      action: result.action,
      allowed: result.allowed,
      remaining: Math.max(0, result.max - result.count),
      max: result.max,
    });
  } catch (_) {
    return res.status(500).json({ error: 'could not record event' });
  }
});

module.exports = router;
