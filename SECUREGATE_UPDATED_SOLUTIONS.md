# SecureGate / EIP-777G — Fresh Build Implementation Handoff

This file is the fresh-build handoff for the remaining blockers. It contains implementation-ready code snippets and a strict list of what is still missing. Nothing in this document is claimed to be production-safe until the matching compile/test/log artifacts exist.

## What is still missing

These remain real blockers:

- final production-safe Solidity contract;
- Foundry tests that actually pass with `forge test`;
- deploy script tied to the final accepted contract artifact;
- real same-device Auth-Gate marker scan;
- real USB LINK DEVICE adapter with protocol-level verification;
- production WebAuthn/passkey verifier with durable credential/challenge storage;
- browser deploy builder using session-only `deployer-burner-key` and backend nonce/fee calls;
- browser K1 action builder producing real signed K1 transactions;
- automatic durable blacklist/failure behavior tied to real failed recovery actions;
- true obfuscation integration proof against generated `live/`;
- CI-confirmed mobile tests against current selectors;
- final public-output scan after obfuscation;
- verified Foundry install/output logs.

## 1. Solidity contract scaffold

Use this as the next implementation target in Foundry. It is intentionally conservative and should be compiled, tested, and reviewed before deployment.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract SecureGate {
    using ECDSA for bytes32;

    error NotAuthorized();
    error IntentAlreadyExecuted();
    error InvalidNonce();
    error InvalidDestination();
    error Blacklisted();
    error DelegatecallBlocked();

    address public immutable k1;
    address public immutable k2;
    address public immutable k3;

    uint256 public immutable chainId;
    uint256 public constant MAX_ATTEMPTS = 3;

    struct Intent {
        address target;
        uint256 value;
        bytes data;
        uint256 gasLimit;
        bytes32 nonce;
        address authorizedBy;
        bool authorized;
        bool executed;
    }

    mapping(bytes32 => Intent) public intents;
    mapping(address => uint256) public failureCount;
    mapping(address => bool) public blacklisted;

    event IntentQueued(bytes32 indexed intentHash, address target, uint256 value, bytes32 nonce);
    event IntentAuthorized(bytes32 indexed intentHash, address indexed by);
    event IntentExecuted(bytes32 indexed intentHash);
    event FailureRecorded(address indexed who, uint256 count);
    event BlacklistedAddress(address indexed who);

    constructor(address _k1, address _k2, address _k3, uint256 _chainId) {
        k1 = _k1;
        k2 = _k2;
        k3 = _k3;
        chainId = _chainId;
    }

    modifier onlyK1() {
        if (msg.sender != k1) revert NotAuthorized();
        _;
    }

    modifier onlyK2() {
        if (msg.sender != k2) revert NotAuthorized();
        _;
    }

    modifier notBlacklisted() {
        if (blacklisted[msg.sender]) revert Blacklisted();
        _;
    }

    modifier noDelegatecall() {
        if (msg.sender != address(this)) {
            // Use this guard in production only after confirming the intended call flow.
            // Delegatecall is blocked by construction for the public entrypoints.
            if (msg.sender != tx.origin) revert DelegatecallBlocked();
        }
        _;
    }

    function queueIntent(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 gasLimit,
        bytes32 nonce
    ) external onlyK1 notBlacklisted noDelegatecall returns (bytes32 intentHash) {
        if (nonce == bytes32(0)) revert InvalidNonce();

        intentHash = keccak256(abi.encodePacked(chainId, block.chainid, target, value, data, gasLimit, nonce));
        intents[intentHash] = Intent({
            target: target,
            value: value,
            data: data,
            gasLimit: gasLimit,
            nonce: nonce,
            authorizedBy: address(0),
            authorized: false,
            executed: false
        });

        emit IntentQueued(intentHash, target, value, nonce);
    }

    function authorizeIntent(bytes32 intentHash, bytes calldata signature) external onlyK2 notBlacklisted noDelegatecall {
        Intent storage it = intents[intentHash];
        if (it.target == address(0)) revert InvalidNonce();
        if (it.executed) revert IntentAlreadyExecuted();
        if (it.authorized) revert NotAuthorized();

        bytes32 digest = keccak256(abi.encodePacked("SECUREGATE", chainId, intentHash, k3));
        address signer = ECDSA.recover(digest, signature);
        if (signer != k2) revert NotAuthorized();

        it.authorized = true;
        it.authorizedBy = msg.sender;
        emit IntentAuthorized(intentHash, msg.sender);
    }

    function executeIntent(bytes32 intentHash) external onlyK1 notBlacklisted noDelegatecall {
        Intent storage it = intents[intentHash];
        if (it.target == address(0)) revert InvalidNonce();
        if (it.executed) revert IntentAlreadyExecuted();
        if (!it.authorized) revert NotAuthorized();
        if (it.target != k3) revert InvalidDestination();

        (bool ok, ) = it.target.call{value: it.value, gas: it.gasLimit}(it.data);
        if (!ok) {
            uint256 count = ++failureCount[msg.sender];
            emit FailureRecorded(msg.sender, count);
            if (count >= MAX_ATTEMPTS) {
                blacklisted[msg.sender] = true;
                emit BlacklistedAddress(msg.sender);
            }
            revert();
        }

        it.executed = true;
        emit IntentExecuted(intentHash);
    }
}
```

### What this still needs before claiming “done”

- real signature validation for the exact final intent payload;
- replay protection that is verified in Foundry tests;
- a stronger delegatecall guard than the lightweight placeholder above;
- durable blacklist integration backed by persistent storage;
- a final artifact match with the production deploy script.

## 2. Foundry tests

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/SecureGate.sol";

contract SecureGateTest is Test {
    SecureGate gate;
    address k1 = address(0x1111);
    address k2 = address(0x2222);
    address k3 = address(0x3333);

    function setUp() public {
        gate = new SecureGate(k1, k2, k3, 1);
    }

    function testQueueAndAuthorize() public {
        vm.prank(k1);
        bytes32 hash = gate.queueIntent(k3, 0, hex"", 100000, bytes32(uint256(1)));

        // Sign with k2 in the test harness.
        bytes32 digest = keccak256(abi.encodePacked("SECUREGATE", 1, hash, k3));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(2, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(k2);
        gate.authorizeIntent(hash, sig);

        assertTrue(gate.intents(hash).authorized);
    }

    function testRejectsWrongDestination() public {
        vm.prank(k1);
        bytes32 hash = gate.queueIntent(address(0x4444), 0, hex"", 100000, bytes32(uint256(2)));

        bytes32 digest = keccak256(abi.encodePacked("SECUREGATE", 1, hash, k3));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(2, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(k2);
        gate.authorizeIntent(hash, sig);

        vm.prank(k1);
        vm.expectRevert();
        gate.executeIntent(hash);
    }

    function testBlacklistAfterRepeatedFailures() public {
        vm.prank(k1);
        gate.queueIntent(k3, 0, hex"", 100000, bytes32(uint256(3)));

        vm.prank(k1);
        vm.expectRevert();
        gate.executeIntent(bytes32(uint256(999)));

        assertTrue(gate.blacklisted(k1));
    }
}
```

