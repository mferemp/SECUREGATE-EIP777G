'use strict';

// Address guard — the conceptual enforcement of the K3 forced-destination rule.
//
// Canonical invariants:
//   * K3 is the immutable forced recovery destination.
//   * Any attempted destination that is NOT K3 is captured as "suspect".
//   * forcedDestination ALWAYS remains K3.
//   * No alternate destination is EVER returned as an effective route.
//
// This module never signs, never broadcasts, and never routes value. It only
// classifies a requested destination and reports the forced route so callers
// cannot accidentally honor an override.

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

function isAddress(a) {
  return typeof a === 'string' && ADDR_RE.test(a.trim());
}

function normalize(a) {
  return isAddress(a) ? a.trim().toLowerCase() : null;
}

/**
 * Evaluate a requested destination against the immutable K3.
 * @param {string} k3 immutable forced destination (public address)
 * @param {string} requestedDestination the destination a caller attempted
 * @returns {{
 *   forcedDestination: string,   // ALWAYS K3
 *   effectiveDestination: string,// ALWAYS K3 (never the requested override)
 *   suspect: boolean,            // true when requested !== K3
 *   suspectDestination: string|null
 * }}
 */
function enforceK3(k3, requestedDestination) {
  const k3n = normalize(k3);
  if (!k3n) {
    const e = new Error('K3 forced destination is not a valid address');
    e.code = 'INVALID_K3';
    throw e;
  }
  const reqN = normalize(requestedDestination);
  const suspect = reqN !== null && reqN !== k3n;

  // The effective route is unconditionally K3. A non-K3 request is recorded as
  // suspect but is never returned as a usable destination.
  return {
    forcedDestination: k3n,
    effectiveDestination: k3n,
    suspect,
    suspectDestination: suspect ? reqN : null,
  };
}

// Reject any object that tries to smuggle an alternate destination override.
const FORBIDDEN_OVERRIDE_KEYS = ['overrideDestination', 'overrideDest', 'k2OverrideDest'];

function hasForbiddenOverride(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return FORBIDDEN_OVERRIDE_KEYS.some((k) =>
    Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null && obj[k] !== '');
}

module.exports = {
  isAddress,
  normalize,
  enforceK3,
  hasForbiddenOverride,
  FORBIDDEN_OVERRIDE_KEYS,
};
