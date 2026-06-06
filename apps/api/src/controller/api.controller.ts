import { Body, Controller, Get, Param, Post } from '@midwayjs/core';
import { getRuntime } from '../runtime';

@Controller('/api')
export class ApiController {
  @Get('/health')
  async health() {
    const { repositoryService } = await getRuntime();
    const databaseHealth = await repositoryService.databaseHealth();
    return {
      ok: true,
      name: '医审通 AI API',
      model: process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash',
      deepseekConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
      deepseek_configured: Boolean(process.env.DEEPSEEK_API_KEY),
      database: databaseHealth.database,
      database_connected: databaseHealth.connected,
      case_count: repositoryService.listCases().length,
    };
  }

  @Get('/cases')
  async listCases() {
    const { repositoryService, reviewService } = await getRuntime();
    return {
      data: repositoryService.listCases().map((medicalCase) => ({
        ...medicalCase,
        latestReview: reviewService.getLatestReview(medicalCase.id),
      })),
    };
  }

  @Get('/dashboard/summary')
  async dashboardSummary() {
    const { repositoryService } = await getRuntime();
    return {
      data: repositoryService.getCaseSummary(),
    };
  }

  @Get('/cases/:id')
  async getCase(@Param('id') id: string) {
    const { repositoryService, reviewService } = await getRuntime();
    const medicalCase = repositoryService.findCase(id);
    return {
      data: medicalCase,
      latestReview: medicalCase ? reviewService.getLatestReview(id) : undefined,
    };
  }

  @Post('/cases/:id/review')
  async reviewCase(@Param('id') id: string, @Body() body: { force?: boolean }) {
    const { reviewService, repositoryService } = await getRuntime();
    const review = body?.force ? undefined : reviewService.getLatestReview(id);
    const response = {
      data: review ?? await reviewService.reviewCase(id),
    };
    await repositoryService.flush();
    return response;
  }

  @Post('/reviews/batch')
  async reviewBatch(@Body() body: { limit?: number; direction?: string; useModel?: boolean }) {
    const { reviewService, repositoryService } = await getRuntime();
    const response = {
      data: await reviewService.reviewBatch(body),
    };
    await repositoryService.flush();
    return response;
  }

  @Post('/demo/reset')
  async resetDemo() {
    const { repositoryService } = await getRuntime();
    repositoryService.resetDemoData();
    await repositoryService.flush();
    return {
      data: repositoryService.getCaseSummary(),
    };
  }

  @Get('/policies')
  async listPolicies() {
    const { policyService } = await getRuntime();
    return {
      data: policyService.listPolicies(),
    };
  }

  @Get('/evals')
  async listEvals() {
    const { evalHarnessService } = await getRuntime();
    return {
      data: {
        cases: evalHarnessService.listEvalCases(),
        runs: evalHarnessService.listRuns(),
      },
    };
  }

  @Get('/prompts')
  async listPrompts() {
    const { evalHarnessService } = await getRuntime();
    return {
      data: evalHarnessService.listPromptVersions(),
    };
  }

  @Post('/evals/run')
  async runEvals() {
    const { evalHarnessService, repositoryService } = await getRuntime();
    const response = {
      data: evalHarnessService.runRegression(),
    };
    await repositoryService.flush();
    return response;
  }

  @Post('/evals/compare')
  async comparePrompts(@Body() body: { promptIds?: string[] }) {
    const { evalHarnessService } = await getRuntime();
    return {
      data: evalHarnessService.comparePromptVersions(body?.promptIds),
    };
  }

  @Get('/model-calls')
  async listModelCalls() {
    const { repositoryService } = await getRuntime();
    return {
      data: repositoryService.listModelCalls(),
    };
  }
}
