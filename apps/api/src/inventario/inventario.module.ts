import { Module } from '@nestjs/common';
import {
  InventarioReportesController,
  MovimientosController,
  RecursosController,
} from './inventario.controller';
import { InventarioReportesService } from './inventario-reportes.service';
import { MovimientosService } from './movimientos.service';
import { RecursosService } from './recursos.service';

/** Épica 3: inventario de los centros (recursos, lotes, movimientos y reportes). */
@Module({
  controllers: [
    RecursosController,
    MovimientosController,
    InventarioReportesController,
  ],
  providers: [RecursosService, MovimientosService, InventarioReportesService],
})
export class InventarioModule {}
