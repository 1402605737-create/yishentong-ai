import { describe, expect, it } from 'vitest';
import { retrievePolicyClauses, runDeterministicRules } from '../src/domain/rule-engine';
import { policies, priorAuthCases } from '../src/data/seed';

describe('医审通 harness', () => {
  it('缺少膝关节 X 线报告时不能建议提交', () => {
    const medicalCase = priorAuthCases.find((item) => item.id === 'case-002')!;
    const clauses = retrievePolicyClauses(medicalCase, policies);
    const result = runDeterministicRules(medicalCase, clauses);

    expect(result.status).not.toBe('建议提交');
    expect(result.missingDocuments.some((item) => item.name.includes('X 线'))).toBe(true);
  });

  it('急诊头颅 CT 信息缺失时进入人工复核', () => {
    const medicalCase = priorAuthCases.find((item) => item.id === 'case-003')!;
    const clauses = retrievePolicyClauses(medicalCase, policies);
    const result = runDeterministicRules(medicalCase, clauses);

    expect(result.status).toBe('需人工复核');
    expect(result.riskLevel).toBe('高风险');
  });
});
