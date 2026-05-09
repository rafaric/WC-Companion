const { spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const localStorageFile = process.env.JEST_LOCALSTORAGE_FILE ?? path.join(os.tmpdir(), 'wc-competition-jest-localstorage');
const existingNodeOptions = process.env.NODE_OPTIONS ? `${process.env.NODE_OPTIONS} ` : '';
const nextEnv = {
  ...process.env,
  NODE_OPTIONS: `${existingNodeOptions}--localstorage-file=${localStorageFile}`,
};

const result = spawnSync('pnpm', ['exec', 'jest', ...process.argv.slice(2)], {
  env: nextEnv,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
