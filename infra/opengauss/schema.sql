create table if not exists auth_case (
  id varchar(64) primary key,
  title varchar(160) not null,
  scenario varchar(32) not null,
  payer varchar(120) not null,
  status varchar(32) not null,
  risk_level varchar(32) not null,
  payload jsonb not null,
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp
);

comment on table auth_case is '中文医疗事前审核案件';
comment on column auth_case.payload is '脱敏后的案件快照，包含申请项目、临床摘要和材料清单';

create table if not exists clinical_material (
  id varchar(64) primary key,
  case_id varchar(64) not null references auth_case(id),
  material_type varchar(64) not null,
  title varchar(160) not null,
  content text,
  present boolean not null default true,
  payload jsonb not null,
  created_at timestamptz default current_timestamp
);

comment on table clinical_material is '病历、申请单、影像报告等审核材料';

create table if not exists policy_clause (
  id varchar(64) primary key,
  policy_id varchar(64) not null,
  payer varchar(120) not null,
  title varchar(200) not null,
  clause_no varchar(64) not null,
  service_type varchar(64) not null,
  clause_text text not null,
  tags text[] not null default '{}',
  embedding_id varchar(128),
  effective_date date not null
);

comment on table policy_clause is '医保和商保中文政策条款';
comment on column policy_clause.embedding_id is 'Milvus 向量记录主键';

create table if not exists ai_review_result (
  id varchar(64) primary key,
  case_id varchar(64) not null references auth_case(id),
  status varchar(32) not null,
  risk_level varchar(32) not null,
  model_name varchar(80) not null,
  payload jsonb not null,
  created_at timestamptz default current_timestamp
);

comment on table ai_review_result is 'AI 预审结果、缺件清单、政策引用和 trace';

create table if not exists model_trace (
  id varchar(64) primary key,
  review_id varchar(64) not null references ai_review_result(id),
  stage varchar(80) not null,
  actor varchar(40) not null,
  latency_ms integer not null,
  token_count integer,
  payload jsonb not null,
  created_at timestamptz default current_timestamp
);

comment on table model_trace is '模型调用、政策检索、规则引擎和 harness 安全闸门链路';

create table if not exists eval_dataset (
  id varchar(64) primary key,
  name varchar(160) not null,
  category varchar(64) not null,
  input_case_id varchar(64) not null,
  expected text not null,
  payload jsonb not null,
  created_at timestamptz default current_timestamp
);

comment on table eval_dataset is '中文医疗审核评测集';

create table if not exists eval_result (
  id varchar(64) primary key,
  model_name varchar(80) not null,
  total integer not null,
  passed integer not null,
  failed integer not null,
  false_ready_rate numeric(6,4) not null,
  missing_doc_recall numeric(6,4) not null,
  citation_grounding numeric(6,4) not null,
  avg_latency_ms integer not null,
  payload jsonb not null,
  created_at timestamptz default current_timestamp
);

comment on table eval_result is '回归评测运行结果';

create index if not exists idx_auth_case_status on auth_case(status);
create index if not exists idx_policy_clause_payer_service on policy_clause(payer, service_type);
create index if not exists idx_ai_review_case_created on ai_review_result(case_id, created_at desc);
