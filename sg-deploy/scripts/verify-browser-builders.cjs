#!/usr/bin/env node
'use strict';

// verify-browser-builders.cjs — exercises the REAL browser tx builder against
// the canonical Foundry ABI under Node 24. It imports the actual TypeScript
// module (Node 24 strips types natively) so this proves the shipped code, not a
// re-implementation.
//
// Run:  scripts/with-node24.sh node scripts/verify-browser-builders.cjs

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const BUILDER_TS = path.join(FRONTEND, 'src', 'lib', 'securegateTxBuilder.ts');
const ARTIFACT = path.join(ROOT, 'out', 'SecureGate.sol', 'SecureGate.json');

// ethers resolves from frontend/node_modules (CJS main) for a .cjs require.
const { ethers } = require(path.join(FRONTEND, 'node_modules', 'ethers'));

const results = [];
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => results.push({ name, ok: true }))
    .catch((e) => results.push({ name, ok: false, err: e.message }));
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}
function expectThrow(fn, mustMatch) {
  let threw = null;
  try { fn(); } catch (e) { threw = e; }
  assert(threw, 'expected a throw but none happened');
  if (mustMatch) assert(mustMatch.test(threw.message), `throw message ${JSON.stringify(threw.message)} !~ ${mustMatch}`);
}

