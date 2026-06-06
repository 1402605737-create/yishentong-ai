import { ClinicalMaterial, PriorAuthCase } from '../interface';

interface DirectionTemplate {
  direction: string;
  title: string;
  payer: string;
  scenario: PriorAuthCase['scenario'];
  department: string;
  procedureName: string;
  procedureCode: string;
  diagnosisName: string;
  diagnosisCode: string;
  policyId: string;
  cityPool: string[];
  materialFactory: (index: number, variant: number) => ClinicalMaterial[];
  summaryFactory: (index: number, variant: number) => string;
}

const hospitals = [
  '杭州市第一人民医院',
  '上海市第六人民医院',
  '广东省人民医院',
  '成都市第三人民医院',
  '南京鼓楼医院',
  '武汉协和医院',
  '西安交通大学第一附属医院',
  '苏州大学附属第一医院',
  '郑州大学第一附属医院',
  '厦门大学附属中山医院',
];

const material = (
  id: string,
  type: ClinicalMaterial['type'],
  title: string,
  content: string,
  present: boolean
): ClinicalMaterial => ({ id, type, title, content, present });

const directions: DirectionTemplate[] = [
  {
    direction: '腰椎 MRI',
    title: '腰椎 MRI 事前审核',
    payer: '杭州市基本医疗保险',
    scenario: '医保事前审核',
    department: '骨科门诊',
    procedureName: '腰椎 MRI 平扫',
    procedureCode: 'MRI-LS-Plain',
    diagnosisName: '腰椎间盘突出症',
    diagnosisCode: 'M51.2',
    policyId: 'hz-yibao-imaging-2026',
    cityPool: ['杭州', '苏州', '南京'],
    summaryFactory: (_index, variant) => variant === 0
      ? '患者腰痛伴下肢放射痛 6 周，直腿抬高试验阳性，已完成 4 周规范保守治疗，症状缓解不明显。'
      : '患者反复腰痛 2 周，未见完整保守治疗记录，申请腰椎 MRI 明确椎间盘情况。',
    materialFactory: (index, variant) => [
      material(`lumbar-${index}-1`, '门诊病历', '骨科门诊病历', '记录主诉、现病史和直腿抬高试验。', true),
      material(`lumbar-${index}-2`, '既往治疗记录', '康复治疗记录', variant === 1 ? '' : '康复牵引和 NSAIDs 治疗 4 周。', variant !== 1),
      material(`lumbar-${index}-3`, '检查申请单', 'MRI 检查申请单', '检查目的：评估神经根受压。', true),
    ],
  },
  {
    direction: '膝关节 CT',
    title: '膝关节 CT 商保预授权',
    payer: '长青商保健康险',
    scenario: '商保预授权',
    department: '运动医学科',
    procedureName: '膝关节 CT 三维重建',
    procedureCode: 'CT-KNEE-3D',
    diagnosisName: '膝关节损伤',
    diagnosisCode: 'S83.9',
    policyId: 'shangbao-orthopedic-2026',
    cityPool: ['上海', '杭州', '苏州'],
    summaryFactory: (_index, variant) => variant === 2
      ? '患者篮球运动后膝关节肿痛，已上传 X 线初筛报告，申请 CT 三维重建评估骨性损伤。'
      : '患者运动后膝关节疼痛肿胀，申请 CT 三维重建，材料中未见 X 线初筛结果。',
    materialFactory: (index, variant) => [
      material(`knee-${index}-1`, '门诊病历', '运动医学科门诊病历', '记录损伤机制、肿胀、压痛和活动受限。', true),
      material(`knee-${index}-2`, '检查申请单', 'CT 检查申请单', '申请 CT 三维重建。', true),
      material(`knee-${index}-3`, '影像报告', '膝关节 X 线报告', variant === 2 ? 'X 线提示可疑骨性损伤。' : '', variant === 2),
    ],
  },
  {
    direction: '头颅 CT',
    title: '头颅 CT 加急审核',
    payer: '广东省基本医疗保险',
    scenario: '医保事前审核',
    department: '急诊科',
    procedureName: '头颅 CT 平扫',
    procedureCode: 'CT-HEAD-Plain',
    diagnosisName: '头痛待查',
    diagnosisCode: 'R51',
    policyId: 'gd-yibao-emergency-2026',
    cityPool: ['广州', '深圳', '厦门'],
    summaryFactory: (_index, variant) => variant === 3
      ? '患者突发剧烈头痛，病历记录意识清楚、瞳孔等大等圆、否认抗凝用药史，申请头颅 CT。'
      : '患者突发剧烈头痛伴恶心，病历未记录意识状态、神经定位体征和抗凝用药史。',
    materialFactory: (index, variant) => [
      material(`head-${index}-1`, '门诊病历', '急诊病历', variant === 3 ? '意识清楚，瞳孔等大等圆，否认抗凝用药史。' : '未记录意识状态、神经定位体征、抗凝用药史。', true),
      material(`head-${index}-2`, '检查申请单', '头颅 CT 申请单', '检查目的：排除颅内出血。', true),
    ],
  },
  {
    direction: '冠脉 CTA',
    title: '冠脉 CTA 预授权',
    payer: '华东商保健康险',
    scenario: '商保预授权',
    department: '心内科',
    procedureName: '冠状动脉 CTA',
    procedureCode: 'CTA-CORONARY',
    diagnosisName: '胸痛待查',
    diagnosisCode: 'R07.4',
    policyId: 'shangbao-cardiac-cta-2026',
    cityPool: ['上海', '南京', '杭州'],
    summaryFactory: (_index, variant) => variant === 0
      ? '患者活动后胸闷胸痛，心电图 ST-T 改变，肌钙蛋白阴性，申请冠脉 CTA 评估冠心病风险。'
      : '患者胸痛待查，材料中未见心电图或心肌标志物记录，申请冠脉 CTA。',
    materialFactory: (index, variant) => [
      material(`cta-${index}-1`, '门诊病历', '心内科门诊病历', '记录胸痛特点、危险因素和查体。', true),
      material(`cta-${index}-2`, '检验报告', '心肌标志物报告', variant === 1 ? '' : '肌钙蛋白阴性。', variant !== 1),
      material(`cta-${index}-3`, '检验报告', '心电图报告', variant === 2 ? '' : 'ST-T 改变。', variant !== 2),
    ],
  },
  {
    direction: '无痛胃肠镜',
    title: '无痛胃肠镜麻醉审核',
    payer: '成都市基本医疗保险',
    scenario: '医保事前审核',
    department: '消化内科',
    procedureName: '无痛胃肠镜检查',
    procedureCode: 'GI-ENDO-SED',
    diagnosisName: '腹痛待查',
    diagnosisCode: 'R10.4',
    policyId: 'cd-yibao-endo-2026',
    cityPool: ['成都', '重庆', '西安'],
    summaryFactory: (_index, variant) => variant === 0
      ? '患者腹痛伴便血，申请无痛胃肠镜检查，已提供麻醉评估和知情同意。'
      : '患者腹痛待查，申请无痛胃肠镜，材料中未见完整麻醉评估或知情同意。',
    materialFactory: (index, variant) => [
      material(`endo-${index}-1`, '门诊病历', '消化内科门诊病历', '记录腹痛、便血和既往史。', true),
      material(`endo-${index}-2`, '知情同意', '麻醉知情同意', variant === 1 ? '' : '已签署麻醉知情同意。', variant !== 1),
      material(`endo-${index}-3`, '检验报告', '麻醉评估记录', variant === 2 ? '' : 'ASA 分级 II 级，无明显禁忌。', variant !== 2),
    ],
  },
  {
    direction: '肿瘤靶向药',
    title: '肿瘤靶向药用药预审',
    payer: '华南商保肿瘤险',
    scenario: '商保预授权',
    department: '肿瘤科',
    procedureName: '肺癌靶向药用药预审',
    procedureCode: 'RX-ONCO-TKI',
    diagnosisName: '非小细胞肺癌',
    diagnosisCode: 'C34.9',
    policyId: 'shangbao-oncology-rx-2026',
    cityPool: ['广州', '深圳', '武汉'],
    summaryFactory: (_index, variant) => variant === 0
      ? '患者非小细胞肺癌，病理明确，基因检测提示 EGFR 突变阳性，申请靶向药用药预审。'
      : '患者肺癌术后治疗，申请靶向药，材料中未见完整病理或基因检测报告。',
    materialFactory: (index, variant) => [
      material(`rx-${index}-1`, '门诊病历', '肿瘤科病程记录', '记录诊断、分期和拟用药方案。', true),
      material(`rx-${index}-2`, '检验报告', '病理报告', variant === 1 ? '' : '病理提示非小细胞肺癌。', variant !== 1),
      material(`rx-${index}-3`, '检验报告', '基因检测报告', variant === 2 ? '' : 'EGFR 突变阳性。', variant !== 2),
    ],
  },
];

