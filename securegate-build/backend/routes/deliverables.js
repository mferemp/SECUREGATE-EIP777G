'use strict';

// GET /api/deliverables            -> human-browsable HTML index (or JSON with ?format=json)
// GET /api/deliverables/file?name= -> download one whitelisted deliverable file
//
// Purpose: the build deliverables (consolidated .md, docs, verifier code, ZIPs,
// compiled artifact) live on the repo filesystem. The user interacts through the
// browser and cannot see the filesystem, so this route surfaces them as clickable
// downloads. It is READ-ONLY and path-traversal guarded: only files under an
// allowlisted set of directories/extensions inside the repo root are served.

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Repo root = two levels up from backend/routes/
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// Directories (relative to repo root) we are willing to expose, with the file
// extensions allowed in each. Nothing else is ever served.
const SOURCES = [
  { dir: '.',              label: 'Root docs',        exts: ['.md'],  recurse: false },
  { dir: 'docs',           label: 'Docs',             exts: ['.md'],  recurse: false },
  { dir: 'outputs/files',  label: 'Records & ZIPs',   exts: ['.md', '.zip'], recurse: false },
  { dir: 'scripts',        label: 'Verifier code',    exts: ['.cjs', '.py', '.sh', '.js'], recurse: false },
  { dir: 'contracts',      label: 'Contract source',  exts: ['.sol'], recurse: false },
  { dir: 'out/SecureGate.sol', label: 'Compiled artifact', exts: ['.json'], recurse: false },
];

function collect() {
  const groups = [];
  for (const src of SOURCES) {
    const abs = path.join(REPO_ROOT, src.dir);
    let entries = [];
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    const files = [];
    for (const e of entries) {
      if (!e.isFile()) continue;
      const ext = path.extname(e.name).toLowerCase();
      if (!src.exts.includes(ext)) continue;
      const rel = path.posix.join(src.dir === '.' ? '' : src.dir, e.name).replace(/^\/+/, '');
      let size = 0;
      try { size = fs.statSync(path.join(abs, e.name)).size; } catch (_) {}
      files.push({ name: e.name, rel, size, ext });
    }
    if (files.length) {
      files.sort((a, b) => a.name.localeCompare(b.name));
      groups.push({ label: src.label, dir: src.dir, files });
    }
  }
  return groups;
}

// Resolve a requested relative path safely to an absolute path inside an allowed
// source dir with an allowed extension. Returns null if anything is off.
function resolveSafe(relRaw) {
  if (typeof relRaw !== 'string' || !relRaw) return null;
  const rel = relRaw.replace(/^\/+/, '');
  if (rel.includes('..') || rel.includes('\0')) return null;
  const abs = path.resolve(REPO_ROOT, rel);
  if (abs !== REPO_ROOT && !abs.startsWith(REPO_ROOT + path.sep)) return null;
  const ext = path.extname(abs).toLowerCase();
  const dir = path.posix.dirname(rel);
  const match = SOURCES.find((s) => {
    const sdir = s.dir === '.' ? '.' : s.dir;
    const rdir = dir === '' ? '.' : dir;
    return sdir === rdir && s.exts.includes(ext);
  });
  if (!match) return null;
  try {
    if (!fs.statSync(abs).isFile()) return null;
  } catch (_) {
    return null;
  }
  return abs;
}

function fmtSize(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

router.get('/', (req, res) => {
  const groups = collect();
  if (req.query.format === 'json') {
    return res.json({ repoRoot: REPO_ROOT, groups });
  }
  const total = groups.reduce((n, g) => n + g.files.length, 0);
  const base = req.baseUrl; // e.g. /api/deliverables  (respects proxy base path)
  const rows = groups.map((g) => {
    const items = g.files.map((f) => {
      const dl = `${base}/file?name=${encodeURIComponent(f.rel)}`;
      return `<li><a href="${esc(dl)}">${esc(f.name)}</a> <span class="s">${fmtSize(f.size)}</span></li>`;
    }).join('\n');
    return `<section><h2>${esc(g.label)} <span class="d">${esc(g.dir)}/</span></h2><ul>${items}</ul></section>`;
  }).join('\n');
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SecureGate — Build Deliverables</title>
<style>
:root{color-scheme:dark}
body{margin:0;background:#0b0f17;color:#e6edf3;font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;padding:2rem}
.wrap{max-width:820px;margin:0 auto}
h1{font-size:1.5rem;margin:0 0 .25rem}
.sub{color:#9aa7b4;margin:0 0 1.5rem;font-size:.9rem}
section{background:#111826;border:1px solid #1f2a3a;border-radius:12px;padding:1rem 1.25rem;margin:0 0 1rem}
h2{font-size:1rem;margin:0 0 .5rem;display:flex;gap:.5rem;align-items:baseline}
h2 .d{color:#5b6b7d;font-weight:400;font-size:.8rem}
ul{list-style:none;margin:0;padding:0}
li{padding:.35rem 0;border-bottom:1px solid #17202e;display:flex;justify-content:space-between;gap:1rem}
li:last-child{border-bottom:0}
a{color:#5eb1ff;text-decoration:none}a:hover{text-decoration:underline}
.s{color:#5b6b7d;font-size:.8rem;white-space:nowrap}
.tip{color:#9aa7b4;font-size:.85rem;margin-top:1.5rem}
code{background:#1a2432;padding:.1rem .35rem;border-radius:4px}
</style></head><body><div class="wrap">
<h1>SecureGate / EIP-777G — Build Deliverables</h1>
<p class="sub">${total} files. Click any name to download. Start with <code>SECUREGATE-EIP777G-DELIVERABLE.md</code> (the consolidated record).</p>
${rows}
<p class="tip">This page is read-only. Files are served straight from the repository.</p>
</div></body></html>`);
});

router.get('/file', (req, res) => {
  const abs = resolveSafe(req.query.name);
  if (!abs) return res.status(404).json({ error: 'not found', reason: 'file is not an allowlisted deliverable' });
  const ext = path.extname(abs).toLowerCase();
  const inline = ext === '.md'; // let markdown render/preview in-browser; zips download
  const types = { '.md': 'text/markdown; charset=utf-8', '.zip': 'application/zip', '.json': 'application/json',
                  '.cjs': 'text/plain; charset=utf-8', '.js': 'text/plain; charset=utf-8',
                  '.py': 'text/plain; charset=utf-8', '.sh': 'text/plain; charset=utf-8', '.sol': 'text/plain; charset=utf-8' };
  res.set('Content-Type', types[ext] || 'application/octet-stream');
  res.set('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${path.basename(abs)}"`);
  fs.createReadStream(abs).pipe(res);
});

module.exports = router;
