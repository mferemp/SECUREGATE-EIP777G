'use strict'

// express lives in backend/node_modules — resolve from there so api/ handlers
// don't need their own copy.
const express = require(require.resolve('express', { paths: [require('path').join(__dirname, '../../backend')] }))

function securityHeaders (_req, res, next) {
  res.setHeader('x-content-type-options', 'nosniff')
  res.setHeader('x-frame-options', 'DENY')
  res.setHeader('referrer-policy', 'no-referrer')
  res.setHeader('cache-control', 'no-store')
  next()
}

function jsonErrorHandler (err, _req, res, next) {
  if (!err) return next()

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid_json' })
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'body_too_large' })
  }

  return res.status(400).json({ error: 'bad_request' })
}

/**
 * mount(routerFactory, prefix, options)
 *
 * routerFactory  – zero-arg fn returning an Express Router
 * prefix         – URL prefix to strip before handing to the router
 *                  (e.g. '/api/deploy')
 * options.methods – allowed HTTP methods, defaults to ['GET','POST','OPTIONS']
 */
module.exports = function mount (routerFactory, prefix, options) {
  const opts = options || {}
  const allowedMethods = new Set(opts.methods || ['GET', 'POST', 'OPTIONS'])

  const app = express()

  app.disable('x-powered-by')
  app.use(securityHeaders)

  // Method guard
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      res.setHeader('allow', Array.from(allowedMethods).join(', '))
      return res.status(204).end()
    }

    if (!allowedMethods.has(req.method)) {
      res.setHeader('allow', Array.from(allowedMethods).join(', '))
      return res.status(405).json({ error: 'method_not_allowed' })
    }

    next()
  })

  app.use(express.json({
    limit: '128kb',
    strict: true,
    type: ['application/json', 'application/*+json']
  }))

  // JSON parse error handler (must be 4-arg)
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => jsonErrorHandler(err, req, res, next))

  // Prefix stripping
  app.use((req, _res, next) => {
    if (!prefix) return next()

    const url = new URL(req.url, 'http://localhost')
    let path = url.pathname

    if (path.startsWith(prefix)) {
      path = path.slice(prefix.length) || '/'
    }

    req.url = path + (url.search || '')
    next()
  })

  app.use('/', routerFactory())

  app.use((_req, res) => {
    return res.status(404).json({ error: 'not_found' })
  })

  // Final catch-all error handler
  // eslint-disable-next-line no-unused-vars
  app.use((_err, _req, res, _next) => {
    return res.status(500).json({ error: 'internal_error' })
  })

  return (req, res) => app(req, res)
}
