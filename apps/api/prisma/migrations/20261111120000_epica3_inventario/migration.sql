-- Épica 3: Gestión Logística (recursos, lotes y movimientos de inventario)

-- Secuencias de los códigos legibles REC-0001 y MOV-0001
CREATE SEQUENCE "Recurso_codigo_seq";
CREATE SEQUENCE "Movimiento_codigo_seq";

-- CreateEnum
CREATE TYPE "TipoRecurso" AS ENUM ('INSUMO', 'EQUIPO');

-- CreateEnum
CREATE TYPE "CategoriaRecurso" AS ENUM ('MATERIAL_MEDICO', 'MEDICAMENTO', 'REACTIVO', 'EQUIPO_MEDICO', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoEquipo" AS ENUM ('DISPONIBLE', 'ASIGNADO', 'MANTENIMIENTO', 'BAJA');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE', 'ASIGNACION', 'DEVOLUCION');

-- CreateTable
CREATE TABLE "Recurso" (
    "id" TEXT NOT NULL,
    "centroId" TEXT NOT NULL,
    "codigo" VARCHAR(20) NOT NULL DEFAULT ('REC-'::text || lpad((nextval('"Recurso_codigo_seq"'::regclass))::text, 4, '0'::text)),
    "nombre" VARCHAR(120) NOT NULL,
    "tipo" "TipoRecurso" NOT NULL,
    "categoria" "CategoriaRecurso" NOT NULL,
    "unidad" VARCHAR(30) NOT NULL,
    "stockActual" INTEGER,
    "stockMinimo" INTEGER,
    "costoUnitario" DECIMAL(10,2) NOT NULL,
    "requiereVencimiento" BOOLEAN NOT NULL DEFAULT false,
    "estadoEquipo" "EstadoEquipo",
    "numeroSerie" VARCHAR(80),
    "medicoAsignadoId" TEXT,
    "devolucionPrevista" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recurso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lote" (
    "id" TEXT NOT NULL,
    "recursoId" TEXT NOT NULL,
    "numeroLote" VARCHAR(60) NOT NULL,
    "fechaVencimiento" DATE NOT NULL,
    "cantidadDisponible" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movimiento" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(20) NOT NULL DEFAULT ('MOV-'::text || lpad((nextval('"Movimiento_codigo_seq"'::regclass))::text, 4, '0'::text)),
    "recursoId" TEXT NOT NULL,
    "centroId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "stockAnterior" INTEGER,
    "stockNuevo" INTEGER,
    "estadoEquipoAnterior" "EstadoEquipo",
    "estadoEquipoNuevo" "EstadoEquipo",
    "loteId" TEXT,
    "medicoId" TEXT,
    "citaId" TEXT,
    "motivo" VARCHAR(500) NOT NULL,
    "referencia" VARCHAR(120),
    "costoUnitario" DECIMAL(10,2),
    "fechaDevolucionPrevista" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Recurso_codigo_key" ON "Recurso"("codigo");

-- CreateIndex
CREATE INDEX "Recurso_centroId_idx" ON "Recurso"("centroId");

-- CreateIndex
CREATE INDEX "Recurso_tipo_idx" ON "Recurso"("tipo");

-- CreateIndex
CREATE INDEX "Recurso_categoria_idx" ON "Recurso"("categoria");

-- CreateIndex
CREATE UNIQUE INDEX "Recurso_centroId_nombre_key" ON "Recurso"("centroId", "nombre");

-- CreateIndex
CREATE INDEX "Lote_recursoId_fechaVencimiento_idx" ON "Lote"("recursoId", "fechaVencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "Lote_recursoId_numeroLote_key" ON "Lote"("recursoId", "numeroLote");

-- CreateIndex
CREATE UNIQUE INDEX "Movimiento_codigo_key" ON "Movimiento"("codigo");

-- CreateIndex
CREATE INDEX "Movimiento_centroId_createdAt_idx" ON "Movimiento"("centroId", "createdAt");

-- CreateIndex
CREATE INDEX "Movimiento_recursoId_createdAt_idx" ON "Movimiento"("recursoId", "createdAt");

-- CreateIndex
CREATE INDEX "Movimiento_tipo_idx" ON "Movimiento"("tipo");

-- CreateIndex
CREATE INDEX "Movimiento_medicoId_idx" ON "Movimiento"("medicoId");

-- CreateIndex
CREATE INDEX "Movimiento_citaId_idx" ON "Movimiento"("citaId");

-- AddForeignKey
ALTER TABLE "Recurso" ADD CONSTRAINT "Recurso_centroId_fkey" FOREIGN KEY ("centroId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recurso" ADD CONSTRAINT "Recurso_medicoAsignadoId_fkey" FOREIGN KEY ("medicoAsignadoId") REFERENCES "Medico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_recursoId_fkey" FOREIGN KEY ("recursoId") REFERENCES "Recurso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_recursoId_fkey" FOREIGN KEY ("recursoId") REFERENCES "Recurso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_centroId_fkey" FOREIGN KEY ("centroId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "Medico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "Cita"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Las secuencias pertenecen a sus columnas (se reinician con TRUNCATE ... RESTART IDENTITY)
ALTER SEQUENCE "Recurso_codigo_seq" OWNED BY "Recurso"."codigo";
ALTER SEQUENCE "Movimiento_codigo_seq" OWNED BY "Movimiento"."codigo";

-- L2/L7/L9: el stock y los lotes nunca pueden quedar negativos (última barrera)
ALTER TABLE "Recurso" ADD CONSTRAINT "Recurso_stockActual_no_negativo" CHECK ("stockActual" IS NULL OR "stockActual" >= 0);
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_cantidadDisponible_no_negativa" CHECK ("cantidadDisponible" >= 0);
-- L1: las cantidades de los movimientos son enteros mayores que 0
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_cantidad_positiva" CHECK ("cantidad" > 0);
