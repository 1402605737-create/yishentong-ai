import type { IncomingMessage, ServerResponse } from 'http';
import { getRuntime } from '../src/runtime';

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

function allowedOrigin(origin?: string) {
  if (!origin) return '';
  const configured = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5178,http://127.0.0.1:5178')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return configured.includes(origin) ? origin : '';
}

function send(res: ServerResponse, status: number, body: JsonValue) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

function requestPath(req: IncomingMessage) {
  const original = req.headers['x-vercel-original-url'];
  const value = typeof original === 'string' ? original : req.url ?? '/';
  return new URL(value, 'http://localhost').pathname.replace(/\/$/, '') || '/';
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const origin = allowedOrigin(typeof req.headers.origin === 'string' ? req.headers.origin : undefined);
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const path = requestPath(req);
    const method = req.method ?? 'GET';
    const runtime = await getRuntime();
    const { repositoryService, reviewService, policyService, evalHarnessService } = runtime;

    if (method === 'GET' && (path === '/health' || path === '/api/health')) {
      const databaseHealth = await repositoryService.databaseHealth();
      send(res, databaseHealth.connected ? 200 : 503, {
        ok: databaseHealth.connected,
        name: '医审通 AI API',
        model: process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash',
        deepseekConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
        deepseek_configured: Boolean(process.env.DEEPSEEK_API_KEY),
        database: databaseHealth.database,
        database_connected: databaseHealth.connected,
        current_database: databaseHealth.currentDatabase,
        current_user: databaseHealth.currentUser,
        case_count: repositoryService.listCases().length,
      });
      return;
    }

    if (method === 'GET' && path === '/api/cases') {
      send(res, 200, {
        data: repositoryService.listCases().map((medicalCase) => ({
          ...medicalCase,
          latestReview: reviewService.getLatestReview(medicalCase.id),
        })),
      });
      return;
    }
    if (method === 'GET' && path === '/api/dashboard/summary') {
      send(res, 200, { data: repositoryService.getCaseSummary() });
      return;
    }
    if (method === 'GET' && path === '/api/policies') {
      send(res, 200, { data: policyService.listPolicies() });
      return;
    }
    if (method === 'GET' && path === '/api/evals') {
      send(res, 200, { data: { cases: evalHarnessService.listEvalCases(), runs: evalHarnessService.listRuns() } });
      return;
    }
    if (method === 'GET' && path === '/api/prompts') {
      send(res, 200, { data: evalHarnessService.listPromptVersions() });
      return;
    }
    if (method === 'GET' && path === '/api/model-calls') {
      send(res, 200, { data: repositoryService.listModelCalls() });
      return;
    }

    const caseMatch = path.match(/^\/api\/cases\/([^/]+)$/);
    if (method === 'GET' && caseMatch) {
      const medicalCase = repositoryService.findCase(caseMatch[1]);
      send(res, medicalCase ? 200 : 404, {
        data: medicalCase,
        latestReview: medicalCase ? reviewService.getLatestReview(caseMatch[1]) : undefined,
      });
      return;
    }

    const reviewMatch = path.match(/^\/api\/cases\/([^/]+)\/review$/);
    if (method === 'POST' && reviewMatch) {
      const body = await readBody(req);
      const existing = body.force ? undefined : reviewService.getLatestReview(reviewMatch[1]);
      const review = existing ?? await reviewService.reviewCase(reviewMatch[1]);
      await repositoryService.flush();
      send(res, 200, { data: review });
      return;
    }
    if (method === 'POST' && path === '/api/reviews/batch') {
      const body = await readBody(req) as { limit?: number; direction?: string; useModel?: boolean };
      const run = await reviewService.reviewBatch(body);
      await repositoryService.flush();
      send(res, 200, { data: run });
      return;
    }
    if (method === 'POST' && path === '/api/demo/reset') {
      repositoryService.resetDemoData();
      await repositoryService.flush();
      send(res, 200, { data: repositoryService.getCaseSummary() });
      return;
    }
    if (method === 'POST' && path === '/api/evals/run') {
      const run = evalHarnessService.runRegression();
      await repositoryService.flush();
      send(res, 200, { data: run });
      return;
    }
    if (method === 'POST' && path === '/api/evals/compare') {
      const body = await readBody(req) as { promptIds?: string[] };
      send(res, 200, { data: evalHarnessService.comparePromptVersions(body.promptIds) });
      return;
    }

    send(res, 404, { error: '接口不存在', path });
  } catch (error) {
    send(res, 500, {
      error: '服务端执行失败',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
