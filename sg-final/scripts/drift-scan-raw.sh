#!/usr/bin/env bash
# drift-scan-raw.sh — the spec's RAW DRIFT SCAN, isolated in its own file so the
# forbidden-token pattern lives only in a recognized drift-scan file (see
# verify-no-drift.cjs ALLOW_FILE). Prints matching lines across active source.
cd "$(dirname "$0")/.."
grep -RIn \
"queueIntent\|forwardERC20\|computeEIP712Digest\|domainSeparator\|operator-proof-input\|submitRevokeBundle\|submit-revoke-bundle\|getOperatorProof\|/api/recovery/execute\|/api/credentials\|/api/revoke\|/api/queue\|/api/authorize\|/api/execute\|OPERATOR_VEIL_PHRASE\|X-Operator-Proof\|Flashbots\|flashbots\|smoke test\|SMOKE TEST\|sweeper bot\|DEPLOYMENT BUNDLE\|overrideDestination\|overrideDest\|k2OverrideDest\|K1_PRIVATE_KEY\|DEPLOYER_PRIVATE_KEY\|K2_PRIVATE_KEY\|K3_PRIVATE_KEY\|TESTNET_K2_PRIVATE_KEY\|SECUREGATE_BYTECODE=\|SECUREGATE_ABI=\|MIN_DELAY\|900" \
contracts test script scripts backend frontend/src docs README.md \
--exclude-dir=node_modules --exclude="bun.lock" --exclude="package-lock.json"
exit 0