(async () => {
  assert(fs.existsSync(ARTIFACT), `missing canonical artifact: ${ARTIFACT}`);
  const artifactJson = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8'));
  const abi = artifactJson.abi;
  const bytecode = artifactJson.bytecode && artifactJson.bytecode.object ? artifactJson.bytecode.object : artifactJson.bytecode;
  assert(Array.isArray(abi) && abi.length > 0, 'artifact ABI missing');
  assert(typeof bytecode === 'string' && bytecode.startsWith('0x'), 'artifact bytecode missing');

  const B = await import(BUILDER_TS);
  const iface = new ethers.Interface(abi);

  const K1 = ethers.getAddress('0x' + '11'.repeat(20));
  const K2 = ethers.getAddress('0x' + '22'.repeat(20));
  const K3 = ethers.getAddress('0x' + '33'.repeat(20));
  const TOKEN = ethers.getAddress('0x' + 'ab'.repeat(20));
  const future = Math.floor(Date.now() / 1000) + 3600;

  // 1. artifact shape validation rejects malformed inputs.
  await check('validateArtifactShape rejects empty bytecode', () => {
    expectThrow(() => B.validateArtifactShape({ bytecode: '', abi }), /bytecode/);
  });
  await check('validateArtifactShape rejects non-hex bytecode', () => {
    expectThrow(() => B.validateArtifactShape({ bytecode: 'not-hex', abi }), /bytecode/);
  });
  await check('validateArtifactShape rejects empty ABI', () => {
    expectThrow(() => B.validateArtifactShape({ bytecode, abi: [] }), /ABI/);
  });
  await check('validateArtifactShape accepts canonical artifact', () => {
    const a = B.validateArtifactShape({ version: 'securegate@test', bytecode, abi });
    assert(a.bytecode === bytecode && a.abi.length === abi.length, 'valid artifact not returned');
  });

  // 2. canonical interface guard.
  await check('assertCanonicalInterface accepts canonical ABI', () => {
    B.assertCanonicalInterface(abi);
  });
  await check('assertCanonicalInterface rejects forbidden old ABI', () => {
    const bad = abi.concat([{ type: 'function', name: 'queueIntent', inputs: [{ type: 'bytes32' }, { type: 'bytes' }], outputs: [], stateMutability: 'nonpayable' }]);
    expectThrow(() => B.assertCanonicalInterface(bad), /forbidden old ABI/);
  });

  // 3. key validation.
  await check('validateKeys rejects zero address', () => {
    expectThrow(() => B.validateKeys(ethers.ZeroAddress, K2, K3), /zero address/);
  });
  await check('validateKeys rejects duplicate keys', () => {
    expectThrow(() => B.validateKeys(K1, K1, K3), /different/);
  });
  await check('validateKeys accepts distinct valid keys', () => {
    const k = B.validateKeys(K1, K2, K3);
    assert(k.k1 === K1 && k.k2 === K2 && k.k3 === K3, 'keys not normalized');
  });

  // 4. deploy data = bytecode ++ encoded constructor args.
  await check('buildDeployData prepends bytecode and encodes (k1,k2,k3)', () => {
    const { data, to } = B.buildDeployData({ version: 'v', bytecode, abi }, { k1: K1, k2: K2, k3: K3 });
    assert(to === null, 'deploy tx must have to:null');
    assert(data.startsWith(bytecode), 'deploy data must start with bytecode');
    const argsHex = '0x' + data.slice(bytecode.length);
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['address', 'address', 'address'], argsHex);
    assert(decoded[0] === K1 && decoded[1] === K2 && decoded[2] === K3, 'constructor args mismatch');
  });

  // 5. canonical K1 action encoders round-trip through the canonical ABI.
  await check('encodeQueueERC20 encodes canonical selector + args', () => {
    const nonce = B.randomNonce32();
    const data = B.encodeQueueERC20(abi, TOKEN, '1000', nonce, future);
    const p = iface.parseTransaction({ data });
    assert(p.name === 'queueERC20', 'wrong method');
    assert(p.args[0] === TOKEN && p.args[1] === 1000n && p.args[2] === nonce && p.args[3] === BigInt(future), 'arg mismatch');
  });
  await check('encodeQueueERC721 encodes canonical selector + args', () => {
    const nonce = B.randomNonce32();
    const data = B.encodeQueueERC721(abi, TOKEN, '7', nonce, future);
    const p = iface.parseTransaction({ data });
    assert(p.name === 'queueERC721' && p.args[1] === 7n, 'erc721 mismatch');
  });
  await check('encodeQueueERC1155 encodes canonical selector + args', () => {
    const nonce = B.randomNonce32();
    const data = B.encodeQueueERC1155(abi, TOKEN, '7', '5', nonce, future);
    const p = iface.parseTransaction({ data });
    assert(p.name === 'queueERC1155' && p.args[1] === 7n && p.args[2] === 5n, 'erc1155 mismatch');
  });
  await check('encodeAuthorizeIntent + encodeExecuteIntent encode canonical selectors', () => {
    const ih = '0x' + '9'.repeat(64);
    const sig = '0x' + '0'.repeat(130);
    assert(iface.parseTransaction({ data: B.encodeAuthorizeIntent(abi, ih, sig) }).name === 'authorizeIntent', 'authorize mismatch');
    assert(iface.parseTransaction({ data: B.encodeExecuteIntent(abi, ih) }).name === 'executeIntent', 'execute mismatch');
  });
  await check('encoders reject non-future deadline', () => {
    expectThrow(() => B.encodeQueueERC20(abi, TOKEN, '1', B.randomNonce32(), 1), /future/);
  });

  // 6. builder source contains no forbidden old ABI method names as call sites.
  await check('builder source has no forbidden ABI call sites', () => {
    const src = fs.readFileSync(BUILDER_TS, 'utf8');
    for (const bad of ['queueIntent', 'forwardERC20', 'computeEIP712Digest', 'domainSeparator']) {
      const callSite = new RegExp(`encodeFunctionData\\(['"]${bad}['"]`);
      assert(!callSite.test(src), `forbidden call site for ${bad}`);
    }
  });

  // 7. broadcast body carries signedTx ONLY; key material is refused.
  await check('buildBroadcastBody returns signedTx only', () => {
    const body = B.buildBroadcastBody('0x' + 'a'.repeat(200));
    assert(Object.keys(body).length === 1 && 'signedTx' in body, 'body must contain only signedTx');
  });
  await check('buildBroadcastBody rejects short/empty signedTx', () => {
    expectThrow(() => B.buildBroadcastBody('0x00'), /signed transaction/);
  });
  await check('assertNoKeyMaterial rejects key-shaped fields', () => {
    for (const f of ['privateKey', 'k1Key', 'deployerKey', 'mnemonic', 'seed', 'k1SessionKey']) {
      expectThrow(() => B.assertNoKeyMaterial({ [f]: 'x' }), /key-shaped/);
    }
    B.assertNoKeyMaterial({ signedTx: '0x' + 'a'.repeat(200) }); // must NOT throw
  });

  // ---- report -------------------------------------------------------------
  let failed = 0;
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + r.err}`);
    if (!r.ok) failed += 1;
  }
  console.log(`\nverify-browser-builders: ${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('verifier crashed:', e && e.stack ? e.stack : e);
  process.exit(1);
});
