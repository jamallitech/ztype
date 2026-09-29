# Ztype

A quiet space to get better at typing. React + Three.js in the browser, Express on the server, and Firebase Authentication + Firestore for optional accounts. No SendGrid or paid email provider is needed.

## Run locally

Requirements: Node **22.12+**, npm, and **Java 21+** for the Firebase emulators.

```sh
npm ci
npm run dev:local
```

- App: <http://127.0.0.1:5173>
- API: <http://127.0.0.1:3001/api/health>
- Firebase emulator dashboard: <http://127.0.0.1:4000>

`dev:local` starts Authentication and Firestore emulators, waits for them to be ready, then starts the web app and API against the **demo-ztype** project. It never needs cloud credentials or sends real emails. The first run downloads Firebase emulator binaries. Local emulator data is imported from `.firebase/local-data` and exported there on a clean Ctrl+C shutdown.

For guest practice without Java, Firebase, or account setup:

```sh
npm run dev
```

Guest history uses browser IndexedDB. The latest 100 results are retained, plus aggregate lifetime progress. Account uploads remain queued until acknowledged; queued results are never evicted by the history cap. Browser storage failures are shown explicitly, with an in-memory fallback for the current visit.

### Local Java override

If your system Java is older, point the launcher at an existing Java 21+ runtime in a root `.env.local` file:

```dotenv
ZTYPE_JAVA_HOME=/absolute/path/to/java-21-home
```

The launcher passes this Java path only to its child processes; it does not change your system Java. During initial setup on this computer, a runtime was placed at `.cache/java21/Contents/Home`, and the ignored root `.env.local` points to it. This cache is machine-specific and is not committed.

### Try email verification

1. Create an account with any test email and a password of at least eight characters.
2. The Authentication emulator prints the verification URL in the terminal. Open that URL; no real email is sent.
3. Return to Ztype, open **Verify email**, and choose **I’ve verified my email**.
4. Open **Progress** to import guest results. Importing requires an explicit click and preserves stable result IDs across retries.
5. The emulator dashboard shows the account and its Firestore documents. A second account sees only its own data.

Password-reset links are also printed by the emulator. The app supports a custom `/auth/action` handler for verification and reset links; its automated account tests use that handler.

## Features

- 15 / 30 / 60 / 120 second tests and 10 / 25 / 50 / 100 word tests.
- Eight QWERTY lessons, finger-placement guidance, and a keyboard diagram. Mastery requires at least 95% unrounded accuracy.
- WPM, accuracy, mistakes, history, configuration filters, progress charts, and three milestone badges.
- Procedural Three.js ship and ringed planet with atmospheric lighting, a floating practice console, dimensional lesson cards, optional synthesized audio, and a quiet Focus mode.
- Automatic 2D fallback for unavailable WebGL or lost contexts; lightweight static space artwork on phones. Reduced-motion preferences default to Focus on first visit.
- Email/password sign-up, verification, reset, per-account caches, offline upload retries, and deduplicated guest imports.
- Responsive navigation and progress browsing. Typing practice targets physical keyboards; mobile autocorrect and touch-keyboard scoring are not supported in this release.
- English UI copy lives in `apps/web/src/i18n/en.json`. Versioned practice content, language metadata, and grapheme-aware scoring live separately in `packages/core`.

## Workspace

| Directory        | Responsibility                                                                         |
| ---------------- | -------------------------------------------------------------------------------------- |
| `apps/web`       | React interface, IndexedDB storage, Firebase client authentication, Three.js and audio |
| `apps/api`       | Express API, identity verification, input validation, Firestore transactions           |
| `packages/core`  | Shared types, schemas, deterministic prompts, scoring, progress and lessons            |
| `tests/browser`  | Guest browser flows and accessibility/failure scenarios                                |
| `tests/accounts` | Browser account journeys backed by real local Firebase emulators                       |

The scoring engine is independent of the rendering loop. No network request is made for a keystroke. Timing starts with the first character, uses a monotonic clock, and continues after tab blur. WPM is retained, correctly positioned graphemes divided by five and elapsed minutes. Accuracy measures correct insertion events over all insertion events, so backspacing a mistake does not erase its accuracy cost. Historical results retain their content and scoring versions.

The first release ships English only. Additional language packs must provide direction, layout, word segmentation, lesson content, and a content version. Do not assume that a UTF-16 code unit is a character, that every language uses spaces, or that different languages produce comparable WPM. Composition input is supported by the engine boundary; each future language still needs native-speaker and keyboard testing.

