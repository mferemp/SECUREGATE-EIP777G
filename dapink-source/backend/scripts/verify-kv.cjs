#!/usr/bin/env node
'use strict';

// verify-kv.cjs — proves the durable-first KV facade: set/get/delete, TTL,
// namespace isolation, honest non-production labeling of the memory fallback,
// and that no secrets are logged. Deterministic (uses the memory backend).
//
// Run: cd backend && ../scripts/with-node24.sh node scripts/verify-kv.cjs

const path = require('path');
const kvmod = require(path.join(__dirname, '..', 'lib', 'kv.js'));

let passed = 0, failed = 0;
function pass(m) { passed++; console.log('PASS ' + m); }
function fail(m, d) { failed++; console.log('FAIL ' + m + (d ? ' :: ' + d : '')); }
function assert(cond, m, d) { if (cond) pass(m); else fail(m, d); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  kvmod._resetForTests(true); // deterministic memory backend

  const a = kvmod.createKv('e2e');
  const b = kvmod.createKv('other');

  // 1. set/get.
  await a.set('k1', { hello: 'world' });
  const got = await a.get('k1');
  assert(got && got.hello === 'world', 'set/get round-trips a value');

  // 2. delete.
  await a.delete('k1');
  assert((await a.get('k1')) === null, 'delete removes the value');

  // 3. namespace isolation — same key, different namespace, no collision.
  await a.set('shared', 'A');
  await b.set('shared', 'B');
  assert((await a.get('shared')) === 'A' && (await b.get('shared')) === 'B',
    'namespaces isolate identical keys');
  assert(kvmod.nsKey('e2e', 'shared') !== kvmod.nsKey('other', 'shared'),
    'namespaced key strings differ');

  // 4. TTL expiry.
  await a.set('temp', 'x', { ttlSec: 1 });
  assert((await a.get('temp')) === 'x', 'value present before TTL');
  const ttl = await a.ttl('temp');
  assert(ttl === 1 || ttl === 0, 'ttl() reports remaining seconds', String(ttl));
  await sleep(1100);
  assert((await a.get('temp')) === null, 'value expires after TTL');
  assert((await a.ttl('temp')) === -2, 'ttl() reports -2 for missing key');

  // 5. incr with window (anti-abuse style).
  const n1 = await a.incr('count', { ttlSec: 5 });
  const n2 = await a.incr('count', { ttlSec: 5 });
  assert(n1 === 1 && n2 === 2, 'incr counts within a window');

  // 6. memory fallback labels itself NON-production-durable.
  const desc = kvmod.describe();
  assert(desc.backend === 'memory' && desc.durable === false && /NOT production durable/i.test(desc.note),
    'memory fallback is labeled non-production durable', JSON.stringify(desc));
  assert(kvmod.isDurable() === false, 'isDurable() is false without a durable backend');

  // 7. durable backend used ONLY if env configured (not in this env).
  const durableEnv = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  assert(!durableEnv ? desc.durable === false : true,
    'durable backend engaged only when KV env configured');

  // 8. no secrets logged: the facade never prints token/url. Assert source has no
  //    console.* of the token/url env values.
  const fs = require('fs');
  for (const f of ['kv.js', 'kv-redis.js', 'kv-memory.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'lib', f), 'utf8');
    assert(!/console\.[a-z]+\([^)]*KV_REST_API_(URL|TOKEN)/.test(src), `no secret logging in ${f}`);
  }

  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(1); });
