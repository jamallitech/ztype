import express from 'express';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createApp } from './app';
import { FirestoreRepository } from './repository';

const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
const port = Number(process.env.PORT || 3001);
if (!projectId) {
  const app = express();
  app.get('/api/health', (_req, res) => res.json({ status: 'local', cloud: false }));
  app.use('/api', (_req, res) =>
    res.status(503).json({
      error: 'Cloud accounts are not configured on this installation. Guest practice is available.',
    }),
  );
  app.listen(port, () =>
    console.log(`Ztype API: http://localhost:${port} (guest development; cloud not configured)`),
  );
} else {
  initializeApp({
    projectId,
    ...(process.env.FIREBASE_AUTH_EMULATOR_HOST ? {} : { credential: applicationDefault() }),
  });
  const app = createApp({
    repository: new FirestoreRepository(getFirestore()),
    verifyToken: (token) => getAuth().verifyIdToken(token, true),
  });
  app.listen(port, () => console.log(`Ztype API listening on port ${port}`));
}
