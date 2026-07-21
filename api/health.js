'use strict'

const mount = require('./_lib/mount')

module.exports = mount(
  () => {
    const { Router } = require(require.resolve('express', { paths: [require('path').join(__dirname, '../backend')] }))
    const router = Router()
    router.get('/', (_req, res) => res.status(200).json({ ok: true, service: 'securegate-eip777g', ts: Date.now() }))
    return router
  },
  '/api/health',
  { methods: ['GET', 'OPTIONS'] }
)
