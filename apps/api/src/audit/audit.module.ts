import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { InternalKeyGuard } from './internal-key.guard';

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, InternalKeyGuard],
  exports: [AuditService],
})
export class AuditModule {}
