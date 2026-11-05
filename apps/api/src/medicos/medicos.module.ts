import { Module } from '@nestjs/common';
import { MedicosController } from './medicos.controller';
import { MedicosService } from './medicos.service';

@Module({
  controllers: [MedicosController],
  providers: [MedicosService],
  exports: [MedicosService],
})
export class MedicosModule {}
