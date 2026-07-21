'use strict'

const mount = require('./_lib/mount')

module.exports = mount(
  () => require('../backend/routes/runtime'),
  '/api/runtime',
  { methods: ['GET', 'OPTIONS'] }
)
