'use strict';

// GET /api/artifact/securegate — serve compiled bytecode/ABI to the browser
// deploy builder, but ONLY when the configured artifact validates:
//   * SECUREGATE_BYTECODE_HEX must be present and 0x-hex.
//   * SECUREGATE_ABI_JSON must be valid JSON (an array).
//   * SECUREGATE_ARTIFACT_SHA256, if set, must match sha256(bytecode).
//
// If any check fails, we return 503 with an honest reason. We NEVER inline a
// placeholder artifact or fabricate bytecode.

const express = require('express');
const crypto = require('crypto');

const router = express.Router();

function validateArtifact() {
  const bytecode = (process.env.SECUREGATE_BYTECODE_HEX || '').trim();
  const abiRaw = (process.env.SECUREGATE_ABI_JSON || '').trim();
  const wantSha = (process.env.SECUREGATE_ARTIFACT_SHA256 || '').trim().toLowerCase();
  const version = (process.env.SECUREGATE_ARTIFACT_VERSION || 'securegate@local').trim();

  if (!bytecode) return { ok: false, reason: 'SECUREGATE_BYTECODE_HEX not set' };
  if (!/^0x[0-9a-fA-F]+$/.test(bytecode) || bytecode.length < 4) {
    return { ok: false, reason: 'SECUREGATE_BYTECODE_HEX is not valid hex' };
  }

  let abi;
  try {
    abi = JSON.parse(abiRaw || '[]');
  } catch (_) {
    return { ok: false, reason: 'SECUREGATE_ABI_JSON is not valid JSON' };
  }
  if (!Array.isArray(abi)) return { ok: false, reason: 'SECUREGATE_ABI_JSON must be a JSON array' };

  if (wantSha) {
    const gotSha = crypto.createHash('sha256').update(bytecode, 'utf8').digest('hex');
    if (gotSha !== wantSha) {
      return { ok: false, reason: 'artifact sha256 mismatch' };
    }
  }
  return { ok: true, bytecode, abi, version };
}

router.get('/securegate', (_req, res) => {
  const v = validateArtifact();
  if (!v.ok) {
    return res.status(503).json({ error: 'artifact unavailable', reason: v.reason });
  }
  return res.json({ version: v.version, abi: v.abi, bytecode: v.bytecode });
});

module.exports = router;
