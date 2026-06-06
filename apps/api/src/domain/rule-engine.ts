import {
  AiReviewResult,
  CaseStatus,
  MissingDocument,
  PolicyClause,
  PriorAuthCase,
  RiskLevel,
  RuleCheck,
} from '../interface';

const hasText = (text: string, words: string[]) => words.some((word) => text.includes(word));
const hasPositiveText = (text: string, words: string[], negations: string[]) => {
  return hasText(text, words) && !hasText(text, negations);
};

const materialText = (medicalCase: PriorAuthCase) => [
  medicalCase.clinicalSummary,
  ...medicalCase.materials.filter((item) => item.present).map((item) => `${item.title} ${item.content}`),
].join('\n');

const missingMaterial = (medicalCase: PriorAuthCase, words: string[]) => medicalCase.materials
  .filter((item) => !item.present)
  .some((item) => words.some((word) => item.title.includes(word) || item.type.includes(word)));

export function retrievePolicyClauses(medicalCase: PriorAuthCase, policies: PolicyClause[]) {
  const haystack = [
    medicalCase.payer,
    medicalCase.request.procedureName,
    medicalCase.request.diagnosisName,
    medicalCase.request.department,
    medicalCase.clinicalSummary,
  ].join(' ');

  return policies
    .filter((policy) => medicalCase.policyIds.includes(policy.policyId) || policy.payer === medicalCase.payer)
    .map((policy) => {
      const tagScore = policy.tags.reduce((score, tag) => score + (haystack.includes(tag) ? 2 : 0), 0);
      const titleScore = haystack.includes(policy.serviceType) ? 3 : 0;
      return { policy, score: tagScore + titleScore };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map((item) => item.policy);
}

export function runDeterministicRules(
  medicalCase: PriorAuthCase,
  clauses: PolicyClause[]
): {
  checks: RuleCheck[];
  missingDocuments: MissingDocument[];
  status: CaseStatus;
  riskLevel: RiskLevel;
} {
  const text = materialText(medicalCase);
  const checks: RuleCheck[] = [];
  const missingDocuments: MissingDocument[] = [];

  if (medicalCase.request.procedureName.includes('腰椎 MRI')) {
    const hasConservativeCare = hasText(text, ['保守治疗', '康复', '牵引', 'NSAIDs', '4 周', '四周']);
    const hasNeuroFinding = hasText(text, ['神经', '放射痛', '直腿抬高', '肌力', '麻木']);

    checks.push({
      id: 'rule-lumbar-conservative',
      label: '不少于四周保守治疗记录',
      passed: hasConservativeCare,
      severity: '中风险',
      evidence: hasConservativeCare ? '材料中记录康复牵引 4 周及 NSAIDs 治疗。' : '未见完整保守治疗周期或疗效记录。',
      suggestion: hasConservativeCare ? '无需补充保守治疗记录。' : '补充保守治疗起止时间、方式和疗效。',
    });

    checks.push({
      id: 'rule-lumbar-neuro',
      label: '神经系统体征或相关症状',
      passed: hasNeuroFinding,
      severity: '中风险',
      evidence: hasNeuroFinding ? '材料中出现右下肢放射痛和直腿抬高试验阳性。' : '未见神经系统阳性体征。',
      suggestion: hasNeuroFinding ? '可作为医学必要性依据。' : '补充神经系统查体记录。',
    });
  }

  if (medicalCase.request.procedureName.includes('膝关节 CT')) {
    const hasXray = hasText(text, ['X 线', 'X线', 'DR', '平片']);
    const absentXray = missingMaterial(medicalCase, ['X 线', 'X线', '影像']);

    checks.push({
      id: 'rule-knee-xray',
      label: 'X 线初筛结果或无法检查说明',
      passed: hasXray && !absentXray,
      severity: '高风险',
      evidence: hasXray && !absentXray ? '材料中包含 X 线初筛信息。' : '申请单未说明 X 线初筛，影像报告材料缺失。',
      suggestion: '补充膝关节 X 线报告，或说明无法进行 X 线检查的原因。',
    });

    if (!hasXray || absentXray) {
      missingDocuments.push({
        id: 'missing-knee-xray',
        name: '膝关节 X 线报告或无法检查说明',
        reason: '商保条款要求 CT 预授权提供 X 线初筛结果或无法检查说明。',
        priority: '必须补齐',
      });
    }
  }

  if (medicalCase.request.procedureName.includes('头颅 CT')) {
    const hasConsciousness = hasPositiveText(
      text,
      ['意识', 'GCS', '嗜睡', '昏迷'],
      ['未记录意识', '未见意识', '缺少意识', '无意识状态记录']
    );
    const hasNeuroLocalization = hasPositiveText(
      text,
      ['偏瘫', '定位体征', '瞳孔', '病理征', '肌力'],
      ['未记录神经定位', '未见神经定位', '缺少神经定位', '无神经定位体征']
    );
    const hasAnticoagulant = hasPositiveText(
      text,
      ['抗凝', '华法林', '利伐沙班', '阿司匹林'],
      ['未说明抗凝', '未记录抗凝', '未见抗凝', '缺少抗凝']
    );

    checks.push({
      id: 'rule-head-consciousness',
      label: '意识状态记录',
      passed: hasConsciousness,
      severity: '高风险',
      evidence: hasConsciousness ? '材料中记录意识状态。' : '急诊材料未记录意识状态。',
      suggestion: '补充意识状态或 GCS 评分。',
    });
    checks.push({
      id: 'rule-head-neuro',
      label: '神经定位体征',
      passed: hasNeuroLocalization,
      severity: '高风险',
      evidence: hasNeuroLocalization ? '材料中记录神经定位体征。' : '急诊材料未记录神经定位体征。',
      suggestion: '补充瞳孔、肌力、病理征或其他神经定位体征。',
    });
    checks.push({
      id: 'rule-head-anticoagulant',
      label: '抗凝用药史',
      passed: hasAnticoagulant,
      severity: '中风险',
      evidence: hasAnticoagulant ? '材料中记录抗凝相关用药史。' : '材料未说明抗凝用药史。',
      suggestion: '补充抗凝、抗血小板用药情况。',
    });

    if (!hasConsciousness || !hasNeuroLocalization || !hasAnticoagulant) {
      missingDocuments.push({
        id: 'missing-head-emergency-note',
        name: '急诊神经系统补充记录',
        reason: '加急头颅 CT 需记录意识状态、神经定位体征和抗凝用药史。',
        priority: '必须补齐',
      });
    }
  }

  if (checks.length === 0) {
    const absentMaterials = medicalCase.materials.filter((item) => !item.present);
    const presentMaterials = medicalCase.materials.filter((item) => item.present);

    checks.push({
      id: 'rule-generic-policy',
      label: '政策条款命中',
      passed: clauses.length > 0,
      severity: '高风险',
      evidence: clauses.length > 0 ? `已命中 ${clauses.length} 条相关政策。` : '未命中可追溯政策条款。',
      suggestion: clauses.length > 0 ? '可进入材料完整性检查。' : '补充或绑定对应医保/商保政策。',
    });

    checks.push({
      id: 'rule-generic-material-presence',
      label: '关键材料完整性',
      passed: absentMaterials.length === 0,
      severity: medicalCase.request.urgency === '加急' ? '高风险' : '中风险',
      evidence: absentMaterials.length === 0
        ? `已上传 ${presentMaterials.length} 类关键材料。`
        : `缺少 ${absentMaterials.map((item) => item.title).join('、')}。`,
      suggestion: absentMaterials.length === 0 ? '可进入人工确认。' : '补齐缺失材料后重新发起预审。',
    });

    absentMaterials.forEach((item) => {
      missingDocuments.push({
        id: `missing-${item.id}`,
        name: item.title,
        reason: `${medicalCase.request.procedureName} 预审材料不完整，缺少 ${item.title}。`,
        priority: item.type === '检验报告' || item.type === '知情同意' ? '必须补齐' : '建议补充',
      });
    });
  }

  const failedHigh = checks.some((item) => !item.passed && item.severity === '高风险');
  const failed = checks.some((item) => !item.passed);
  const status: CaseStatus = failedHigh
    ? '需人工复核'
    : failed || missingDocuments.length > 0
      ? '需补件'
      : '建议提交';
  const riskLevel: RiskLevel = failedHigh ? '高风险' : failed ? '中风险' : '低风险';

  if (clauses.length === 0) {
    checks.push({
      id: 'rule-policy-citation',
      label: '政策条款可追溯',
      passed: false,
      severity: '高风险',
      evidence: '未检索到可引用政策条款。',
      suggestion: '上传或绑定对应医保/商保政策。',
    });
  }

  return { checks, missingDocuments, status, riskLevel };
}

export function buildLocalReview(
  medicalCase: PriorAuthCase,
  clauses: PolicyClause[],
  ruleResult: ReturnType<typeof runDeterministicRules>
): Omit<AiReviewResult, 'id' | 'caseId' | 'createdAt' | 'trace' | 'agentSteps'> {
  const satisfiedCriteria = ruleResult.checks
    .filter((item) => item.passed)
    .map((item) => item.label);
  const unsatisfiedCriteria = ruleResult.checks
    .filter((item) => !item.passed)
    .map((item) => item.label);

  const noticeLines = ruleResult.missingDocuments.map((item, index) => {
    return `${index + 1}. ${item.name}：${item.reason}`;
  });

  return {
    status: ruleResult.status,
    riskLevel: ruleResult.riskLevel,
    model: 'local-rule-harness',
    summary: ruleResult.status === '建议提交'
      ? '当前材料与已检索政策要求基本匹配，建议进入人工确认后提交。'
      : '当前材料存在缺失或高风险信息，建议补齐材料后再提交或进入人工复核。',
    satisfiedCriteria,
    unsatisfiedCriteria,
    missingDocuments: ruleResult.missingDocuments,
    ruleChecks: ruleResult.checks,
    citations: clauses.slice(0, 2).map((clause) => ({
      clauseId: clause.id,
      quote: clause.text,
    })),
    supplementNotice: noticeLines.length > 0
      ? `请补充以下材料后重新发起预审：\n${noticeLines.join('\n')}`
      : '当前未发现必须补齐材料。请由审核人员确认后提交。',
    humanReviewReason: ruleResult.status === '需人工复核'
      ? '存在高风险缺失项或加急场景，系统不得自动建议提交。'
      : '无强制人工复核原因，但提交前仍需人工确认。',
  };
}
