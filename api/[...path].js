// Serverless catch-all handler for all /api/* routes
// Routes all requests to the mounted Express backend

const app = require('./_lib/app');

module.exports = function handler(req, res) {
  // Express expects the path without /api prefix, but Vercel passes full path
  // The Express backend is already mounted with routes like /chains, /deploy, etc.
  // This handler will invoke the Express app directly
  return app(req, res);
};
