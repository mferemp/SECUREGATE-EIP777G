'use strict';

// Thank-you envelope routes (optional, non-recovery):
//   GET  /api/thank-you/config — returns handle, EVM address, xUrl, noteEnabled.
//   POST /api/thank-you/send   — sends a DM via X/Twitter if env is configured.
//
// No auth-gate required. The thank-you address is copy-only data — not a deploy
// parameter, fallback route, or part of any proof logic.

const express = require('express');

const router = express.Router();
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function configuredThankYouAddress() {
  const candidates = [
    process.env.THANK_YOU_EVM_ADDRESS,
    process.env.THANK_YOU_ETH_ADDRESS,
    process.env.THANKYOU_ADDRESS,
    process.env.THANK_YOU_COPY_ADDRESS,
  ];
  for (const value of candidates) {
    const clean = String(value || '').trim();
    if (EVM_ADDRESS_RE.test(clean)) return clean;
  }
  return '';
}

router.get('/config', (_req, res) => {
  res.json({
    handle: process.env.THANKYOU_HANDLE || '@hope_ology',
    xUrl: process.env.THANKYOU_X_URL || 'https://x.com/hope_ology',
    network: 'EVM',
    copyAddress: configuredThankYouAddress(),
    noteEnabled: Boolean(
      process.env.X_OAUTH2_ACCESS_TOKEN && process.env.X_THANK_YOU_RECIPIENT_ID
    ),
  });
});

router.post('/send', async (req, res) => {
  const token = process.env.X_OAUTH2_ACCESS_TOKEN;
  const recipientId = process.env.X_THANK_YOU_RECIPIENT_ID;
  // No slice — message length is not capped.
  const message = String((req.body && req.body.message) || '').trim();

  if (!message) {
    return res.status(400).json({ error: 'message required' });
  }

  // Honest capability reporting: if X credentials are absent, sending is disabled.
  if (!token || !recipientId) {
    return res.json({
      sent: false,
      disabled: true,
      reason: 'thank-you sending not configured',
    });
  }

  try {
    const upstream = await fetch(
      `https://api.twitter.com/2/dm_conversations/with/${encodeURIComponent(recipientId)}/messages`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ text: message }),
      }
    );

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      return res.status(502).json({
        sent: false,
        disabled: false,
        reason: 'X DM delivery failed',
        upstreamStatus: upstream.status,
        detail: detail.slice(0, 500),
      });
    }

    return res.json({ sent: true });
  } catch (_) {
    return res.status(502).json({
      sent: false,
      disabled: false,
      reason: 'X DM delivery error',
    });
  }
});

module.exports = router;
