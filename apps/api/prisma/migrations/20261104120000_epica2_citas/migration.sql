-- Épica 2: Gestión Operativa (médicos, citas e historial)

-- Secuencia del código legible CIT-0001, CIT-0002…
CREATE SEQUENCE "Cita_codigo_seq";

-- CreateEnum
CREATE TYPE "EstadoCita" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'ATENDIDA', 'NO_ASISTIO', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoCita" AS ENUM ('CONSULTA', 'ESTUDIO');

-- CreateEnum
CREATE TYPE "AccionCita" AS ENUM ('CREADA', 'ACTUALIZADA', 'REPROGRAMADA', 'CONFIRMADA', 'CERRADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "Medico" (
    "id" TEXT NOT NULL,
    "centroId" TEXT NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "especialidad" VARCHAR(80) NOT NULL,
    "precioConsulta" DECIMAL(10,2) NOT NULL,
    "duracionMin" INTEGER NOT NULL DEFAULT 30,
    "diasSemana" INTEGER[],
    "horaInicio" VARCHAR(5) NOT NULL,
    "horaFin" VARCHAR(5) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cita" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(20) NOT NULL DEFAULT ('CIT-'::text || lpad((nextval('"Cita_codigo_seq"'::regclass))::text, 4, '0'::text)),
    "pacienteId" TEXT NOT NULL,
    "medicoId" TEXT NOT NULL,
    "centroId" TEXT NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoCita" NOT NULL DEFAULT 'CONSULTA',
    "motivo" VARCHAR(500) NOT NULL,
    "estado" "EstadoCita" NOT NULL DEFAULT 'PENDIENTE',
    "costo" DECIMAL(10,2) NOT NULL,
    "notasCierre" VARCHAR(1000),
    "motivoCancelacion" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CitaHistorial" (
    "id" TEXT NOT NULL,
    "citaId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "accion" "AccionCita" NOT NULL,
    "estadoAnterior" "EstadoCita",
    "estadoNuevo" "EstadoCita",
    "cambios" JSONB,
    "comentario" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CitaHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Medico_centroId_idx" ON "Medico"("centroId");

-- CreateIndex
CREATE INDEX "Medico_especialidad_idx" ON "Medico"("especialidad");

-- CreateIndex
CREATE UNIQUE INDEX "Cita_codigo_key" ON "Cita"("codigo");

-- CreateIndex
CREATE INDEX "Cita_estado_idx" ON "Cita"("estado");

-- CreateIndex
CREATE INDEX "Cita_fechaHora_idx" ON "Cita"("fechaHora");

-- CreateIndex
CREATE INDEX "Cita_medicoId_idx" ON "Cita"("medicoId");

-- CreateIndex
CREATE INDEX "Cita_centroId_idx" ON "Cita"("centroId");

-- CreateIndex
CREATE INDEX "Cita_pacienteId_idx" ON "Cita"("pacienteId");

-- CreateIndex
CREATE INDEX "CitaHistorial_citaId_createdAt_idx" ON "CitaHistorial"("citaId", "createdAt");

-- AddForeignKey
ALTER TABLE "Medico" ADD CONSTRAINT "Medico_centroId_fkey" FOREIGN KEY ("centroId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "Medico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_centroId_fkey" FOREIGN KEY ("centroId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitaHistorial" ADD CONSTRAINT "CitaHistorial_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "Cita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitaHistorial" ADD CONSTRAINT "CitaHistorial_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- La secuencia pertenece a la columna (se reinicia con TRUNCATE ... RESTART IDENTITY)
ALTER SEQUENCE "Cita_codigo_seq" OWNED BY "Cita"."codigo";

-- R3/R10: un médico no puede tener dos citas activas a la misma hora
CREATE UNIQUE INDEX "Cita_medico_fechaHora_activa_key" ON "Cita"("medicoId", "fechaHora")
  WHERE "estado" IN ('PENDIENTE', 'CONFIRMADA');

-- R4/R10: un paciente no puede tener dos citas activas a la misma hora
CREATE UNIQUE INDEX "Cita_paciente_fechaHora_activa_key" ON "Cita"("pacienteId", "fechaHora")
  WHERE "estado" IN ('PENDIENTE', 'CONFIRMADA');
