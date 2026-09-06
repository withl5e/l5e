#!/usr/bin/env node
/**
 * Bump the L5E release version across every package.json the release
 * workflow validates against.
 *
 * Usage
 *   pnpm bump <version>          exact version, e.g. 0.1.2-alpha.0
 *   pnpm bump prerelease         bump the prerelease counter
 *                                  0.1.1-alpha.2 → 0.1.1-alpha.3
 *                                  0.1.1         → 0.1.2-alpha.0 (start alpha)
 *   pnpm bump patch              0.1.1 → 0.1.2 (strips prerelease)
 *   pnpm bump minor              0.1.1 → 0.2.0
 *   pnpm bump major              0.1.1 → 1.0.0
 *   pnpm bump alpha|beta|rc      change prerelease label, reset counter to 0
 *
 * Touches 5 files:
 *   - 3 publishable packages: their `version` field
 *   - richtext-payload: its `@withl5e/l5e` peer dependency pin
 *   - 2 create-l5e templates: their `@withl5e/l5e` dependency pin (^<new>)
 *
 * Source of truth for the current version is packages/core/package.json.
 * The script fails fast if any of the three publishable packages disagrees
 * on the starting version, so you can't run the bump on top of a partial
 * earlier bump.
 *
 * The script does NOT commit or tag — that's left to you so you can
 * eyeball the diff first:
 *
 *   git add packages/ && git commit -m "chore: bump to <new>" && git push
 *   git tag v<new> && git push origin v<new>
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

const PACKAGE_FILES = [
  'packages/core/package.json',
  'packages/richtext-payload/package.json',
  'packages/create-l5e/package.json',
];

const TEMPLATE_FILES = [
  'packages/create-l5e/templates/basic/package.json',
  'packages/create-l5e/templates/minimal/package.json',
];

const RICHTEXT_PACKAGE = 'packages/richtext-payload/package.json';

const FRAMEWORK_DEP = '@withl5e/l5e';

// ─── semver helpers ──────────────────────────────────────────────────

const SEMVER_RE =
  /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;

function parseSemver(v) {
  const m = SEMVER_RE.exec(v);
  if (!m) throw new Error(`Not a valid semver: ${v}`);
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] || null,
    build: m[5] || null,
  };
}

function formatSemver({ major, minor, patch, prerelease, build }) {
  let s = `${major}.${minor}.${patch}`;
  if (prerelease) s += `-${prerelease}`;
  if (build) s += `+${build}`;
  return s;
}

function bumpKeyword(current, kw) {
  const cur = parseSemver(current);
  switch (kw) {
    case 'patch':
      return formatSemver({ ...cur, patch: cur.patch + 1, prerelease: null, build: null });
    case 'minor':
      return formatSemver({
        major: cur.major,
        minor: cur.minor + 1,
        patch: 0,
        prerelease: null,
      });
    case 'major':
      return formatSemver({
        major: cur.major + 1,
        minor: 0,
        patch: 0,
        prerelease: null,
      });
    case 'alpha':
    case 'beta':
    case 'rc': {
      // change/start a prerelease label, counter resets to 0
      const base = cur.prerelease ? cur : { ...cur, patch: cur.patch + 1 };
      return formatSemver({ ...base, prerelease: `${kw}.0`, build: null });
    }
    case 'prerelease': {
      if (!cur.prerelease) {
        // no prerelease: start an alpha cycle on the next patch
        return formatSemver({ ...cur, patch: cur.patch + 1, prerelease: 'alpha.0' });
      }
      // bump the last numeric segment of the prerelease tail
      const parts = cur.prerelease.split('.');
      const lastIdx = parts.length - 1;
      const last = Number(parts[lastIdx]);
      if (Number.isFinite(last)) {
        parts[lastIdx] = String(last + 1);
      } else {
        parts.push('0');
      }
      return formatSemver({ ...cur, prerelease: parts.join('.') });
    }
    default:
      throw new Error(`Unknown bump keyword: ${kw}`);
  }
}

// ─── file io ─────────────────────────────────────────────────────────

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, rel), 'utf8'));
}

function writeJson(rel, data) {
  fs.writeFileSync(
    path.join(repoRoot, rel),
    JSON.stringify(data, null, 2) + '\n',
  );
}

// ─── main ────────────────────────────────────────────────────────────

const KEYWORDS = new Set(['prerelease', 'patch', 'minor', 'major', 'alpha', 'beta', 'rc']);

function usageAndExit(code = 1) {
  console.error(`
Usage: pnpm bump <version|keyword>

  Exact version:  pnpm bump 0.1.2-alpha.0
  Keywords:       pnpm bump ${[...KEYWORDS].join(' | ')}
`);
  process.exit(code);
}

const arg = process.argv[2];
if (!arg) usageAndExit();

const currentVersions = PACKAGE_FILES.map((p) => ({
  path: p,
  version: readJson(p).version,
}));

const currentOfCore = currentVersions[0].version;
const mismatched = currentVersions.filter((c) => c.version !== currentOfCore);

let nextVersion;
if (KEYWORDS.has(arg)) {
  // Keyword form needs a consistent starting point — can't compute "next
  // prerelease" off three different bases.
  if (mismatched.length > 0) {
    console.error(
      '❌ Cannot use a keyword bump while publishable packages disagree:',
    );
    for (const c of currentVersions) console.error(`     ${c.path} → ${c.version}`);
    console.error(
      '\nFix by passing an explicit version to sync them, e.g.:\n' +
        `     pnpm bump ${currentOfCore}\n`,
    );
    process.exit(1);
  }
  nextVersion = bumpKeyword(currentOfCore, arg);
} else {
  // Exact version — happy to set all packages to it, even when they
  // currently disagree (this is the way to resync).
  try {
    parseSemver(arg);
    nextVersion = arg;
  } catch (err) {
    console.error(`❌ ${err.message}`);
    usageAndExit();
  }
  if (mismatched.length > 0) {
    console.log('⚠  Resyncing out-of-sync publishable packages:');
    for (const c of currentVersions) console.log(`     ${c.path} → ${c.version}`);
    console.log('');
  }
}

const nextPin = `^${nextVersion}`;

// Only short-circuit when versions and internal dependency pins are all current.
const allAtTarget =
  currentVersions.every((c) => c.version === nextVersion) &&
  readJson(RICHTEXT_PACKAGE).peerDependencies?.[FRAMEWORK_DEP] === nextPin &&
  TEMPLATE_FILES.every(
    (rel) => readJson(rel).dependencies?.[FRAMEWORK_DEP] === nextPin,
  );
if (allAtTarget) {
  console.error(`❌ Nothing to do — all packages are already at ${nextVersion}`);
  process.exit(1);
}

console.log(`Setting all packages → ${nextVersion}\n`);

// Apply to publishable packages' `version`
for (const rel of PACKAGE_FILES) {
  const j = readJson(rel);
  const before = j.version;
  j.version = nextVersion;
  writeJson(rel, j);
  console.log(`  version  ${rel}  ${before} → ${nextVersion}`);
}

// Keep the published richtext adapter compatible with this release line.
{
  const j = readJson(RICHTEXT_PACKAGE);
  const before = j.peerDependencies?.[FRAMEWORK_DEP];
  if (!j.peerDependencies) j.peerDependencies = {};
  j.peerDependencies[FRAMEWORK_DEP] = nextPin;
  writeJson(RICHTEXT_PACKAGE, j);
  console.log(`  peer     ${RICHTEXT_PACKAGE}  ${before} → ${nextPin}`);
}

// Apply to template dependency pins (^<next>)
for (const rel of TEMPLATE_FILES) {
  const j = readJson(rel);
  if (!j.dependencies || !j.dependencies[FRAMEWORK_DEP]) {
    console.warn(`  (skip)   ${rel}  no ${FRAMEWORK_DEP} dep`);
    continue;
  }
  const before = j.dependencies[FRAMEWORK_DEP];
  j.dependencies[FRAMEWORK_DEP] = nextPin;
  writeJson(rel, j);
  console.log(`  pin      ${rel}  ${before} → ${nextPin}`);
}

console.log(`
Next steps:

  pnpm install --frozen-lockfile=false       # refresh lockfile
  git add packages/ pnpm-lock.yaml
  git commit -m "chore: bump to ${nextVersion}"
  git push
  git tag v${nextVersion}
  git push origin v${nextVersion}
`);
