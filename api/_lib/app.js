// Mount the Express backend as a serverless function handler
// This exports the Express app for use by api/[...path].js

require('dotenv').config();
const backendApp = require('../../backend/server');

module.exports = backendApp;
