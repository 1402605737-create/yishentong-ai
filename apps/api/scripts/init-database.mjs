import repositoryModule from '../dist/service/repository.service.js';

const { RepositoryService } = repositoryModule;
const repository = new RepositoryService();

await repository.init();
await repository.flush();

const health = await repository.databaseHealth();
console.log(JSON.stringify({
  ...health,
  caseCount: repository.listCases().length,
  policyCount: repository.listPolicies().length,
}, null, 2));
