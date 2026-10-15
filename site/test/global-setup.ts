import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

// Tests always run on the fixture marketplace, never on the repository's own
// plugins, so results do not change when plugins are added.
export default function setup() {
  const site = resolve(import.meta.dirname, '..');
  execFileSync(process.execPath, ['scripts/build-catalog.mjs', ...FIXTURE_ARGS], { cwd: site, stdio: ['ignore', 'ignore', 'inherit'] });
}

export const FIXTURE_ARGS = [
  '--root', 'test/fixtures',
  '--sample',
  '--history', 'test/fixtures/history.json',
  '--repo', 'humen-dev/dev-digest-ai-marketplace',
  '--out', 'src/generated/catalog.fixtures.json',
];
