import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CitasModule } from './citas/citas.module';
import { validateEnv } from './config/env.validation';
import { HealthController } from './health.controller';
import { InventarioModule } from './inventario/inventario.module';
import { MedicosModule } from './medicos/medicos.module';
import { ModulesController } from './modules/modules.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ReportesModule } from './reportes/reportes.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    MedicosModule,
    CitasModule,
    ReportesModule,
    InventarioModule,
  ],
  controllers: [HealthController, ModulesController],
})
export class AppModule {}
