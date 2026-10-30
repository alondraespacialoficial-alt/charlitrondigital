import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

// Vercel transpila cada función por archivo y Node ESM no resuelve imports relativos sin extensión.
test('Vercel functions do not import local modules', () => {
  const dir = new URL('.', import.meta.url);
  const files = readdirSync(dir).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));
  assert.ok(files.length > 0);
  for (const name of files) {
    const source = readFileSync(new URL(name, dir), 'utf8');
    assert.doesNotMatch(source, /from\s+['"]\.{1,2}\//, `${name} importa un módulo local`);
  }
});
