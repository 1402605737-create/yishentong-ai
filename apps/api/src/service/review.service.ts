import { Inject, Provide } from '@midwayjs/core';
import { runDeterministicRules } from '../domain/rule-engine';
import { AgentStep, AiReviewResult, BatchReviewRun, TraceEvent } from '../interface';
import { createId } from '../util/id';
import { DeepSeekService } from './deepseek.service';
import { PolicyService } from './policy.service';
import { RepositoryService } from './repository.service';

@Provide('reviewService')
export class ReviewService {
  @Inject()
  repositoryService!: RepositoryService;

  @Inject()
  policyService!: PolicyService;

  @Inject()
  deepSeekService!: DeepSeekService;

  async reviewCase(caseId: string, options: { useModel?: boolean } = {}): Promise<AiReviewResult> {
    const started = Date.now();
    const medicalCase = this.repositoryService.findCase(caseId);
    if (!medicalCase) {
      throw new Error(`未找到预审案件：${caseId}`);
    }

    const trace: TraceEvent[] = [];
    const agentSteps: AgentStep[] = [];

    const pushStep = (step: Omit<AgentStep, 'id'>) => {
      agentSteps.push({ id: createId(), ...step });
    };

    pushStep({
      name: '读取脱敏案件快照',
      tool: 'case_reader',
      status: '完成',
      input: medicalCase.id,
      output: `${medicalCase.title} / ${medicalCase.request.procedureName}`,
      latencyMs: 4,
    });

    const retrievalStarted = Date.now();
    const clauses = this.policyService.retrieveForCase(medicalCase);
    pushStep({
      name: '检索中文医保/商保政策',
      tool: 'policy_retriever',
      status: clauses.length > 0 ? '完成' : '需人工',
      input: medicalCase.policyIds.join(', '),
      output: `命中 ${clauses.length} 条政策条款`,
      latencyMs: Date.now() - retrievalStarted,
    });
    trace.push({
      id: createId(),
      stage: '中文政策检索',
      actor: '政策检索',
      summary: `命中 ${clauses.length} 条医保/商保政策条款。`,
      latencyMs: Date.now() - retrievalStarted,
    });

    const ruleStarted = Date.now();
    const ruleResult = runDeterministicRules(medicalCase, clauses);
    pushStep({
      name: '执行材料完整性规则',
      tool: 'rule_checker',
      status: ruleResult.status === '建议提交' ? '完成' : '需人工',
      input: `${medicalCase.materials.length} 份材料`,
      output: `${ruleResult.checks.length} 项规则，${ruleResult.missingDocuments.length} 项缺件`,
      latencyMs: Date.now() - ruleStarted,
    });
    trace.push({
      id: createId(),
      stage: '确定性规则审核',
      actor: '规则引擎',
      summary: `完成 ${ruleResult.checks.length} 项材料完整性与风险规则检查。`,
      latencyMs: Date.now() - ruleStarted,
    });

    const modelStarted = Date.now();
    const useModel = options.useModel ?? true;
    const reviewDraft = await this.deepSeekService.reviewWithModel(medicalCase, clauses, ruleResult, {
      forceLocal: !useModel,
    });
    pushStep({
      name: '生成中文审核意见',
      tool: useModel && process.env.DEEPSEEK_API_KEY ? 'deepseek_v4_flash' : 'local_review_agent',
      status: '完成',
      input: `${ruleResult.checks.length} 项规则结果 + ${clauses.length} 条政策`,
      output: reviewDraft.summary,
      latencyMs: Date.now() - modelStarted,
    });
    trace.push({
      id: createId(),
      stage: '模型生成审核说明',
      actor: useModel && process.env.DEEPSEEK_API_KEY ? 'DeepSeek' : '审核Agent',
      summary: useModel && process.env.DEEPSEEK_API_KEY
        ? '已调用 DeepSeek V4 Flash 生成中文审核摘要和补件说明。'
        : '批量演示使用本地审核 Agent 生成可追溯审核说明。',
      latencyMs: Date.now() - modelStarted,
      tokens: Math.round(JSON.stringify(medicalCase).length / 2),
    });

    pushStep({
      name: '安全闸门与路由',
      tool: 'safety_gate',
      status: reviewDraft.status === '建议提交' ? '完成' : '需人工',
      input: reviewDraft.status,
      output: reviewDraft.humanReviewReason,
      latencyMs: Date.now() - started,
    });

    trace.push({
      id: createId(),
      stage: 'Harness 安全闸门',
      actor: 'Harness',
      summary: reviewDraft.status === '建议提交'
        ? '通过误放行防护检查，仍需人工确认后提交。'
        : '检测到补件或人工复核要求，阻止直接建议提交。',
      latencyMs: Date.now() - started,
    });

    const review: AiReviewResult = {
      ...reviewDraft,
      id: createId(),
      caseId,
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      trace,
      agentSteps,
    };

    this.repositoryService.saveReview(review);
    this.repositoryService.updateCaseStatus(caseId, review.status, review.riskLevel);
    return review;
  }

  getLatestReview(caseId: string) {
    return this.repositoryService.getLatestReview(caseId);
  }

  async reviewBatch(options: { limit?: number; direction?: string; useModel?: boolean } = {}): Promise<BatchReviewRun> {
    const before = this.repositoryService.getCaseSummary();
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 60);
    const candidates = this.repositoryService
      .listCases()
      .filter((item) => item.status === '待预审')
      .filter((item) => !options.direction || this.caseDirection(item) === options.direction)
      .slice(0, limit);

    const results: BatchReviewRun['results'] = [];
    for (const medicalCase of candidates) {
      const started = Date.now();
      const review = await this.reviewCase(medicalCase.id, { useModel: options.useModel ?? false });
      results.push({
        caseId: medicalCase.id,
        title: medicalCase.title,
        direction: this.caseDirection(medicalCase),
        status: review.status,
        riskLevel: review.riskLevel,
        agentStepCount: review.agentSteps?.length ?? 0,
        latencyMs: Date.now() - started,
      });
    }

    return {
      id: createId(),
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      requested: limit,
      reviewed: results.length,
      before,
      after: this.repositoryService.getCaseSummary(),
      agentMode: options.useModel ? 'DeepSeek在线Agent' : '本地Harness批量Agent',
      results,
    };
  }

  private caseDirection(medicalCase: { title: string; direction?: string; request: { procedureName: string } }) {
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