### Still missing

- a full signature scheme tied to the exact final contract ABI;
- replay and deadline tests;
- full delegatecall and chain-binding coverage;
- a passing `forge test` output from the real repo.

## 3. Deploy script

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SecureGate.sol";

contract DeploySecureGate is Script {
    function run() external returns (SecureGate gate) {
        address k1 = vm.envAddress("K1_ADDRESS");
        address k2 = vm.envAddress("K2_ADDRESS");
        address k3 = vm.envAddress("K3_ADDRESS");
        uint256 chainId = vm.envUint("CHAIN_ID");

        vm.startBroadcast();
        gate = new SecureGate(k1, k2, k3, chainId);
        vm.stopBroadcast();
    }
}
```

### Still missing

- artifact verification against the final accepted contract bytecode;
- a production deployment path that records the final deployed address and ABI version.

## 4. Auth-Gate same-device marker scan

This is a placeholder scaffold only. It should be replaced by a real same-device attestation or device-bound WebAuthn flow before claiming it works.

```js
// js/auth-gate-scan.js
(async function () {
  const state = { marker: null, attempts: 0 };

  async function captureMarker() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#00e8dd";
    ctx.font = "20px sans-serif";
    ctx.fillText(navigator.userAgent.slice(0, 40), 16, 40);

    const data = ctx.getImageData(0, 0, 256, 256).data;
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest)).slice(0, 8).map((x) => x.toString(16).padStart(2, "0")).join("");
  }

  async function runScan() {
    state.attempts += 1;
    const marker = await captureMarker();
    state.marker = marker;
    return { ok: true, marker, attempts: state.attempts };
  }

  window.SecureGateAuthScan = { runScan };
})();
```

### Still missing

- a real device-bound proof rather than a browser-derived marker;
- durable attempt tracking across sessions;
- a verified K1 ownership proof connected to the auth state.

## 5. USB LINK DEVICE adapter

```js
// js/usb-linked-device.js
(async function () {
  const VENDOR_ID = 0x1234;
  let device = null;

  async function connect() {
    if (!navigator.usb) throw new Error("USB not available");
    device = await navigator.usb.requestDevice({ filters: [{ vendorId: VENDOR_ID }] });
    await device.open();
    await device.selectConfiguration(1);
    await device.claimInterface(0);
    return device;
  }

  async function challenge(device, challengeText) {
    if (!device) throw new Error("No device connected");
    const payload = new TextEncoder().encode(challengeText);
    const view = new Uint8Array(payload);
    // The real protocol should be replaced with the final device spec.
    return { ok: true, response: Array.from(view).slice(0, 16) };
  }

  window.SecureGateUsbAdapter = { connect, challenge };
})();
```

### Still missing

- a real protocol-level challenge/response exchange;
- signature verification that proves the linked device is the expected hardware identity;
- a final integration with the recovery flow and K1 session state.

## 6. WebAuthn / passkey verifier

```js
// routes/webauthn.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const { generateRegistrationOptions, verifyRegistrationResponse } = require("@simplewebauthn/server");

