<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand-block">
        <div class="brand-mark">医</div>
        <div>
          <div class="brand-title">医审通 AI</div>
          <div class="brand-subtitle">中文医疗事前审核</div>
        </div>
      </div>

      <nav class="nav-stack">
        <button :class="['nav-item', { active: activeTab === 'cases' }]" @click="activeTab = 'cases'">
          <ClipboardCheck :size="18" />
          <span>案件预审</span>
        </button>
        <button :class="['nav-item', { active: activeTab === 'evals' }]" @click="activeTab = 'evals'">
          <ActivitySquare :size="18" />
          <span>评测看板</span>
        </button>
        <button :class="['nav-item', { active: activeTab === 'prompts' }]" @click="activeTab = 'prompts'">
          <FlaskConical :size="18" />
          <span>提示词实验</span>
        </button>
        <button :class="['nav-item', { active: activeTab === 'policies' }]" @click="activeTab = 'policies'">
          <BookOpenText :size="18" />
          <span>政策库</span>
        </button>
      </nav>

      <div class="runtime-panel">
        <div class="runtime-row">
          <span>模型</span>
          <strong>{{ health?.model ?? 'deepseek-v4-flash' }}</strong>
        </div>
        <div class="runtime-row">
          <span>DeepSeek</span>
          <t-tag size="small" :theme="health?.deepseekConfigured ? 'success' : 'warning'">
            {{ health?.deepseekConfigured ? '已接入' : '本地降级' }}
          </t-tag>
        </div>
        <div class="runtime-row">
          <span>数据库</span>
          <strong>{{ health?.database ?? '加载中' }}</strong>
        </div>
      </div>
    </aside>

    <main class="workspace">
      <header class="topbar">
        <div>
          <h1>{{ pageTitle }}</h1>
          <p>{{ pageSubtitle }}</p>
        </div>
        <div class="topbar-actions">
          <t-button variant="outline" @click="loadAll">
            <template #icon><RefreshCw :size="16" /></template>
            刷新
          </t-button>
          <t-button v-if="activeTab === 'cases'" theme="primary" :loading="reviewing" @click="runSelectedReview">
            <template #icon><Play :size="16" /></template>
            运行预审
          </t-button>
          <t-button v-if="activeTab === 'cases'" theme="primary" :loading="batchReviewing" @click="runBatchAgent">
            <template #icon><Bot :size="16" /></template>
            批量Agent审核
          </t-button>
          <t-button v-if="activeTab === 'cases'" variant="outline" :loading="resettingDemo" @click="resetDemoData">
            <template #icon><RotateCcw :size="16" /></template>
            重置演示
          </t-button>
          <t-button v-if="activeTab === 'evals'" theme="primary" :loading="evalRunning" @click="runRegression">
            <template #icon><Gauge :size="16" /></template>
            回归评测
          </t-button>
          <t-button v-if="activeTab === 'prompts'" theme="primary" :loading="promptRunning" @click="runPromptComparison">
            <template #icon><FlaskConical :size="16" /></template>
            策略对比
          </t-button>
        </div>
      </header>

      <section v-if="activeTab === 'cases'" class="cases-layout">
        <div class="metrics-grid">
          <div class="metric-box">
            <span>案件总量</span>
            <strong>{{ caseSummary?.total ?? cases.length }}</strong>
          </div>
          <div class="metric-box">
            <span>待预审</span>
            <strong>{{ caseSummary?.pending ?? 0 }}</strong>
          </div>
          <div class="metric-box">
            <span>已处理</span>
            <strong>{{ caseSummary?.reviewed ?? 0 }}</strong>
          </div>
          <div class="metric-box">
            <span>审核方向</span>
            <strong>{{ caseSummary?.directions.length ?? 0 }}</strong>
          </div>
        </div>

        <div v-if="batchRun" class="agent-run-banner">
          <div>
            <strong>最近批量 Agent：{{ batchRun.agentMode }}</strong>
            <span>{{ batchRun.createdAt }} · {{ batchRun.before.pending }} 个待审 → {{ batchRun.after.pending }} 个待审</span>
          </div>
          <t-tag theme="success" variant="light">已处理 {{ batchRun.reviewed }} / {{ batchRun.requested }}</t-tag>
        </div>

        <div class="cases-grid">
          <div class="panel case-list-panel">
          <div class="panel-head">
            <h2>预审队列</h2>
            <t-tag theme="primary" variant="light">{{ filteredCases.length }} / {{ cases.length }} 个案件</t-tag>
          </div>
          <div class="filter-row">
            <select v-model="directionFilter" class="filter-select">
              <option value="全部">全部方向</option>
              <option v-for="item in caseSummary?.directions ?? []" :key="item.name" :value="item.name">
                {{ item.name }}（{{ item.total }}）
              </option>
            </select>
            <select v-model="statusFilter" class="filter-select">
              <option value="全部">全部状态</option>
              <option value="待预审">待预审</option>
              <option value="需补件">需补件</option>
              <option value="需人工复核">需人工复核</option>
              <option value="建议提交">建议提交</option>
            </select>
          </div>
          <div class="case-list">
            <button
              v-for="item in filteredCases"
              :key="item.id"
              :class="['case-row', { selected: item.id === selectedCaseId }]"
              @click="selectedCaseId = item.id"
            >
              <span class="case-row-title">{{ item.title }}</span>
              <span class="case-row-meta">{{ caseDirection(item) }} · {{ item.hospital }} · {{ item.request.department }}</span>
              <span class="case-row-footer">
                <t-tag size="small" :theme="statusTheme(item.status)">{{ item.status }}</t-tag>
                <t-tag size="small" :theme="riskTheme(item.riskLevel)" variant="light">{{ item.riskLevel }}</t-tag>
              </span>
            </button>
          </div>
        </div>

          <div v-if="selectedCase" class="panel case-detail-panel">
          <div class="detail-head">
            <div>
              <h2>{{ selectedCase.title }}</h2>
              <div class="detail-meta">
                {{ selectedCase.scenario }} · {{ selectedCase.payer }} · {{ selectedCase.updatedAt }}
              </div>
            </div>
            <div class="status-stack">
              <t-tag :theme="statusTheme(selectedCase.status)">{{ selectedCase.status }}</t-tag>
              <t-tag :theme="riskTheme(selectedCase.riskLevel)" variant="light">{{ selectedCase.riskLevel }}</t-tag>
            </div>
          </div>

          <div class="detail-grid">
            <section class="info-band">
              <h3>申请信息</h3>
              <dl class="kv-grid">
                <div><dt>患者</dt><dd>{{ selectedCase.patient.displayId }} · {{ selectedCase.patient.age }} 岁 · {{ selectedCase.patient.gender }}</dd></div>
                <div><dt>诊断</dt><dd>{{ selectedCase.request.diagnosisName }}（{{ selectedCase.request.diagnosisCode }}）</dd></div>
                <div><dt>项目</dt><dd>{{ selectedCase.request.procedureName }}（{{ selectedCase.request.procedureCode }}）</dd></div>
                <div><dt>科室</dt><dd>{{ selectedCase.request.department }} · {{ selectedCase.request.urgency }}</dd></div>
              </dl>
            </section>

            <section class="info-band wide">
              <h3>临床摘要</h3>
              <p class="clinical-text">{{ selectedCase.clinicalSummary }}</p>
            </section>
          </div>

          <div class="split-grid">
            <section class="info-band">
              <h3>材料清单</h3>
              <div class="doc-list">
                <div v-for="doc in selectedCase.materials" :key="doc.id" class="doc-row">
                  <div class="doc-icon" :class="{ missing: !doc.present }">
                    <Check v-if="doc.present" :size="16" />
                    <AlertTriangle v-else :size="16" />
                  </div>
                  <div>
                    <strong>{{ doc.title }}</strong>
                    <p>{{ doc.present ? doc.content : '未上传' }}</p>
                  </div>
                </div>
              </div>
            </section>

            <section class="info-band">
              <h3>AI 审核结果</h3>
              <div v-if="selectedReview" class="review-stack">
                <p class="review-summary">{{ selectedReview.summary }}</p>
                <div class="result-metrics">
                  <div>
                    <span>状态</span>
                    <strong>{{ selectedReview.status }}</strong>
                  </div>
                  <div>
                    <span>模型</span>
                    <strong>{{ selectedReview.model }}</strong>
                  </div>
                  <div>
                    <span>引用</span>
                    <strong>{{ selectedReview.citations.length }} 条</strong>
                  </div>
                </div>
                <div v-if="selectedReview.missingDocuments.length > 0" class="missing-list">
                  <div v-for="doc in selectedReview.missingDocuments" :key="doc.id" class="missing-item">
                    <t-tag theme="danger" size="small">{{ doc.priority }}</t-tag>
                    <span>{{ doc.name }}</span>
                  </div>
                </div>
                <pre class="notice-text">{{ selectedReview.supplementNotice }}</pre>
              </div>
              <t-empty v-else description="暂无审核结果" />
            </section>
          </div>

          <div class="split-grid">
            <section class="info-band">
              <h3>规则断言</h3>
              <div v-if="selectedReview" class="rule-list">
                <div v-for="rule in selectedReview.ruleChecks" :key="rule.id" class="rule-row">
                  <div class="rule-head">
                    <t-tag size="small" :theme="rule.passed ? 'success' : 'danger'">
                      {{ rule.passed ? '通过' : '未通过' }}
                    </t-tag>
                    <strong>{{ rule.label }}</strong>
                  </div>
                  <p>{{ rule.evidence }}</p>
                  <span>{{ rule.suggestion }}</span>
                </div>
              </div>
              <t-empty v-else description="待运行" />
            </section>

            <section class="info-band">
              <h3>Agent 执行链</h3>
              <div v-if="selectedReview?.agentSteps?.length" class="agent-step-list">
                <div v-for="step in selectedReview.agentSteps" :key="step.id" class="agent-step-row">
                  <div class="agent-step-head">
                    <strong>{{ step.name }}</strong>
                    <t-tag size="small" :theme="step.status === '完成' ? 'success' : 'warning'">{{ step.status }}</t-tag>
                  </div>
                  <p>{{ step.tool }} · {{ step.output }}</p>
                  <span>{{ step.latencyMs }} ms · 输入：{{ step.input }}</span>
                </div>
              </div>
              <h3 class="trace-heading">Trace</h3>
              <div v-if="selectedReview" class="trace-list">
                <div v-for="event in selectedReview.trace" :key="event.id" class="trace-row">
                  <div class="trace-dot"></div>
                  <div>
                    <div class="trace-title">{{ event.stage }} · {{ event.actor }}</div>
                    <p>{{ event.summary }}</p>
                    <span>{{ event.latencyMs }} ms</span>
                  </div>
                </div>
              </div>
              <t-empty v-else description="待生成" />
            </section>
          </div>
        </div>
        </div>
      </section>

      <section v-if="activeTab === 'evals'" class="eval-layout">
        <div class="metrics-grid">
          <div class="metric-box">
            <span>通过率</span>
            <strong>{{ latestRun ? Math.round((latestRun.passed / latestRun.total) * 100) : 0 }}%</strong>
          </div>
          <div class="metric-box">
            <span>缺件召回</span>
            <strong>{{ percent(latestRun?.missingDocRecall) }}</strong>
          </div>
          <div class="metric-box">
            <span>引用扎根</span>
            <strong>{{ percent(latestRun?.citationGrounding) }}</strong>
          </div>
          <div class="metric-box">
            <span>误放行率</span>
            <strong>{{ percent(latestRun?.falseReadyRate) }}</strong>
          </div>
        </div>

        <div class="chart-grid">
          <section class="panel chart-panel">
            <div class="panel-head">
              <h2>Harness 指标</h2>
              <span>{{ latestRun?.createdAt }}</span>
            </div>
            <div ref="barChartRef" class="chart"></div>
          </section>
          <section class="panel chart-panel">
            <div class="panel-head">
              <h2>评测项</h2>
              <t-tag theme="primary" variant="light">{{ evalCases.length }} 条</t-tag>
            </div>
            <div class="eval-list">
              <div v-for="item in latestRun?.items ?? []" :key="item.evalCaseId" class="eval-row">
                <div>
                  <strong>{{ item.name }}</strong>
                  <p>{{ item.observation }}</p>
                </div>
                <div class="eval-score">
                  <t-tag :theme="evalTheme(item.status)" size="small">{{ item.status }}</t-tag>
                  <span>{{ Math.round(item.score * 100) }}%</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section class="panel model-call-panel">
          <div class="panel-head">
            <h2>DeepSeek 真实调用记录</h2>
            <t-tag :theme="modelCalls.some((item) => !item.fallback && item.status === '成功') ? 'success' : 'warning'" variant="light">
              {{ modelCalls.some((item) => !item.fallback && item.status === '成功') ? '已有真实成功调用' : '等待真实调用' }}
            </t-tag>
          </div>
          <div class="eval-list">
            <div v-for="item in modelCalls.slice(0, 12)" :key="item.id" class="eval-row">
              <div>
                <strong>{{ item.model }} · {{ item.caseId ?? '批量任务' }}</strong>
                <p>{{ item.detail }}</p>
                <span>{{ item.createdAt }} · {{ item.latencyMs }} ms · {{ item.endpoint }}</span>
              </div>
              <div class="eval-score">
                <t-tag :theme="item.status === '成功' ? 'success' : item.status === '失败' ? 'danger' : 'warning'" size="small">
                  {{ item.status }}
                </t-tag>
                <span>{{ item.fallback ? 'Fallback' : 'DeepSeek' }}</span>
              </div>
            </div>
            <t-empty v-if="modelCalls.length === 0" description="运行单案预审后生成调用记录" />
          </div>
        </section>
      </section>

      <section v-if="activeTab === 'prompts'" class="prompt-layout">
        <div class="metrics-grid">
          <div class="metric-box">
            <span>推荐策略</span>
            <strong>{{ promptComparison?.winnerName ?? '待评测' }}</strong>
          </div>
          <div class="metric-box">
            <span>候选版本</span>
            <strong>{{ promptVersions.length }} 个</strong>
          </div>
          <div class="metric-box">
            <span>基线模型</span>
            <strong>{{ promptComparison?.baselineModel ?? 'deepseek-v4-flash' }}</strong>
          </div>
          <div class="metric-box">
            <span>更新时间</span>
            <strong>{{ promptComparison?.createdAt ?? '未运行' }}</strong>
          </div>
        </div>

        <div class="prompt-grid">
          <section class="panel">
            <div class="panel-head">
              <h2>中文审核 Prompt 版本</h2>
              <t-tag theme="primary" variant="light">A/B/C</t-tag>
            </div>
            <div class="prompt-card-list">
              <article v-for="prompt in promptVersions" :key="prompt.id" class="prompt-card">
                <div class="prompt-card-head">
                  <div>
                    <strong>{{ prompt.name }}</strong>
                    <span>{{ prompt.owner }} · {{ prompt.updatedAt }}</span>
                  </div>
                  <t-tag :theme="promptTheme(prompt.riskPolicy)" variant="light">{{ prompt.riskPolicy }}</t-tag>
                </div>
                <p>{{ prompt.objective }}</p>
                <pre>{{ prompt.systemPrompt }}</pre>
              </article>
            </div>
          </section>

          <section class="panel">
            <div class="panel-head">
              <h2>质量对比</h2>
              <span>{{ promptComparison?.items.length ?? 0 }} 个策略</span>
            </div>
            <div class="comparison-list">
              <article v-for="item in promptComparison?.items ?? []" :key="item.promptId" class="comparison-row">
                <div class="comparison-main">
                  <div class="comparison-title">
                    <strong>{{ item.name }}</strong>
                    <t-tag :theme="adviceTheme(item.releaseAdvice)" size="small">{{ item.releaseAdvice }}</t-tag>
                  </div>
                  <p>{{ item.tradeoff }}</p>
                  <div class="score-bar">
                    <span :style="{ width: `${Math.round(item.safetyScore * 100)}%` }"></span>
                  </div>
                </div>
                <div class="comparison-metrics">
                  <div><span>安全分</span><strong>{{ Math.round(item.safetyScore * 100) }}%</strong></div>
                  <div><span>缺件召回</span><strong>{{ percent(item.missingDocRecall) }}</strong></div>
                  <div><span>引用扎根</span><strong>{{ percent(item.citationGrounding) }}</strong></div>
                  <div><span>误放行</span><strong>{{ percent(item.falseReadyRate) }}</strong></div>
                  <div><span>延迟</span><strong>{{ item.avgLatencyMs }} ms</strong></div>
                  <div><span>成本</span><strong>¥{{ item.estimatedCostCny.toFixed(3) }}</strong></div>
                </div>
              </article>
            </div>
          </section>
        </div>
      </section>

      <section v-if="activeTab === 'policies'" class="policy-layout">
        <div class="panel">
          <div class="panel-head">
            <h2>中文政策条款</h2>
            <t-input v-model="policyKeyword" clearable placeholder="搜索政策、项目、标签" class="policy-search">
              <template #prefixIcon><Search :size="16" /></template>
            </t-input>
          </div>
          <div class="policy-list">
            <article v-for="policy in filteredPolicies" :key="policy.id" class="policy-row">
              <div class="policy-row-head">
                <div>
                  <strong>{{ policy.title }}</strong>
                  <span>{{ policy.payer }} · {{ policy.clauseNo }} · {{ policy.effectiveDate }}</span>
                </div>
                <t-tag theme="primary" variant="light">{{ policy.serviceType }}</t-tag>
              </div>
              <p>{{ policy.text }}</p>
              <div class="tag-line">
                <t-tag v-for="tag in policy.tags" :key="tag" size="small" variant="light">{{ tag }}</t-tag>
              </div>
            </article>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import * as echarts from 'echarts';
