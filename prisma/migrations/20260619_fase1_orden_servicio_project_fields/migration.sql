-- Fase 1: Agregar tabla OrdenDeServicio y campos al Proyecto
-- Aplicar en produccion con: npx prisma migrate deploy
-- Este script es SEGURO: solo agrega, no elimina ni modifica datos existentes.

-- ============================================================
-- 1. Nuevos campos en tabla `proyecto`
-- ============================================================

ALTER TABLE `proyecto`
  ADD COLUMN `estadoFinanciero` VARCHAR(191) NULL DEFAULT 'SinPago',
  ADD COLUMN `autorizaCompras`  BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN `estadoLogistica`  VARCHAR(191) NULL DEFAULT 'PendienteRevision';

-- ============================================================
-- 2. Nueva tabla `orden_de_servicio`
-- ============================================================

CREATE TABLE `orden_de_servicio` (
    `id`             VARCHAR(191) NOT NULL,
    `codigo`         VARCHAR(191) NOT NULL,
    `cotizacionId`   VARCHAR(191) NOT NULL,
    `proyectoId`     VARCHAR(191) NULL,
    `fechaEmision`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `estado`         VARCHAR(191) NOT NULL DEFAULT 'Activo',
    `terminos`       TEXT         NULL,
    `observaciones`  TEXT         NULL,
    `archivoUrl`     VARCHAR(191) NULL,
    `createdAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`      DATETIME(3)  NOT NULL,

    UNIQUE INDEX `orden_de_servicio_codigo_key`(`codigo`),
    INDEX `orden_de_servicio_cotizacionId_fkey`(`cotizacionId`),
    INDEX `orden_de_servicio_proyectoId_fkey`(`proyectoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================
-- 3. Foreign keys de orden_de_servicio
-- ============================================================

ALTER TABLE `orden_de_servicio`
  ADD CONSTRAINT `orden_de_servicio_cotizacionId_fkey`
    FOREIGN KEY (`cotizacionId`) REFERENCES `cotizacion`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `orden_de_servicio`
  ADD CONSTRAINT `orden_de_servicio_proyectoId_fkey`
    FOREIGN KEY (`proyectoId`) REFERENCES `proyecto`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
