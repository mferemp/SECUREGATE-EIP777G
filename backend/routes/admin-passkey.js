'use strict'

const express = require('express')
const store = require('../lib/passkey-store')

const router = express.Router()

router.post('/generate', async (req, res) => {
  const { adminKey, k1 } = req.body || {}

  if (!adminKey || !k1) {
    return res.status(400).json({ error: 'adminKey and k1 required' })
  }

  const configuredAdminKey = process.env.SECUREGATE_ADMIN_KEY

  if (!configuredAdminKey) {
    return res.status(503).json({
      disabled: true,
      reason: 'Admin key minting is not configured on this deployment.'
    })
  }

  if (adminKey !== configuredAdminKey) {
    return res.status(403).json({ error: 'admin key invalid' })
  }

  const result = await store.mint(k1)
  if (result.error) return res.status(400).json(result)
  return res.json(result)
})

module.exports = router
