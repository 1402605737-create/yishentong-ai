import { Inject, Provide } from '@midwayjs/core';
import { z } from 'zod';
import { buildLocalReview } from '../domain/rule-engine';
import { AiReviewResult, PolicyClause, PriorAuthCase, RuleCheck } from '../interface';
import { createId } from '../util/id';
import { RepositoryService } from './repository.service';

const DeepSeekReviewSchema = z.object({
  summary: z.string(),
  satisfiedCriteria: z.array(z.string()),
  unsatisfiedCriteria: z.array(z.string()),
  supplementNotice: z.string(),
  humanReviewReason: z.string(),
});

@Provide('deepSeekService')
export class DeepSeekService {
  @Inject()
  repositoryService!: RepositoryService;

  async reviewWithModel(
    medicalCase: PriorAuthCase,
    clauses: PolicyClause[],
    ruleResult: {
      checks: RuleCheck[];
      missingDocuments: AiReviewResult['missingDocuments'];
      status: AiReviewResult['status'];
      riskLevel: AiReviewResult['riskLevel'];
    },
    options: { forceLocal?: boolean } = {}
  ): Promise<Omit<AiReviewResult, 'id' | 'caseId' | 'createdAt' | 'trace' | 'agentSteps'>> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash';
    const endpoint = `${process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'}/chat/completions`;
    const started = Date.now();

    if (!apiKey || options.forceLocal) {
      this.recordCall({
        model,
        endpoint,
        status: '本地降级',
        fallback: true,
        latencyMs: Date.now() - started,
        caseId: medicalCase.id,
        detail: options.forceLocal ? '批量演示主动使用本地 Harness Agent。' : '未配置 DEEPSEEK_API_KEY。',
      });
      return buildLocalReview(medicalCase, clauses, ruleResult);
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: [
                '你是中文医疗事前审核材料检查助手。',
                '你不做诊断，不自动批准或拒绝医疗服务。',
                '你只能基于用户提供的材料、规则检查结果和政策条款生成 JSON。',
                '所有建议提交都必须提示人工确认。',
              ].join('\n'),
            },
            {
              role: 'user',
              content: JSON.stringify({
                medicalCase,
                policyClauses: clauses,
                deterministicRuleResult: ruleResult,
                outputSchema: {
                  summary: '中文审核摘要',
                  satisfiedCriteria: ['已满足条件'],
                  unsatisfiedCriteria: ['未满足条件'],
                  supplementNotice: '给医生或审核人员的中文补件说明',
                  humanReviewReason: '需要人工复核的原因',
                },
              }),
            },
          ],
        }),
      });

      if (!response.ok) {
        this.recordCall({
          model,
          endpoint,
          status: '失败',
          fallback: true,
          latencyMs: Date.now() - started,
          httpStatus: response.status,
          caseId: medicalCase.id,
          detail: `DeepSeek 返回 HTTP ${response.status}，已使用本地审核结果。`,
        });
        return buildLocalReview(medicalCase, clauses, ruleResult);
      }

      const payload = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content ?? '{}';
      const parsed = DeepSeekReviewSchema.safeParse(JSON.parse(content));

      if (!parsed.success) {
        this.recordCall({
          model,
          endpoint,
          status: '失败',
          fallback: true,
          latencyMs: Date.now() - started,
          httpStatus: response.status,
          caseId: medicalCase.id,
          detail: 'DeepSeek 响应未通过结构化结果校验，已使用本地审核结果。',
        });
        return buildLocalReview(medicalCase, clauses, ruleResult);
      }

      this.recordCall({
        model,
        endpoint,
        status: '成功',
        fallback: false,
        latencyMs: Date.now() - started,
        httpStatus: response.status,
        caseId: medicalCase.id,
        detail: 'DeepSeek 已生成中文审核摘要和补件说明。',
      });

      return {
        status: ruleResult.status,
        riskLevel: ruleResult.riskLevel,
        model,
        summary: parsed.data.summary,
        satisfiedCriteria: parsed.data.satisfiedCriteria,
        unsatisfiedCriteria: parsed.data.unsatisfiedCriteria,
        missingDocuments: ruleResult.missingDocuments,
        ruleChecks: ruleResult.checks,
        citations: clauses.slice(0, 2).map((clause) => ({ clauseId: clause.id, quote: clause.text })),
        supplementNotice: parsed.data.supplementNotice,
        humanReviewReason: parsed.data.humanReviewReason,
      };
    } catch (error) {
      this.recordCall({
        model,
        endpoint,
        status: '失败',
        fallback: true,
        latencyMs: Date.now() - started,
        caseId: medicalCase.id,
        detail: `DeepSeek 调用异常：${error instanceof Error ? error.message : String(error)}`,
      });
      return buildLocalReview(medicalCase, clauses, ruleResult);
    }
  }

  private recordCall(log: Omit<Parameters<RepositoryService['saveModelCall']>[0], 'id' | 'createdAt'>) {
    this.repositoryService?.saveModelCall({
      id: createId(),
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      ...log,
    });
  }
}