## Validation

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
npm run test:emulators
```

`test:emulators` runs real Authentication/Firestore integration tests and account browser tests against a disposable demo project. Stop `dev:local` first so emulator ports are free. These tests include verified identity enforcement, denial of direct Firestore access, concurrent import deduplication, pagination, guest conversion, cross-account isolation, password reset, and reconnect retries. The CI workflow runs all checks with Java 21.

Browser regression tests complete three consecutive attempts in lessons, word tests, and timed tests, checking every result and the persisted history. They also cover changing configurations after completion, restarting an unfinished attempt, and losing a graphics context during typing. Each attempt owns its engine and result state so restarting cannot reuse a previous completion marker.

`npm run test:visual`, while the app is running on port 5173, saves desktop/mobile screenshots and a browser performance sample in `test-results/visual`. It uses installed Chrome when available. These measurements are local samples, not a guarantee for every GPU, browser, or device. Edge and a physical tablet keyboard still need a release smoke test; Playwright WebKit is an engine test rather than the installed Safari application.

## API

Every endpoint below requires `Authorization: Bearer <Firebase ID token>` and a verified email. The user ID comes only from the verified token. Private responses use `Cache-Control: private, no-store`.

| Endpoint                   | Behavior                                                         |
| -------------------------- | ---------------------------------------------------------------- |
| `GET /api/me`              | Profile and preferences                                          |
| `PATCH /api/me`            | Update display name and/or complete preferences object           |
| `POST /api/results`        | Validate and persist one completed attempt                       |
| `GET /api/results`         | History, optional `config` filter, `limit` 1–50, opaque `cursor` |
| `POST /api/results/import` | Idempotent import of 1–20 attempt summaries                      |
| `GET /api/progress`        | Personal bests, totals, mastered lessons, badges                 |
| `GET /api/health`          | Public process health                                            |

Result payloads are defined by `attemptSchema` in the shared package. Submit the counters and metadata, excluding derived `wpm`, `accuracy`, and `mistakes`; Express recalculates those values. For example, a configuration filter is `en:time:30`. Server transactions atomically save new attempts and update progress. Reusing an attempt ID returns success without awarding progress twice. These are private practice results, not verified competitive scores.

## Cloud deployment, when you are ready

No live Firebase project, billing account, or production deployment is configured by this implementation. Local emulator setup is the default development path.

1. Create a Firebase project, enable email/password Authentication, and create a **Standard / Native-mode Firestore** database in `us-central1`. Enable Blaze billing for Cloud Run.
2. Register a Firebase web app. Copy `apps/web/.env.example` to `apps/web/.env.local` and fill the public web configuration. Set `VITE_USE_EMULATORS=false`. Do not copy server credentials into the web app.
3. Add the deployed app's domain under Firebase Authentication's authorized domains. Configure the app name and verification/reset email templates. For branded action pages, set the template action-handler URL to `https://YOUR_DOMAIN/auth/action`. Built-in Firebase email delivery is sufficient.
4. Create a dedicated Cloud Run service account with `roles/datastore.user` and `roles/firebaseauth.viewer`. The API uses Application Default Credentials and checks token revocation; no downloaded service-account key is needed.
5. From the repository root, deploy the Dockerfile to Cloud Run. Replace `YOUR_PROJECT_ID` and the service-account email with your actual values:

```sh
gcloud run deploy ztype-api \
  --source . \
  --project YOUR_PROJECT_ID \
  --region us-central1 \
  --service-account ztype-api@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID \
  --min-instances 0 \
  --max-instances 2 \
  --memory 512Mi \
  --cpu 1 \
  --concurrency 40 \
  --timeout 30 \
  --cpu-throttling
```

Cloud Run accepts public HTTP so Firebase Hosting can forward requests; the Express middleware still authenticates every private API endpoint. Leave emulator environment variables unset in production. Before using real data, confirm the request-based billing setting and service-account grants in the console.

6. Build and deploy Hosting, database rules, and indexes:

```sh
npm run build
npx firebase deploy --project YOUR_PROJECT_ID --only hosting,firestore
```

`firebase.json` routes `/api/**` to `ztype-api` and all other routes to the React app. Static assets have immutable cache headers; the deployment includes CSP and other browser security headers. Firestore rules deny every client read/write; server authorization is implemented in Express because Admin SDK operations bypass these rules.

For development against a real project, copy the API `.env.example`, set `GOOGLE_CLOUD_PROJECT`, and run `gcloud auth application-default login`. Do not enable public database rules as a workaround for credential errors.

### Costs and operations

Use zero warm instances, a maximum of two instances, CDN caching, paginated history, and one result write plus one aggregate update per session. Set a **$25 monthly budget** with alerts at **40%, 80%, and 100%** ($10 / $20 / $25), including forecast alerts. Alerts are not a hard spending cap. Hosting bandwidth, build artifacts, logs, reads, and retries also contribute to cost.

Monitor Cloud Run request latency and 5xx rates, Firestore reads/writes/storage, Authentication quotas, and billing. Cloud Run captures structured API error logs without recording email addresses or typing text. Configure an alert for sustained API 5xx responses and an uptime check on `/api/health`. Review instance limits before a larger launch. Rate limits are per running instance; they are not a global anti-abuse or billing limit.

The supplied workflow validates code but does not auto-deploy. Use Firebase Hosting release rollback and Cloud Run revision traffic controls for a rollback. Preserve the previous content and scoring version when changing historical interpretation. Backups and account deletion/export tooling should be added before a broader public launch with long-lived real accounts.
