'use strict'

const express = require('express')
const store = require('../lib/passkey-store')

const router = express.Router()

router.post('/register', async (req, res) => {
  const result = await store.register(req.body && req.body.k1)
  if (result.error) return res.status(400).json(result)
  return res.status(403).json(result)
})

router.post('/verify', async (req, res) => {
  const { k1, passkey } = req.body || {}
  if (!k1 || !passkey) {
    return res.status(400).json({ verified: false, error: 'k1 and passkey required' })
  }
  const result = await store.verify(k1, passkey)
  return res.status(result.verified ? 200 : 401).json(result)
})

module.exports = router
