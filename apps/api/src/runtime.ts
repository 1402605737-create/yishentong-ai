import { DeepSeekService } from './service/deepseek.service';
import { EvalHarnessService } from './service/eval-harness.service';
import { PolicyService } from './service/policy.service';
import { RepositoryService } from './service/repository.service';
import { ReviewService } from './service/review.service';

let ready: Promise<RuntimeServices> | undefined;

export interface RuntimeServices {
  repositoryService: RepositoryService;
  reviewService: ReviewService;
  policyService: PolicyService;
  evalHarnessService: EvalHarnessService;
}

export function getRuntime() {
  if (!ready) {
    ready = createRuntime();
  }
  return ready;
}

async function createRuntime(): Promise<RuntimeServices> {
  const repositoryService = new RepositoryService();
  await repositoryService.init();

  const policyService = new PolicyService();
  policyService.repositoryService = repositoryService;

  const deepSeekService = new DeepSeekService();
  deepSeekService.repositoryService = repositoryService;

  const reviewService = new ReviewService();
  reviewService.repositoryService = repositoryService;
  reviewService.policyService = policyService;
  reviewService.deepSeekService = deepSeekService;

  const evalHarnessService = new EvalHarnessService();
  evalHarnessService.repositoryService = repositoryService;
  evalHarnessService.policyService = policyService;

  return {
    repositoryService,
    reviewService,
    policyService,
    evalHarnessService,
  };
}
