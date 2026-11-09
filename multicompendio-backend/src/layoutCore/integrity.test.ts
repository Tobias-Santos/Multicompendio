import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('integridade do núcleo do layout', () => {
  it('a pasta src/layoutCore bate com o CHECKSUM.txt (as cópias do back-end e do front-end são idênticas)', () => {
    const out = execFileSync('node', [path.join(__dirname, '..', '..', 'tools', 'core-checksum.mjs')], { encoding: 'utf8' });
    assert.match(out, /íntegro/);
  });
});
