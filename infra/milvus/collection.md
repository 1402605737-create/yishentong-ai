# Milvus 中文政策向量集合

集合名：`medical_policy_clause_zh`

推荐字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | VarChar primary key | 与 openGauss `policy_clause.embedding_id` 对应 |
| `policy_id` | VarChar | 政策文件编号 |
| `payer` | VarChar | 医保或商保主体 |
| `service_type` | VarChar | MRI、CT、检验、药品等 |
| `clause_no` | VarChar | 条款号 |
| `text` | VarChar | 中文政策条款 |
| `embedding` | FloatVector | 中文 embedding |

MVP 当前使用内置关键词检索降级；生产化时把 `PolicyService.retrieveForCase` 替换为 Milvus hybrid search，并保留当前规则引擎作为安全兜底。
