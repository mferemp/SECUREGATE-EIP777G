'use strict';

// Thank-you envelope routes (optional, non-recovery):
//   GET  /api/thank-you/config — returns the handle + optional copy address only.
//   POST /api/thank-you/send   — sends a note via X if configured, else disabled.
//
// The thank-you address is thank-you-only copy data. It is NOT K3, NOT a fallback
// route, NOT a deploy parameter, and NOT part of any proof logic.

const express = require('express');

const router = express.Router();

router.get('/config', (_req, res) => {
  res.json({
    handle: process.env.THANK_YOU_HANDLE || '@hope_ology',
    network: process.env.THANK_YOU_NETWORK || 'EVM',
    // Optional copy-only address; empty string when unset.
    copyAddress: process.env.THANK_YOU_COPY_ADDRESS || '',
  });
});

router.post('/send', async (req, res) => {
  const token = process.env.X_OAUTH2_ACCESS_TOKEN;
  const recipientId = process.env.X_THANK_YOU_RECIPIENT_ID;
  const message = String((req.body && req.body.message) || '').slice(0, 280).trim();

  if (!message) {
    return res.status(400).json({ error: 'message required' });
  }
  // Honest capability reporting: if X is not configured, sending is disabled.
  if (!token || !recipientId) {
    return res.json({ sent: false, disabled: true, reason: 'thank-you sending not configured' });
  }

  try {
    const upstream = await fetch(`https://api.twitter.com/2/dm_conversations/with/${encodeURIComponent(recipientId)}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
    if (!upstream.ok) {
      return res.json({ sent: false, disabled: false, reason: 'delivery failed' });
    }
    return res.json({ sent: true });
  } catch (_) {
    return res.json({ sent: false, disabled: false, reason: 'delivery error' });
  }
});

module.exports = router;
