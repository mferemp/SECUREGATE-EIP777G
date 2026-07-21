'use strict'

const mount = require('../_lib/mount')

module.exports = mount(
  () => require('../../backend/routes/passkeys'),
  '/api/passkeys',
  { methods: ['POST', 'OPTIONS'] }
)
