import { unlinkSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const files = [
  join(root, 'packages/core/tsconfig.tsbuildinfo'),
  join(root, 'packages/bots/cesta-topk/tsconfig.tsbuildinfo'),
  join(root, 'packages/bots/liquidity-maker/tsconfig.tsbuildinfo'),
  join(root, 'packages/bots/endgame-carry/tsconfig.tsbuildinfo'),
  join(root, 'packages/bots/espejo-smart/tsconfig.tsbuildinfo'),
  join(root, 'packages/dashboard/api/tsconfig.tsbuildinfo'),
];

for (const file of files) {
  if (existsSync(file)) {
    unlinkSync(file);
    console.log('removed', file);
  }
}
