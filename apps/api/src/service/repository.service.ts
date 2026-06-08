import { Init, Provide } from '@midwayjs/core';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { Pool } from 'pg';
import {
  AiReviewResult,
  CaseSummary,
  EvalCase,
  EvalRun,
  ModelCallLog,
  PolicyClause,
  PriorAuthCase,
  PromptVersion,
} from '../interface';
import { evalCases, initialEvalRun, policies, priorAuthCases, promptVersions } from '../data/seed';

interface DevStore {
  cases: PriorAuthCase[];
  policies: PolicyClause[];
  reviews: AiReviewResult[];
  evalCases: EvalCase[];
  evalRuns: EvalRun[];
  promptVersions: PromptVersion[];
  modelCalls: ModelCallLog[];
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const normalizeDatabaseUrl = (value: string) => {
  const url = new URL(value.replace(/^postgresql\+psycopg:\/\//, 'postgresql://'));
  url.searchParams.delete('sslmode');
  return url.toString();
};

@Provide('repositoryService')
export class RepositoryService {
  private storePath = join(process.cwd(), 'data', 'yishentong-dev-db.json');
  private store!: DevStore;
  private pool?: Pool;
  private writeChain: Promise<void> = Promise.resolve();
  private lastDatabaseError = '';

  @Init()
  async init() {
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
      this.pool = new Pool({
        connectionString: normalizeDatabaseUrl(databaseUrl),
        max: 1,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 10_000,
        ssl: { rejectUnauthorized: false },
      });
      if (!process.env.VERCEL || process.env.DATABASE_BOOTSTRAP_SCHEMA === 'true') {
        await this.ensurePostgresSchema();
      }
      this.store = await this.loadPostgresStore();
      return;
    }
    this.store = this.loadLocalStore();
  }

  listCases() {
    return clone(this.store.cases);
  }

  getCaseSummary(): CaseSummary {
    const cases = this.store.cases;
    const reviewedStatuses = new Set(['需补件', '需人工复核', '建议提交']);
    const directions = [...new Set(cases.map((item) => this.caseDirection(item)))].sort();

    return {
      total: cases.length,
      pending: cases.filter((item) => item.status === '待预审').length,
      reviewed: cases.filter((item) => reviewedStatuses.has(item.status)).length,
      needSupplement: cases.filter((item) => item.status === '需补件').length,
      humanReview: cases.filter((item) => item.status === '需人工复核').length,
      readyToSubmit: cases.filter((item) => item.status === '建议提交').length,
      directions: directions.map((direction) => {
        const scoped = cases.filter((item) => this.caseDirection(item) === direction);
        return {
          name: direction,
          total: scoped.length,
          pending: scoped.filter((item) => item.status === '待预审').length,
          reviewed: scoped.filter((item) => reviewedStatuses.has(item.status)).length,
        };
      }),
    };
  }

  resetDemoData() {
    this.store.cases = clone(priorAuthCases);
    this.store.reviews = [];
    this.persist();
  }

  findCase(id: string) {
    const medicalCase = this.store.cases.find((item) => item.id === id);
    return medicalCase ? clone(medicalCase) : undefined;
  }

  updateCaseStatus(id: string, status: PriorAuthCase['status'], riskLevel: PriorAuthCase['riskLevel']) {
    const medicalCase = this.store.cases.find((item) => item.id === id);
    if (!medicalCase) {
      return;
    }
    medicalCase.status = status;
    medicalCase.riskLevel = riskLevel;
    medicalCase.updatedAt = new Date().toLocaleString('zh-CN', { hour12: false });
    this.persist();
  }

  listPolicies() {
    return clone(this.store.policies);
  }

  saveReview(result: AiReviewResult) {
    this.store.reviews = this.store.reviews.filter((item) => item.caseId !== result.caseId);
    this.store.reviews.unshift(clone(result));
    this.persist();
  }

  getLatestReview(caseId: string) {
    const result = this.store.reviews.find((item) => item.caseId === caseId);
    return result ? clone(result) : undefined;
  }

  listEvalCases() {
    return clone(this.store.evalCases);
  }

  listEvalRuns() {
    return clone(this.store.evalRuns);
  }

  listPromptVersions() {
    return clone(this.store.promptVersions);
  }

  saveEvalRun(run: EvalRun) {
    this.store.evalRuns.unshift(clone(run));
    this.store.evalRuns = this.store.evalRuns.slice(0, 10);
    this.persist();
  }

  listModelCalls() {
    return clone(this.store.modelCalls ?? []).slice(0, 30);
  }

  saveModelCall(log: ModelCallLog) {
    this.store.modelCalls = [clone(log), ...(this.store.modelCalls ?? [])].slice(0, 100);
    if (this.pool) {
      this.writeChain = this.writeChain
        .then(async () => {
          await this.pool!.query(
            `insert into yishentong_model_call_log(
              id, model, endpoint, status, fallback, latency_ms, http_status, case_id, detail, created_at
            ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
            on conflict (id) do nothing`,
            [
              log.id,
              log.model,
              log.endpoint,
              log.status,
              log.fallback,
              log.latencyMs,
              log.httpStatus ?? null,
              log.caseId ?? null,
              log.detail,
            ]
          );
        })
        .catch((error) => {
          this.lastDatabaseError = error instanceof Error ? error.message : String(error);
        });
    }
    this.persist();
  }

  async flush() {
    await this.writeChain;
    if (this.lastDatabaseError) {
      throw new Error(this.lastDatabaseError);
    }
  }

  async databaseHealth() {
    if (!this.pool) {
      return {
        database: 'local-json',
        connected: true,
        currentDatabase: 'local-json',
        currentUser: 'local',
      };
    }
    try {
      const result = await this.pool.query<{ current_database: string; current_user: string }>(
        'select current_database(), current_user'
      );
      this.lastDatabaseError = '';
      return {
        database: 'postgres',
        connected: true,
        currentDatabase: result.rows[0]?.current_database ?? 'postgres',
        currentUser: result.rows[0]?.current_user ?? 'unknown',
      };
    } catch (error) {
      this.lastDatabaseError = error instanceof Error ? error.message : String(error);
      return {
        database: 'postgres',
        connected: false,
        currentDatabase: 'unknown',
        currentUser: 'unknown',
      };
    }
  }

  private createSeedStore(): DevStore {
    return {
      cases: clone(priorAuthCases),
      policies: clone(policies),
      reviews: [],
      evalCases: clone(evalCases),
      evalRuns: [clone(initialEvalRun)],
      promptVersions: clone(promptVersions),
      modelCalls: [],
    };
  }

  private normalizeStore(loaded: DevStore) {
    if (!loaded.cases || loaded.cases.length < priorAuthCases.length) {
      loaded.cases = clone(priorAuthCases);
      loaded.reviews = [];
    }
    loaded.cases = loaded.cases.map((item) => ({ ...item, direction: this.caseDirection(item) }));
    loaded.policies = loaded.policies ?? clone(policies);
    loaded.evalCases = loaded.evalCases ?? clone(evalCases);
    loaded.evalRuns = loaded.evalRuns ?? [clone(initialEvalRun)];
    loaded.promptVersions = loaded.promptVersions ?? clone(promptVersions);
    loaded.modelCalls = loaded.modelCalls ?? [];
    return loaded;
  }

  private loadLocalStore(): DevStore {
    try {
      const raw = readFileSync(this.storePath, 'utf-8');
      const loaded = this.normalizeStore(JSON.parse(raw) as DevStore);
      if (!process.env.VERCEL) {
        this.writeStore(loaded);
      }
      return loaded;
    } catch {
      const seeded = this.createSeedStore();
      if (!process.env.VERCEL) {
        mkdirSync(dirname(this.storePath), { recursive: true });
        writeFileSync(this.storePath, JSON.stringify(seeded, null, 2), 'utf-8');
      }
      return seeded;
    }
  }

  private async ensurePostgresSchema() {
    await this.pool!.query(`
      create table if not exists yishentong_app_state (
        state_key text primary key,
        payload jsonb not null,
        updated_at timestamptz not null default now()
      );
      create table if not exists yishentong_model_call_log (
        id text primary key,
        model text not null,
        endpoint text not null,
        status text not null,
        fallback boolean not null,
        latency_ms integer not null,
        http_status integer,
        case_id text,
        detail text not null,
        created_at timestamptz not null default now()
      );
      create index if not exists idx_yishentong_model_call_created
        on yishentong_model_call_log(created_at desc);
    `);
  }

  private async loadPostgresStore(): Promise<DevStore> {
    const result = await this.pool!.query<{ payload: DevStore }>(
      'select payload from yishentong_app_state where state_key = $1',
      ['default']
    );
    const store = this.normalizeStore(result.rows[0]?.payload ?? this.createSeedStore());
    this.store = store;
    await this.persistPostgres(store);
    return store;
  }

  private persist() {
    if (this.pool) {
      const snapshot = clone(this.store);
      this.writeChain = this.writeChain
        .then(() => this.persistPostgres(snapshot))
        .then(() => {
          this.lastDatabaseError = '';
        })
        .catch((error) => {
          this.lastDatabaseError = error instanceof Error ? error.message : String(error);
        });
      return;
    }
    if (process.env.VERCEL) {
      return;
    }
    this.writeStore(this.store);
  }

  private async persistPostgres(store: DevStore) {
    await this.pool!.query(
      `insert into yishentong_app_state(state_key, payload, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (state_key)
       do update set payload = excluded.payload, updated_at = now()`,
      ['default', JSON.stringify(store)]
    );
  }

  private writeStore(store: DevStore) {
    mkdirSync(dirname(this.storePath), { recursive: true });
    writeFileSync(this.storePath, JSON.stringify(store, null, 2), 'utf-8');
  }

  private caseDirection(medicalCase: PriorAuthCase) {
    const text = `${medicalCase.title} ${medicalCase.request.procedureName}`;
    if (text.includes('腰椎')) return '腰椎 MRI';
    if (text.includes('膝关节')) return '膝关节 CT';
    if (text.includes('头颅')) return '头颅 CT';
    if (text.includes('冠脉') || text.includes('冠状动脉')) return '冠脉 CTA';
    if (text.includes('胃肠镜')) return '无痛胃肠镜';
    if (text.includes('靶向药') || text.includes('肺癌')) return '肿瘤靶向药';
    return medicalCase.direction ?? medicalCase.title.replace(/ #\d+$/, '');
  }
}
