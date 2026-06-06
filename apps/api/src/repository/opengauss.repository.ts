import { Pool } from 'pg';
import { AiReviewResult, PriorAuthCase } from '../interface';

export class OpenGaussRepository {
  private pool: Pool;

  constructor(connectionString = process.env.OPENGAUSS_URL) {
    if (!connectionString) {
      throw new Error('OPENGAUSS_URL is required when DB_DRIVER=opengauss');
    }
    this.pool = new Pool({ connectionString });
  }

  async listCases(): Promise<PriorAuthCase[]> {
    const result = await this.pool.query('select payload from auth_case order by updated_at desc');
    return result.rows.map((row) => row.payload as PriorAuthCase);
  }

  async saveReview(review: AiReviewResult) {
    await this.pool.query(
      `insert into ai_review_result(id, case_id, status, risk_level, model_name, payload)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (id) do update set payload = excluded.payload`,
      [review.id, review.caseId, review.status, review.riskLevel, review.model, review]
    );
  }
}
