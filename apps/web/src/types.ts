export type RiskLevel = '低风险' | '中风险' | '高风险';
export type CaseStatus = '待预审' | '需补件' | '需人工复核' | '建议提交';
export type EvalStatus = '通过' | '失败' | '需复核';

export interface ClinicalMaterial {
  id: string;
  type: '门诊病历' | '检查申请单' | '既往治疗记录' | '影像报告' | '检验报告' | '知情同意';
  title: string;
  content: string;
  present: boolean;
}

export interface PriorAuthCase {
  id: string;
  title: string;
  direction?: string;
  hospital: string;
  city: string;
  payer: string;
  scenario: '医保事前审核' | '商保预授权';
  patient: {
    displayId: string;
    age: number;
    gender: '男' | '女';
  };
  request: {
    procedureName: string;
    procedureCode: string;
    diagnosisName: string;
    diagnosisCode: string;
    department: string;
    urgency: '常规' | '加急';
  };
  clinicalSummary: string;
  materials: ClinicalMaterial[];
  policyIds: string[];
  status: CaseStatus;
  riskLevel: RiskLevel;
  updatedAt: string;
  latestReview?: AiReviewResult;
}

export interface PolicyClause {
  id: string;
  policyId: string;
  payer: string;
  title: string;
  clauseNo: string;
  serviceType: string;
  text: string;
  tags: string[];
  effectiveDate: string;
}

export interface RuleCheck {
  id: string;
  label: string;
  passed: boolean;
  severity: RiskLevel;
  evidence: string;
  suggestion: string;
}

export interface MissingDocument {
  id: string;
  name: string;
  reason: string;
  priority: '必须补齐' | '建议补充';
}

export interface TraceEvent {
  id: string;
  stage: string;
  actor: '规则引擎' | 'DeepSeek' | '政策检索' | 'Harness' | '审核Agent';
  summary: string;
  latencyMs: number;
  tokens?: number;
}

export interface AgentStep {
  id: string;
  name: string;
  tool: string;
  status: '完成' | '跳过' | '需人工';
  input: string;
  output: string;
  latencyMs: number;
}

export interface AiReviewResult {
  id: string;
  caseId: string;
  status: CaseStatus;
  riskLevel: RiskLevel;
  model: string;
  summary: string;
  satisfiedCriteria: string[];
  unsatisfiedCriteria: string[];
  missingDocuments: MissingDocument[];
  ruleChecks: RuleCheck[];
  citations: Array<{
    clauseId: string;
    quote: string;
  }>;
  supplementNotice: string;
  humanReviewReason: string;
  trace: TraceEvent[];
  agentSteps?: AgentStep[];
  createdAt: string;
}

export interface CaseSummary {
  total: number;
  pending: number;
  reviewed: number;
  needSupplement: number;
  humanReview: number;
  readyToSubmit: number;
  directions: Array<{
    name: string;
    total: number;
    pending: number;
    reviewed: number;
  }>;
}

export interface BatchReviewRun {
  id: string;
  createdAt: string;
  requested: number;
  reviewed: number;
  before: CaseSummary;
  after: CaseSummary;
  agentMode: '本地Harness批量Agent' | 'DeepSeek在线Agent';
  results: Array<{
    caseId: string;
    title: string;
    direction: string;
    status: CaseStatus;
    riskLevel: RiskLevel;
    agentStepCount: number;
    latencyMs: number;
  }>;
}

export interface EvalCase {
  id: string;
  name: string;
  category: '缺件召回' | '政策引用' | '误放行防护' | '中文表达';
  inputCaseId: string;
  expected: string;
  lastStatus: EvalStatus;
  lastScore: number;
}

export interface EvalRun {
  id: string;
  model: string;
  createdAt: string;
  total: number;
  passed: number;
  failed: number;
  falseReadyRate: number;
  missingDocRecall: number;
  citationGrounding: number;
  avgLatencyMs: number;
  items: Array<{
    evalCaseId: string;
    name: string;
    status: EvalStatus;
    score: number;
    observation: string;
  }>;
}

export interface PromptVersion {
  id: string;
  name: string;
  owner: string;
  model: string;
  objective: string;
  systemPrompt: string;
  riskPolicy: '召回优先' | '均衡策略' | '成本优先';
  releaseStage: '实验' | '灰度' | '推荐上线';
  updatedAt: string;
}

export interface PromptComparisonRun {
  id: string;
  createdAt: string;
  baselineModel: string;
  winnerPromptId: string;
  winnerName: string;
  items: Array<{
    promptId: string;
    name: string;
    riskPolicy: PromptVersion['riskPolicy'];
    missingDocRecall: number;
    citationGrounding: number;
    falseReadyRate: number;
    avgLatencyMs: number;
    estimatedCostCny: number;
    safetyScore: number;
    releaseAdvice: '推荐灰度' | '需要调参' | '不建议上线';
    tradeoff: string;
  }>;
}

export interface HealthResponse {
  ok: boolean;
  name: string;
  model: string;
  deepseekConfigured: boolean;
  deepseek_configured?: boolean;
  database: string;
  database_connected?: boolean;
  case_count?: number;
}

export interface ModelCallLog {
  id: string;
  model: string;
  endpoint: string;
  status: '成功' | '失败' | '本地降级';
  fallback: boolean;
  latencyMs: number;
  httpStatus?: number;
  caseId?: string;
  detail: string;
  createdAt: string;
}
