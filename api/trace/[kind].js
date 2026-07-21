'use strict'

const mount = require('../_lib/mount')

module.exports = mount(
  () => require('../../backend/routes/trace'),
  '/api/trace',
  { methods: ['POST', 'OPTIONS'] }
)
