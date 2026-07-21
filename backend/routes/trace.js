'use strict'

const express = require('express')
const crypto = require('crypto')

const router = express.Router()

function hashSubject(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || 'anon').toLowerCase())
    .digest('hex')
    .slice(0, 24)
}

router.post('/:kind', async (req, res) => {
  const kind = String(req.params.kind || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'unknown'
  const subjectHash = hashSubject((req.body && (req.body.k1 || req.body.subject)) || 'anon')
  return res.json({ ok: true, kind, subjectHash, ts: Date.now() })
})

module.exports = router
