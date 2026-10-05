#!/usr/bin/env node
/**
 * Fail if any packaged source file starts with a UTF-8 BOM.
 *
 * A BOM is invisible in HTML, but PHP echoes the raw bytes of a required file
 * before any code in it runs. common/foundation/config/services.php is required
 * during Common\CommonServiceProvider::register(), so its BOM was prepended to
 * every HTTP response body. Browsers ignore a BOM on text/html, which is why it
 * went unnoticed, but /api/v1/img-proxy returns Content-Type: image/jpeg and a
 * leading EF BB BF displaces the JPEG SOI marker (FF D8) - no browser can decode
 * the result and every cover image on the site renders broken.
 *
 * Because the deploy rsyncs this source tree over the app, one stray BOM in a
 * committed file silently breaks image delivery again on the next deploy.
 */

import { closeSync, openSync, readdirSync, readSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

const SKIP_DIRS = new Set([
  '.git',
  '.github',
  '.azure',
  'node_modules',
  'vendor',
  'release',
  'storage',
]);

const SKIP_PREFIXES = ['public/build'];

const EXTENSIONS = ['.php', '.blade.php', '.js', '.mjs', '.jsx', '.ts', '.tsx', '.json', '.css'];

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

function hasExtension(name) {
  return EXTENSIONS.some((ext) => name.endsWith(ext));
}

function skipPath(absolute) {
  const rel = relative(ROOT, absolute);
  if (SKIP_PREFIXES.some((prefix) => rel.startsWith(prefix))) {
    return true;
  }
  return rel.split(/[\\/]/).some((segment) => SKIP_DIRS.has(segment));
}

const offenders = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    if (skipPath(absolute)) {
      continue;
    }
    if (entry.isDirectory()) {
      walk(absolute);
      continue;
    }
    if (!entry.isFile() || !hasExtension(entry.name)) {
      continue;
    }
    const stats = statSync(absolute);
    if (stats.size < 3) {
      continue;
    }
    const handle = openSync(absolute, 'r');
    const head = Buffer.alloc(3);
    try {
      readSync(handle, head, 0, 3, 0);
    } finally {
      closeSync(handle);
    }
    if (head.equals(BOM)) {
      offenders.push(relative(ROOT, absolute));
    }
  }
}

walk(ROOT);

if (offenders.length > 0) {
  console.error(`UTF-8 BOM found in ${offenders.length} source file(s):`);
  for (const file of offenders) {
    console.error(`  ${file}`);
  }
  console.error('\nStrip it (drop the first 3 bytes) or the deploy will ship broken images.');
  process.exit(1);
}

console.log('No UTF-8 BOM found in source files.');