'use strict'

const express = require('express')

module.exports = function mount(routerFactory, stripSegments = 2) {
  const app = express()

  app.disable('x-powered-by')
  app.use(express.json({ limit: '128kb' }))

  app.use((req, _res, next) => {
    const url = new URL(req.url, 'http://localhost')
    const parts = url.pathname.split('/').filter(Boolean)

    if (parts[0] === 'api') {
      const stripped = '/' + parts.slice(stripSegments).join('/')
      req.url = stripped === '/' ? '/' + url.search : stripped + url.search
    }

    next()
  })

  app.use('/', routerFactory())

  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found' })
  })

  return (req, res) => app(req, res)
}
