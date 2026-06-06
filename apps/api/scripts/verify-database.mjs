import pg from 'pg';

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  throw new Error('缺少 DATABASE_URL 环境变量');
}

const parsedUrl = new URL(rawUrl.replace(/^postgresql\+psycopg:\/\//, 'postgresql://'));
parsedUrl.searchParams.delete('sslmode');
const connectionString = parsedUrl.toString();
const pool = new pg.Pool({
  connectionString,
  max: 1,
  ssl: { rejectUnauthorized: false },
});

try {
  const identity = await pool.query('select current_database(), current_user');
  const state = await pool.query(
    "select jsonb_array_length(payload->'cases')::int as case_count from yishentong_app_state where state_key = 'default'"
  );
  console.log(JSON.stringify({
    ...identity.rows[0],
    case_count: state.rows[0]?.case_count ?? 0,
  }, null, 2));
} finally {
  await pool.end();
}
