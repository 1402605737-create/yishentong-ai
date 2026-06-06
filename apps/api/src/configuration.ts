import { Configuration } from '@midwayjs/core';
import * as koa from '@midwayjs/koa';
import { join } from 'path';
import './controller/api.controller';
import './service/deepseek.service';
import './service/eval-harness.service';
import './service/policy.service';
import './service/repository.service';
import './service/review.service';

@Configuration({
  imports: [koa],
  importConfigs: [join(__dirname, './config')],
})
export class MainConfiguration {
}