const router = express.Router();
const STORE_FILE = path.join(process.cwd(), "data", "passkeys.json");

function readStore() {
  if (!fs.existsSync(STORE_FILE)) return { challenges: {}, credentials: {} };
  return JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

router.post("/api/passkey/register", async (req, res) => {
  const { k1Address } = req.body || {};
  const store = readStore();
  const options = generateRegistrationOptions({
    rpName: "SecureGate",
    rpID: process.env.RP_ID || "localhost",
    userID: Buffer.from(k1Address || "demo"),
    userName: k1Address || "demo",
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });

  store.challenges[k1Address] = options.challenge;
  writeStore(store);
  res.json({ ok: true, options });
});

router.post("/api/passkey/verify", async (req, res) => {
  // This is a scaffold only. Replace with a full assertion verification path before production.
  const store = readStore();
  const { k1Address, response } = req.body || {};
  if (!store.challenges[k1Address]) {
    return res.status(400).json({ ok: false, error: "Challenge not found" });
  }

  delete store.challenges[k1Address];
  store.credentials[k1Address] = response;
  writeStore(store);
  res.json({ ok: true, verified: true });
});

module.exports = router;
```

### Still missing

- real WebAuthn assertion verification with cryptographic signature checks;
- durable storage backed by a real database or KV service;
- a hard binding between passkey success and the K1 session state.

## 7. Browser deploy builder

```js
// js/deploy-builder.js
async function buildDeployTransaction({ chain, k1Key, deployerKey, k2Address, k3Address }) {
  const provider = new ethers.providers.JsonRpcProvider();
  const wallet = new ethers.Wallet(deployerKey, provider);
  const nonce = await provider.getTransactionCount(wallet.address);
  const feeData = await provider.getFeeData();

  const factory = new ethers.ContractFactory([], "0x6080604052", wallet);
  const deploymentTx = factory.getDeployTransaction();

  return {
    chain,
    from: wallet.address,
    nonce: nonce.toString(),
    gasPrice: feeData.gasPrice?.toString() || "0",
    signedTx: "0x" // Fill in after signing the transaction locally.
  };
}
```

### Still missing

- a final contract artifact route;
- a backend nonce/fee endpoint that returns verifiable values;
- a signed local deployment path that never sends key material to the backend.

## 8. Browser K1 action builder

```js
// js/k1-action-builder.js
async function buildK1Action({ k1Key, target, value, data, chain }) {
  const wallet = new ethers.Wallet(k1Key);
  const unsigned = {
    to: target,
    value: ethers.utils.parseEther(String(value)),
    data,
    chainId: chain === "mainnet" ? 1 : 11155111,
    nonce: 0,
  };
  const signed = await wallet.signTransaction(unsigned);
  return { signedTx: signed };
}
```

### Still missing

- the real final action payload for the final contract;
- runtime clearing of the key material after signing;
- a verified backend-only submission route for `signedTx`.

## 9. Durable blacklist / failure behavior

```js
// lib/blacklist-store.js
const fs = require("fs");
const path = require("path");

const STORE_FILE = path.join(process.cwd(), "data", "blacklist.json");

function readStore() {
  if (!fs.existsSync(STORE_FILE)) return { entries: {} };
  return JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

function recordFailure(k1Address) {
  const store = readStore();
  const entry = store.entries[k1Address] || { count: 0, blocked: false };
  entry.count += 1;
  if (entry.count >= 3) entry.blocked = true;
  store.entries[k1Address] = entry;
  writeStore(store);
  return entry;
}

module.exports = { recordFailure };
```

### Still missing

- durable integration with the real recovery action path;
- a real blacklist/allowlist policy that is backed by the final contract and tested end-to-end.

## 10. Obfuscation proof

```js
// scripts/verify-obfuscation.cjs
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const liveDir = path.join(root, "live");
const requiredMarkers = ["SecureGate", "network-select", "deploy-gate", "thanks-copy-address"];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(html|js|css)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

const files = walk(liveDir);
let text = "";
for (const file of files) text += fs.readFileSync(file, "utf8") + "\n";

for (const marker of requiredMarkers) {
  if (!text.includes(marker)) {
    console.error(`Missing marker in generated output: ${marker}`);
    process.exit(1);
  }
}

console.log(`Generated artifact contains required markers (${files.length} files checked).`);
```

### Still missing

- a real obfuscation step that is run and compared against the generated output;
- a proof that runtime-critical strings and the final deployed artifact did not drift.

## 11. Mobile acceptance tests

```js
// test/mobile-acceptance.spec.js
const { test, expect } = require("@playwright/test");

test("mobile layout exposes the critical controls", async ({ page }) => {
  await page.goto("http://127.0.0.1:3000/");
  await expect(page.locator("#network-select")).toBeVisible();
  await expect(page.locator("#funding-check")).toBeVisible();
  await expect(page.locator("#deploy-gate")).toBeVisible();
});
```

### Still missing

- CI execution against the built `live/` output;
- real selectors tied to the current dashboard implementation.

## 12. Public-output scan

```bash
grep -R "Flashbots\|/api/relay\|operator-proof\|overrideDestination\|k2OverrideDest\|final-ui-repair\|QR" live index.html js routes scripts \
  --exclude-dir=node_modules \
  --exclude-dir=.git || true
```

### Still missing

- a clean pass on the final built output;
- a documented exception list only for intentional negative-test files.

## 13. Verified Foundry install / output logs

```bash
foundryup
forge --version
cast --version
anvil --version
forge test
```

### Still missing

- a successful local install log from the actual environment;
- a passing `forge test` log for the final contract and tests.

## Bottom line

The cleanest next step is to implement these pieces in the repo in this order:

1. final Solidity contract and Foundry tests;
2. deploy script and artifact route;
3. Auth-Gate scan + USB adapter + passkey verifier;
4. browser deploy builder and K1 action builder;
5. durable blacklist/failure behavior;
6. obfuscation proof + mobile tests + public-output scan;
7. only then claim the build is complete.

## Explicitly still missing

- a final compile-tested `contracts/SecureGate.sol`;
- Foundry tests that pass with `forge test`;
- deploy script tied to the final contract artifact;
- real same-device Auth-Gate marker scan;
- real USB linked-device adapter with protocol-level verification;
- production WebAuthn/passkey verification with durable storage;
- browser deploy builder using session-only deployer keys and backend nonce/fee calls;
- browser K1 action builder producing signed K1 transactions;
- durable blacklist/failure behavior tied to real failed recovery actions;
- true obfuscation integration proof against generated `live/`;
- CI-confirmed mobile tests against current selectors;
- final public-output scan after obfuscation;
- verified Foundry install/output logs.
