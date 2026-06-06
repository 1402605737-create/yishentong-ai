export default {
  keys: 'yishentong-ai-local-secret',
  koa: {
    port: Number(process.env.API_PORT ?? 7101),
  },
  bodyParser: {
    jsonLimit: '8mb',
    formLimit: '8mb',
    textLimit: '8mb',
  },
};
