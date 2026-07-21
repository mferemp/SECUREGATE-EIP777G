'use strict'

const express = require('express')
const crypto = require('crypto')

const router = express.Router()

function bucket(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || 'anon').toLowerCase())
    .digest('hex')
    .slice(0, 16)
}

router.post('/event', async (req, res) => {
  const { action, subject } = req.body || {}

  if (!action || typeof action !== 'string') {
    return res.status(400).json({ error: 'action required' })
  }

  return res.json({
    ok: true,
    action: action.slice(0, 64),
    bucket: bucket(subject),
    ts: Date.now()
  })
})

module.exports = router
