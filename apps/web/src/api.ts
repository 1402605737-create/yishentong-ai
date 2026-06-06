import type {
  AiReviewResult,
  BatchReviewRun,
  CaseSummary,
  EvalCase,
  EvalRun,
  HealthResponse,
  ModelCallLog,
  PolicyClause,
  PriorAuthCase,
  PromptComparisonRun,
  PromptVersion,
} from './types';

const apiBase = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<HealthResponse>('/api/health'),
  cases: () => request<{ data: PriorAuthCase[] }>('/api/cases'),
  summary: () => request<{ data: CaseSummary }>('/api/dashboard/summary'),
  policies: () => request<{ data: PolicyClause[] }>('/api/policies'),
  reviewCase: (id: string) => request<{ data: AiReviewResult }>(`/api/cases/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ force: true }),
  }),
  batchReview: (body: { limit?: number; direction?: string; useModel?: boolean }) => request<{ data: BatchReviewRun }>('/api/reviews/batch', {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  resetDemo: () => request<{ data: CaseSummary }>('/api/demo/reset', {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  evals: () => request<{ data: { cases: EvalCase[]; runs: EvalRun[] } }>('/api/evals'),
  prompts: () => request<{ data: PromptVersion[] }>('/api/prompts'),
  runEvals: () => request<{ data: EvalRun }>('/api/evals/run', {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  comparePrompts: (promptIds?: string[]) => request<{ data: PromptComparisonRun }>('/api/evals/compare', {
    method: 'POST',
    body: JSON.stringify({ promptIds }),
  }),
  modelCalls: () => request<{ data: ModelCallLog[] }>('/api/model-calls'),
};
