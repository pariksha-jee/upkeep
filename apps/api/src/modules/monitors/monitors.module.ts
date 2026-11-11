import { Module } from '@nestjs/common';
import { MonitorsController } from './monitors.controller.js';
import { MonitorsService } from './monitors.service.js';
import { ChecksService } from './checks.service.js';

@Module({
  controllers: [MonitorsController],
  providers: [MonitorsService, ChecksService],
  exports: [MonitorsService, ChecksService],
})
export class MonitorsModule {}
