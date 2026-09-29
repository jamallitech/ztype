import { spawn } from 'node:child_process';

const children = [];
let stopping = false;
function stop(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill(signal);
}
function start(args, env = process.env) {
  const child = spawn('npm', ['run', ...args], { env, stdio: 'inherit' });
  children.push(child);
  child.on('error', (error) => {
    console.error(error.message);
    stop();
    process.exitCode = 1;
  });
  child.on('exit', (code) => {
    if (!stopping) {
      process.exitCode = code ?? 1;
      stop();
    }
  });
  return child;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(signal));
start(['emulators']);
console.log('Waiting for local Firebase emulators…');
let ready = false;
for (let attempt = 0; attempt < 180 && !stopping; attempt++) {
  try {
    const hub = await fetch('http://127.0.0.1:4400/emulators', {
      signal: AbortSignal.timeout(1000),
    });
    const services = await hub.json();
    if (services.auth && services.firestore) {
      ready = true;
      break;
    }
  } catch {
    /* First boot may download the emulator. */
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (ready && !stopping) {
  start(['dev'], {
    ...process.env,
    GOOGLE_CLOUD_PROJECT: 'demo-ztype',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    VITE_USE_EMULATORS: 'true',
    VITE_FIREBASE_PROJECT_ID: 'demo-ztype',
    VITE_FIREBASE_API_KEY: 'demo-key',
    VITE_FIREBASE_AUTH_DOMAIN: 'demo-ztype.firebaseapp.com',
    VITE_FIREBASE_APP_ID: 'demo-app',
  });
} else if (!stopping) {
  console.error(
    'The emulators did not start. Java 21+ is required. Run npm run emulators for details.',
  );
  stop();
  process.exitCode = 1;
}
