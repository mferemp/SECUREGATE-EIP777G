'use strict';

// Privacy-preserving trace keys.
//
// We never store raw fingerprints, raw K1 values, private keys, seed phrases, or
// raw markers. Instead every rate-limit subject is reduced to an opaque, salted
// HMAC digest ("trace key"). The pepper (ABUSE_TRACE_PEPPER) lives only in backend
// env, so digests cannot be reversed or correlated without it.

const crypto = require('crypto');

function pepper() {
  // A missing pepper must not silently weaken privacy: fall back to a per-process
  // random value so digests are still non-reversible (they just won't persist
  // across restarts, which is acceptable for abuse throttling).
  return process.env.ABUSE_TRACE_PEPPER || ProcessSalt.value;
}

const ProcessSalt = { value: crypto.randomBytes(32).toString('hex') };

// Reduce any subject material to an opaque trace key. `parts` may include a K1
// address, a coarse marker, a bucket name, etc. — none of it is stored raw.
function traceKey(...parts) {
  const material = parts
    .filter((p) => p != null && p !== '')
    .map((p) => String(p))
    .join('|');
  return crypto
    .createHmac('sha256', pepper())
    .update('sg-trace:' + material)
    .digest('hex')
    .slice(0, 32);
}

// Convenience: derive a trace key for a (bucket, subject) pair.
function bucketKey(bucket, subject) {
  return traceKey(bucket, subject || 'anon');
}

module.exports = { traceKey, bucketKey };
