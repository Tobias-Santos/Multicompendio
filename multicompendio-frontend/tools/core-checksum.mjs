// Garante que os núcleos compartilhados (src/layoutCore e src/calcCore) são idênticos no back-end e no front-end.
// Uso:  node tools/core-checksum.mjs          confere cada pasta com o seu CHECKSUM.txt
//       node tools/core-checksum.mjs --write  recalcula os CHECKSUM.txt (depois de mexer em um núcleo; copie a pasta para o outro projeto)
// O fim de linha (Windows ou Linux) não conta.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const CORES = [['layoutCore', 'do layout'], ['calcCore', 'do cálculo']];
let failed = false;
for (const [name, label] of CORES) {
  const dir = new URL(`../src/${name}/`, import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).sort();
  const hash = createHash('sha256');
  for (const f of files) {
    hash.update(`${f}\n`);
    hash.update(readFileSync(new URL(f, dir), 'utf8').replace(/\r\n/g, '\n'));
  }
  const sum = hash.digest('hex');
  const text = `sha256 ${sum}\n${files.join('\n')}\n`;
  if (process.argv.includes('--write')) {
    writeFileSync(new URL('CHECKSUM.txt', dir), text);
    console.log(`CHECKSUM.txt (${name}) atualizado:`, sum.slice(0, 12));
  } else {
    let saved = '';
    try { saved = readFileSync(new URL('CHECKSUM.txt', dir), 'utf8').replace(/\r\n/g, '\n'); } catch { /* sem arquivo */ }
    if (saved !== text) {
      console.error(`O núcleo ${label} (src/${name}) não bate com o CHECKSUM.txt.`);
      console.error(`Se a mudança foi de propósito: rode "node tools/core-checksum.mjs --write" e copie a pasta src/${name} inteira para o outro projeto (back-end e front-end).`);
      failed = true;
    } else console.log(`núcleo ${label} íntegro:`, sum.slice(0, 12));
  }
}
if (failed) process.exit(1);
