'use strict';
module.exports = (_req, res) => {
  res.setHeader('Content-Type','application/json');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify({ ok: true, service: 'securegate-eip777g', ts: Date.now() }));
};