export function buildSyntheticCases(baseCases: PriorAuthCase[]) {
  const generated: PriorAuthCase[] = [];

  directions.forEach((template, directionIndex) => {
    for (let index = 1; index <= 30; index += 1) {
      const variant = index % 4;
      const city = template.cityPool[index % template.cityPool.length];
      const hospital = hospitals[(index + directionIndex) % hospitals.length];
      generated.push({
        id: `case-${template.procedureCode.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${String(index).padStart(3, '0')}`,
        title: `${template.title} #${String(index).padStart(2, '0')}`,
        direction: template.direction,
        hospital,
        city,
        payer: template.payer,
        scenario: template.scenario,
        patient: {
          displayId: `P-脱敏-${directionIndex + 1}${String(index).padStart(3, '0')}`,
          age: 28 + ((index * 7 + directionIndex * 3) % 48),
          gender: index % 2 === 0 ? '女' : '男',
        },
        request: {
          procedureName: template.procedureName,
          procedureCode: template.procedureCode,
          diagnosisName: template.diagnosisName,
          diagnosisCode: template.diagnosisCode,
          department: template.department,
          urgency: template.direction === '头颅 CT' || index % 11 === 0 ? '加急' : '常规',
        },
        clinicalSummary: template.summaryFactory(index, variant),
        materials: template.materialFactory(index, variant),
        policyIds: [template.policyId],
        status: '待预审',
        riskLevel: variant === 0 ? '低风险' : variant === 3 ? '高风险' : '中风险',
        updatedAt: `2026-06-05 ${String(8 + (index % 10)).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}`,
      });
    }
  });

  const baseIds = new Set(baseCases.map((item) => item.id));
  return [
    ...baseCases.map((item) => ({ ...item, direction: inferDirection(item) })),
    ...generated.filter((item) => !baseIds.has(item.id)),
  ];
}

function inferDirection(medicalCase: PriorAuthCase) {
  const text = `${medicalCase.title} ${medicalCase.request.procedureName}`;
  if (text.includes('腰椎')) return '腰椎 MRI';
  if (text.includes('膝关节')) return '膝关节 CT';
  if (text.includes('头颅')) return '头颅 CT';
  if (text.includes('冠脉') || text.includes('冠状动脉')) return '冠脉 CTA';
  if (text.includes('胃肠镜')) return '无痛胃肠镜';
  if (text.includes('靶向药') || text.includes('肺癌')) return '肿瘤靶向药';
  return medicalCase.direction ?? medicalCase.title.replace(/ #\d+$/, '');
}
