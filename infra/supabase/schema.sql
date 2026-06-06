-- 医审通 AI 的 Vercel/Supabase 运行时表。
-- 后端启动时会幂等执行同样的建表逻辑，此文件用于审阅和手动排障。

create table if not exists yishentong_app_state (
  state_key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table yishentong_app_state is '医审通演示数据、审核结果、Agent 轨迹与 Harness 评测状态';

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

comment on table yishentong_model_call_log is 'DeepSeek 真实调用与 fallback 审计记录';

create index if not exists idx_yishentong_model_call_created
  on yishentong_model_call_log(created_at desc);
