#!/usr/bin/env bash
# Full proof battery for SecureGate / EIP-777G.
# Runs every required command under Node 24, tees raw output to handoff/proofs/*.txt,
# and records exit codes. No summarization — logs are the exact command output.
set -u
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
N24="$ROOT/scripts/with-node24.sh"
OUT="$ROOT/handoff/proofs"
rm -rf "$OUT"; mkdir -p "$OUT"
SUMMARY="$OUT/00-SUMMARY.txt"
: > "$SUMMARY"

run() {  # run <logname> <command...>
  local name="$1"; shift
  local log="$OUT/$name.txt"
  {
    echo "### COMMAND: $*"
    echo "### CWD: $(pwd)"
    echo "### DATE: $(date -u +%FT%TZ)"
    echo "----------------------------------------------------------------"
  } > "$log"
  "$@" >> "$log" 2>&1
  local code=$?
  echo "----------------------------------------------------------------" >> "$log"
  echo "### EXIT: $code" >> "$log"
  printf '%-42s exit=%s\n' "$name" "$code" | tee -a "$SUMMARY"
  return 0
}

echo "===== FOUNDRY / NODE 24 =====" | tee -a "$SUMMARY"
run 01-node-version            "$N24" node -v
run 02-node24-assert           "$N24" node -e 'const m=Number(process.versions.node.split(".")[0]);if(m!==24){console.error("Wrong Node: "+process.version);process.exit(1)}console.log("Node 24 verified: "+process.version)'
run 03-forge-version           "$N24" forge --version
run 04-forge-build-via-ir      "$N24" forge build --via-ir
run 05-forge-test-vvv          "$N24" forge test -vvv
run 06-extract-bytecode        "$N24" node scripts/extract-bytecode.js
run 07-verify-abi-canonical    "$N24" node scripts/verify-abi-canonical.cjs

echo "===== FRONTEND =====" | tee -a "$SUMMARY"
( cd frontend && run 08-frontend-type-check "$N24" npm run type-check )
( cd frontend && run 09-frontend-build      "$N24" npm run build )

echo "===== BACKEND =====" | tee -a "$SUMMARY"
( cd backend && run 10-backend-selftest       "$N24" npm run selftest )
( cd backend && run 11-backend-drift-scan     "$N24" npm run drift:scan )
( cd backend && run 12-backend-verify-artifact "$N24" npm run verify:artifact )

echo "===== VERIFIERS =====" | tee -a "$SUMMARY"
run v01-ui-baseline            "$N24" node scripts/verify-ui-baseline.cjs
run v02-no-drift               "$N24" node scripts/verify-no-drift.cjs
run v03-authgate-session       "$N24" node scripts/verify-authgate-session.cjs
run v04-authgate-sweep         "$N24" node scripts/verify-authgate-sweep.cjs
run v05-authgate-attempt-limits "$N24" node scripts/verify-authgate-attempt-limits.cjs
( cd backend && run v06-device-breadcrumb "$N24" node scripts/verify-device-breadcrumb.cjs )
run v07-authgate-passkey       "$N24" node scripts/verify-authgate-passkey.cjs
run v08-admin-passkey          "$N24" node scripts/verify-admin-passkey.cjs
run v09-2fa-no-limits          "$N24" node scripts/verify-2fa-no-limits.cjs
run v10-recovery-flow-ui       "$N24" node scripts/verify-recovery-flow-ui.cjs
run v11-funding-gas            "$N24" node scripts/verify-funding-gas.cjs
run v12-recovery-cleanup-sweep "$N24" node scripts/verify-recovery-cleanup-sweep.cjs
run v13-blacklist-k3           "$N24" node scripts/verify-blacklist-k3.cjs
run v14-k3-execution-sweep     "$N24" node scripts/verify-k3-execution-sweep.cjs
run v15-k2-intent-builders     "$N24" node scripts/verify-k2-intent-builders.cjs
run v16-wallet-k2-flow         "$N24" node scripts/verify-wallet-k2-flow.cjs
run v17-front-back-wiring      "$N24" node scripts/verify-front-back-wiring.cjs
run v18-thank-you-envelope     "$N24" node scripts/verify-thank-you-envelope.cjs
run v19-contract-obfuscation-layers "$N24" node scripts/verify-contract-obfuscation-layers.cjs
run v20-obfuscation-ci         "$N24" node scripts/verify-obfuscation-ci.cjs
run v21-anti-abuse-downloads   "$N24" node scripts/verify-anti-abuse-downloads.cjs
run v22-placeholder-gates      "$N24" node scripts/verify-placeholder-gates.cjs

echo "===== REPO / GIT PROOF =====" | tee -a "$SUMMARY"
{
  echo "### git rev-parse HEAD";        git rev-parse HEAD
  echo "### git branch --show-current"; git branch --show-current
  echo "### git status --short";        git status --short
  echo "### tracked file count";        git ls-tree -r --name-only HEAD | wc -l
  echo "### required active-root files present:";
  git ls-tree -r --name-only HEAD | grep -E 'contracts/SecureGate.sol|test/SecureGate.t.sol|foundry.toml|script/DeploySecureGate.s.sol|out/SecureGate.sol/SecureGate.json|frontend/src/App.tsx|scripts/with-node24.sh|scripts/verify-abi-canonical.cjs|backend/routes/deploy.js|backend/routes/funding.js'
} > "$OUT/30-git-repo-proof.txt" 2>&1
cat "$OUT/30-git-repo-proof.txt" | sed -n '1,4p' | tee -a "$SUMMARY" >/dev/null

echo "===== RAW DRIFT SCAN =====" | tee -a "$SUMMARY"
bash scripts/drift-scan-raw.sh > "$OUT/40-drift-scan-raw.txt" 2>&1
echo "drift hits: $(wc -l < "$OUT/40-drift-scan-raw.txt")" | tee -a "$SUMMARY"

echo "===== DONE =====" | tee -a "$SUMMARY"
echo "Proof logs in: $OUT"
