import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { attemptSchema, preferencesSchema, validateCompletion } from '@ztype/core';
import { decodeCursor, type Repository } from './repository';

type Identity = { uid: string; email_verified?: boolean };
export function createApp(options: {
  repository: Repository;
  verifyToken: (token: string) => Promise<Identity>;
}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  });
  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Please wait a moment before trying again.' },
    }),
  );
  app.use(express.json({ limit: '256kb' }));
  const authenticate: RequestHandler = async (req, res, next) => {
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    if (!token) {
      res.status(401).json({ error: 'Sign in to access saved progress.' });
      return;
    }
    try {
      const identity = await options.verifyToken(token);
      if (!identity.email_verified) {
        res.status(403).json({ error: 'Verify your email to sync progress.' });
        return;
      }
      res.locals.uid = identity.uid;
      next();
    } catch {
      res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }
  };
  app.use('/api', authenticate);
  app.get('/api/me', async (_req, res) =>
    res.json(await options.repository.profile(res.locals.uid)),
  );
  const patchSchema = z
    .object({
      displayName: z.string().trim().min(1).max(40).optional(),
      preferences: preferencesSchema.optional(),
    })
    .strict();
  app.patch('/api/me', async (req, res) =>
    res.json(await options.repository.updateProfile(res.locals.uid, patchSchema.parse(req.body))),
  );
  app.get('/api/progress', async (_req, res) =>
    res.json(await options.repository.progress(res.locals.uid)),
  );
  const querySchema = z
    .object({
      limit: z.coerce.number().int().min(1).max(50).default(20),
      cursor: z.string().max(512).optional(),
      config: z
        .string()
        .regex(
          /^en:(time:(15|30|60|120)|words:(10|25|50|100)|lesson:(home|left|right|upper|lower|capitals|numbers|punctuation))$/,
        )
        .optional(),
    })
    .strict();
  app.get('/api/results', async (req, res) => {
    const query = querySchema.parse(req.query);
    if (query.cursor) {
      try {
        decodeCursor(query.cursor);
      } catch {
        res.status(400).json({ error: 'Invalid page cursor.' });
        return;
      }
    }
    res.json(await options.repository.results(res.locals.uid, query));
  });
  const resultLimit = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (_req, res) => res.locals.uid,
    message: { error: 'Too many uploads. Your results can be retried shortly.' },
  });
  app.post('/api/results', resultLimit, async (req, res) => {
    const attempt = attemptSchema.parse(req.body);
    if (!validateCompletion(attempt) || Date.parse(attempt.completedAt) > Date.now() + 300_000) {
      res.status(400).json({ error: 'This result is incomplete or has an invalid date.' });
      return;
    }
    res.json(await options.repository.save(res.locals.uid, [attempt]));
  });
  app.post('/api/results/import', resultLimit, async (req, res) => {
    const { attempts } = z
      .object({ attempts: z.array(attemptSchema).min(1).max(20) })
      .strict()
      .parse(req.body);
    if (
      attempts.some(
        (a) => !validateCompletion(a) || Date.parse(a.completedAt) > Date.now() + 300_000,
      )
    ) {
      res.status(400).json({ error: 'One or more results are incomplete or have invalid dates.' });
      return;
    }
    res.json(await options.repository.save(res.locals.uid, attempts));
  });
  app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Please check the submitted data.',
        details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
      return;
    }
    if (error.type === 'entity.too.large') {
      res.status(413).json({ error: 'Upload is too large.' });
      return;
    }
    if (error instanceof SyntaxError) {
      res.status(400).json({ error: 'Invalid JSON.' });
      return;
    }
    console.error(
      JSON.stringify({
        severity: 'ERROR',
        message: 'API request failed',
        code: error.code ?? 'unknown',
      }),
    );
    res
      .status(503)
      .json({ error: 'Cloud progress is temporarily unavailable. Your local results are safe.' });
  };
  app.use(errorHandler);
  return app;
}
