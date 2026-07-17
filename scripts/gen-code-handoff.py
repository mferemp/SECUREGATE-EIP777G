#!/usr/bin/env python3
"""Generate ONE markdown handoff containing the full source of every build file.

Walks the real source tree (excluding deps/build caches/quarantine dirs) and
inlines each file inside a fenced code block, grouped by area, with a table of
contents and a manifest (path + sha256 + line count) at the top.
"""
import hashlib
import os
import sys

REPO = "/workspaces"
OUT = os.path.join(REPO, "SECUREGATE-BUILD-CODE-HANDOFF.md")

# Ordered include roots. Each entry: (area label, dir relative to repo, recurse, allowed exts or None=all-text)
INCLUDE = [
    ("Contracts (Solidity)",        "contracts",            True,  {".sol"}),
    ("Compiled artifact",           "out/SecureGate.sol",   False, {".json"}),
    ("Foundry / build config",      ".",                    False, {".toml"}),
    ("Backend — entry & config",    "backend",              False, {".js", ".json", ".mjs"}),
    ("Backend — routes",            "backend/routes",       False, {".js"}),
    ("Backend — lib",               "backend/lib",          False, {".js"}),
    ("Backend — config",            "backend/config",       False, {".js"}),
    ("Backend — scripts",           "backend/scripts",      True,  {".js", ".cjs"}),
    ("Frontend — app source",       "frontend/src",         True,  {".tsx", ".ts", ".css"}),
    ("Frontend — config",           "frontend",             False, {".ts", ".js", ".json", ".cjs", ".html"}),
    ("Frontend — tests",            "frontend/tests",       True,  {".ts"}),
    ("Verifier & build scripts",    "scripts",              False, {".cjs", ".js", ".py", ".sh"}),
    ("Node / tooling config",       ".",                    False, {".node-version", ".nvmrc", ".npmrc"}),
]

# Never descend into these directory names.
SKIP_DIRS = {"node_modules", ".git", "dist", "cache", ".vite", "restored-original-20260713",
             "restored-original-v1-20260714", "uploads", "outputs", "components", ".vulcan", ".tools"}
# For frontend/src we DO want components (shadcn ui) — handled by a dedicated flag.

EXT_LANG = {
    ".sol": "solidity", ".json": "json", ".toml": "toml", ".js": "javascript",
    ".cjs": "javascript", ".mjs": "javascript", ".ts": "typescript", ".tsx": "tsx",
    ".css": "css", ".html": "html", ".py": "python", ".sh": "bash",
    ".node-version": "text", ".nvmrc": "text", ".npmrc": "ini",
}

def lang_for(name):
    for ext, lang in EXT_LANG.items():
        if name.endswith(ext):
            return lang
    return "text"

def list_files(rel_dir, recurse, exts, allow_components=False):
    root = os.path.join(REPO, rel_dir)
    found = []
    if not os.path.isdir(root):
        return found
    if recurse:
        for dp, dns, fns in os.walk(root):
            dns[:] = [d for d in dns if d not in SKIP_DIRS or (allow_components and d == "components")]
            for fn in fns:
                if exts is None or any(fn.endswith(e) for e in exts):
                    found.append(os.path.join(dp, fn))
    else:
        for fn in sorted(os.listdir(root)):
            p = os.path.join(root, fn)
            if os.path.isfile(p) and (exts is None or any(fn.endswith(e) for e in exts)):
                found.append(p)
    return sorted(set(found))

def anchor(s):
    return "".join(c.lower() if c.isalnum() else "-" for c in s).strip("-")

def main():
    sections = []            # (label, [ (relpath, text, sha, lines) ])
    manifest = []
    seen = set()
    total_bytes = 0
    for label, rel, recurse, exts in INCLUDE:
        allow_comp = (rel == "frontend/src")
        files = list_files(rel, recurse, exts, allow_components=allow_comp)
        entries = []
        for p in files:
            relpath = os.path.relpath(p, REPO)
            if relpath in seen:
                continue
            try:
                with open(p, "rb") as f:
                    raw = f.read()
            except Exception:
                continue
            if b"\x00" in raw:   # skip binary
                continue
            if len(raw) > 400_000:  # skip anything absurdly large
                continue
            seen.add(relpath)
            text = raw.decode("utf-8", "replace")
            sha = hashlib.sha256(raw).hexdigest()
            lines = text.count("\n") + (0 if text.endswith("\n") or not text else 1)
            entries.append((relpath, text, sha, lines))
            manifest.append((relpath, sha, lines, len(raw)))
            total_bytes += len(raw)
        if entries:
            sections.append((label, entries))

    out = []
    w = out.append
    w("# SecureGate / EIP-777G — Full Build Code Handoff\n")
    w("> Single-file handoff. Every source file below is inlined verbatim from the\n"
      "> repository working tree. This is the code itself, not a summary.\n")
    w(f"- Files included: **{len(manifest)}**")
    w(f"- Total source bytes: **{total_bytes:,}**")
    w("- Excluded: `node_modules/`, `.git/`, `dist/`, build caches, quarantine dirs, binaries.")
    w("- **Status:** `No production-ready claim.`\n")

    w("## Table of contents\n")
    for label, entries in sections:
        w(f"- [{label}](#{anchor(label)}) — {len(entries)} file(s)")
    w("- [File manifest (sha256)](#file-manifest-sha256)\n")

    for label, entries in sections:
        w(f"\n## {label}\n")
        for relpath, text, sha, lines in entries:
            lang = lang_for(os.path.basename(relpath))
            w(f"### `{relpath}`\n")
            w(f"<sub>sha256 `{sha}` · {lines} lines</sub>\n")
            fence = "```"
            # bump fence if file contains a triple backtick
            while fence in text:
                fence += "`"
            w(f"{fence}{lang}")
            w(text if text.endswith("\n") else text + "\n")
            w(f"{fence}\n")

    w("\n## File manifest (sha256)\n")
    w("| # | Path | Lines | Bytes | sha256 |")
    w("|---|------|-------|-------|--------|")
    for i, (relpath, sha, lines, nbytes) in enumerate(manifest, 1):
        w(f"| {i} | `{relpath}` | {lines} | {nbytes:,} | `{sha}` |")
    w("\n---\n\nNo production-ready claim.\n")

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    print(f"Wrote {OUT}")
    print(f"files={len(manifest)} bytes={total_bytes}")

if __name__ == "__main__":
    sys.exit(main())
