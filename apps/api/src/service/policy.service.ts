import { Inject, Provide } from '@midwayjs/core';
import { retrievePolicyClauses } from '../domain/rule-engine';
import { PriorAuthCase } from '../interface';
import { RepositoryService } from './repository.service';

@Provide('policyService')
export class PolicyService {
  @Inject()
  repositoryService!: RepositoryService;

  listPolicies() {
    return this.repositoryService.listPolicies();
  }

  retrieveForCase(medicalCase: PriorAuthCase) {
    const policies = this.repositoryService.listPolicies();
    return retrievePolicyClauses(medicalCase, policies);
  }
}
