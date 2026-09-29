import { spawn } from 'node:child_process';
import { delimiter, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const env = { ...process.env };
// Editor DEBUG flags should not enable Firebase's verbose environment logging.
if (!process.argv.includes('--debug')) delete env.DEBUG;
if (env.ZTYPE_JAVA_HOME) {
  env.JAVA_HOME = resolve(env.ZTYPE_JAVA_HOME);
  env.PATH = `${resolve(env.JAVA_HOME, 'bin')}${delimiter}${env.PATH}`;
}
const child = spawn(
  process.execPath,
  [
    'node_modules/firebase-tools/lib/bin/firebase.js',
    ...process.argv
      .slice(2)
      .filter((arg) => !arg.startsWith('--import=') || existsSync(arg.slice('--import='.length))),
  ],
  { env, stdio: 'inherit' },
);
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