import {
  ActivitySquare,
  AlertTriangle,
  BookOpenText,
  Bot,
  Check,
  ClipboardCheck,
  FlaskConical,
  Gauge,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-vue-next';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { api } from './api';
import type {
  CaseStatus,
  BatchReviewRun,
  CaseSummary,
  EvalCase,
  EvalRun,
  EvalStatus,
  HealthResponse,
  ModelCallLog,
  PolicyClause,
  PriorAuthCase,
  PromptComparisonRun,
  PromptVersion,
  RiskLevel,
} from './types';

const activeTab = ref<'cases' | 'evals' | 'prompts' | 'policies'>('cases');
const health = ref<HealthResponse>();
const cases = ref<PriorAuthCase[]>([]);
const caseSummary = ref<CaseSummary>();
const policies = ref<PolicyClause[]>([]);
const evalCases = ref<EvalCase[]>([]);
const evalRuns = ref<EvalRun[]>([]);
const promptVersions = ref<PromptVersion[]>([]);
const promptComparison = ref<PromptComparisonRun>();
const modelCalls = ref<ModelCallLog[]>([]);
const batchRun = ref<BatchReviewRun>();
const selectedCaseId = ref('case-001');
const reviewing = ref(false);
const batchReviewing = ref(false);
const resettingDemo = ref(false);
const evalRunning = ref(false);
const promptRunning = ref(false);
const policyKeyword = ref('');
const directionFilter = ref('全部');
const statusFilter = ref('全部');
const barChartRef = ref<HTMLDivElement>();

const pageTitle = computed(() => {
  if (activeTab.value === 'cases') return '案件预审工作台';
  if (activeTab.value === 'evals') return 'AI 审核 Harness';
  if (activeTab.value === 'prompts') return '提示词实验台';
  return '政策条款库';
});

const pageSubtitle = computed(() => {
  if (activeTab.value === 'cases') return '医保事前审核、商保预授权、材料补件';
  if (activeTab.value === 'evals') return '缺件召回、误放行防护、政策引用扎根';
  if (activeTab.value === 'prompts') return '中文审核策略、质量指标、上线建议';
  return '中文医保与商保政策检索';
});

const selectedCase = computed(() => cases.value.find((item) => item.id === selectedCaseId.value));
const selectedReview = computed(() => selectedCase.value?.latestReview);
const latestRun = computed(() => evalRuns.value[0]);

const filteredCases = computed(() => cases.value.filter((item) => {
  const matchesDirection = directionFilter.value === '全部' || caseDirection(item) === directionFilter.value;
  const matchesStatus = statusFilter.value === '全部' || item.status === statusFilter.value;
  return matchesDirection && matchesStatus;
}));

const filteredPolicies = computed(() => {
  const keyword = policyKeyword.value.trim();
  if (!keyword) return policies.value;
  return policies.value.filter((policy) => {
    const text = [policy.title, policy.payer, policy.clauseNo, policy.text, ...policy.tags].join(' ');
    return text.includes(keyword);
  });
});

function statusTheme(status: CaseStatus) {
  return ({
    待预审: 'default',
    需补件: 'warning',
    需人工复核: 'danger',
    建议提交: 'success',
  } as const)[status];
}

function riskTheme(risk: RiskLevel) {
  return ({
    低风险: 'success',
    中风险: 'warning',
    高风险: 'danger',
  } as const)[risk];
}

function evalTheme(status: EvalStatus) {
  return ({
    通过: 'success',
    失败: 'danger',
    需复核: 'warning',
  } as const)[status];
}

function promptTheme(policy: PromptVersion['riskPolicy']) {
  return ({
    召回优先: 'success',
    均衡策略: 'primary',
    成本优先: 'warning',
  } as const)[policy];
}

function adviceTheme(advice: PromptComparisonRun['items'][number]['releaseAdvice']) {
  return ({
    推荐灰度: 'success',
    需要调参: 'warning',
    不建议上线: 'danger',
  } as const)[advice];
}

function percent(value = 0) {
  return `${Math.round(value * 100)}%`;
}

function caseDirection(item: PriorAuthCase) {
  const text = `${item.title} ${item.request.procedureName}`;
  if (text.includes('腰椎')) return '腰椎 MRI';
  if (text.includes('膝关节')) return '膝关节 CT';
  if (text.includes('头颅')) return '头颅 CT';
  if (text.includes('冠脉') || text.includes('冠状动脉')) return '冠脉 CTA';
  if (text.includes('胃肠镜')) return '无痛胃肠镜';
  if (text.includes('靶向药') || text.includes('肺癌')) return '肿瘤靶向药';
  return item.direction ?? item.title.replace(/ #\d+$/, '');
}

async function loadAll() {
  const [healthResult, casesResult, summaryResult, policiesResult, evalResult, promptsResult, comparisonResult, modelCallsResult] = await Promise.all([
    api.health(),
    api.cases(),
    api.summary(),
    api.policies(),
    api.evals(),
    api.prompts(),
    api.comparePrompts(),
    api.modelCalls(),
  ]);
  health.value = healthResult;
  cases.value = casesResult.data;
  caseSummary.value = summaryResult.data;
  policies.value = policiesResult.data;
  evalCases.value = evalResult.data.cases;
  evalRuns.value = evalResult.data.runs;
  promptVersions.value = promptsResult.data;
  promptComparison.value = comparisonResult.data;
  modelCalls.value = modelCallsResult.data;
  selectedCaseId.value = cases.value.some((item) => item.id === selectedCaseId.value)
    ? selectedCaseId.value
    : cases.value[0]?.id ?? '';
  await renderCharts();
}

async function runSelectedReview() {
  if (!selectedCase.value) return;
  reviewing.value = true;
  try {
    const result = await api.reviewCase(selectedCase.value.id);
    cases.value = cases.value.map((item) => item.id === selectedCase.value?.id
      ? { ...item, status: result.data.status, riskLevel: result.data.riskLevel, latestReview: result.data }
      : item);
    caseSummary.value = (await api.summary()).data;
    modelCalls.value = (await api.modelCalls()).data;
  } finally {
    reviewing.value = false;
  }
}

async function runBatchAgent() {
  batchReviewing.value = true;
  try {
    const result = await api.batchReview({
      limit: 20,
      direction: directionFilter.value === '全部' ? undefined : directionFilter.value,
      useModel: false,
    });
    batchRun.value = result.data;
    await loadAll();
  } finally {
    batchReviewing.value = false;
  }
}

async function resetDemoData() {
  resettingDemo.value = true;
  try {
    batchRun.value = undefined;
    await api.resetDemo();
    await loadAll();
  } finally {
    resettingDemo.value = false;
  }
}

async function runRegression() {
  evalRunning.value = true;
  try {
    const result = await api.runEvals();
    evalRuns.value = [result.data, ...evalRuns.value];
    await renderCharts();
  } finally {
    evalRunning.value = false;
  }
}

async function runPromptComparison() {
  promptRunning.value = true;
  try {
    const result = await api.comparePrompts(promptVersions.value.map((item) => item.id));
    promptComparison.value = result.data;
  } finally {
    promptRunning.value = false;
  }
}

async function renderCharts() {
  await nextTick();
  if (!barChartRef.value || !latestRun.value) return;
  const chart = echarts.getInstanceByDom(barChartRef.value) ?? echarts.init(barChartRef.value);
  chart.setOption({
    grid: { left: 36, right: 18, top: 28, bottom: 36 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: ['缺件召回', '引用扎根', '误放行防护', '通过率'],
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      max: 1,
      axisLabel: {
        formatter: (value: number) => `${Math.round(value * 100)}%`,
      },
    },
    series: [
      {
        type: 'bar',
        barWidth: 28,
        data: [
          latestRun.value.missingDocRecall,
          latestRun.value.citationGrounding,
          1 - latestRun.value.falseReadyRate,
          latestRun.value.passed / latestRun.value.total,
        ],
        itemStyle: {
          color: (params: { dataIndex: number }) => ['#0f766e', '#2563eb', '#c2410c', '#15803d'][params.dataIndex],
          borderRadius: [4, 4, 0, 0],
        },
      },
    ],
  });
}

watch(activeTab, () => {
  if (activeTab.value === 'evals') {
    renderCharts();
  }
});

onMounted(() => {
  loadAll();
  window.addEventListener('resize', () => renderCharts());
});
</script>
