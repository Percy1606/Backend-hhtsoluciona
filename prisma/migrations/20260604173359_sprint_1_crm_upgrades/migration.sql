/*
  Warnings:

  - Made the column `tipoCliente` on table `cliente` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `proyecto` DROP FOREIGN KEY `Proyecto_clientId_fkey`;

-- DropIndex
DROP INDEX `Proyecto_clientId_fkey` ON `proyecto`;

-- AlterTable
ALTER TABLE `cliente` ADD COLUMN `cartera` VARCHAR(191) NULL,
    ADD COLUMN `clasificacion` ENUM('MUY_RENTABLE', 'RENTABLE', 'POCO_RENTABLE') NOT NULL DEFAULT 'RENTABLE',
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `esClienteReal` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `linkedin` VARCHAR(191) NULL,
    MODIFY `diaTrabajo` VARCHAR(191) NULL,
    MODIFY `tipoCliente` ENUM('PROSPECTO', 'CLIENTE', 'CLIENTE_INACTIVO') NOT NULL DEFAULT 'PROSPECTO';

-- AlterTable
ALTER TABLE `documento` ADD COLUMN `cotizacionId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `interaccion` ADD COLUMN `cotizacionId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `proyecto` MODIFY `clientId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ACTIVIDAD_COMERCIAL` (
    `id` VARCHAR(191) NOT NULL,
    `clienteId` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `tipoActividad` ENUM('LLAMADA', 'CORREO', 'WHATSAPP', 'REUNION', 'VISITA_TECNICA', 'COTIZACION', 'SEGUIMIENTO') NOT NULL,
    `descripcion` TEXT NOT NULL,
    `fechaActividad` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `proximoSeguimiento` DATETIME(3) NULL,
    `estado` ENUM('PENDIENTE', 'COMPLETADA', 'CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NOTIFICACION` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `mensaje` TEXT NOT NULL,
    `tipo` ENUM('SEGUIMIENTO', 'VISITA', 'COTIZACION', 'CLIENTE', 'SISTEMA') NOT NULL,
    `leida` BOOLEAN NOT NULL DEFAULT false,
    `fechaProgramada` DATETIME(3) NULL,
    `actividadComercialId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FICHA_TECNICA` (
    `id` VARCHAR(191) NOT NULL,
    `clienteId` VARCHAR(191) NOT NULL,
    `tecnicoId` VARCHAR(191) NOT NULL,
    `fechaVisita` DATETIME(3) NOT NULL,
    `observaciones` TEXT NULL,
    `hallazgos` TEXT NULL,
    `recomendaciones` TEXT NULL,
    `estado` VARCHAR(191) NOT NULL,
    `firmaTecnico` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FICHA_TECNICA_ADJUNTO` (
    `id` VARCHAR(191) NOT NULL,
    `fichaTecnicaId` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `COTIZACION` (
    `id` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `referencia` TEXT NULL,
    `objetivo` TEXT NULL,
    `alcance` JSON NULL,
    `consideraciones` TEXT NULL,
    `entregables` TEXT NULL,
    `monto` DOUBLE NOT NULL DEFAULT 0,
    `estado` VARCHAR(191) NOT NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `plazo` VARCHAR(191) NULL DEFAULT '7 días',
    `validez` VARCHAR(191) NULL DEFAULT '15 días',
    `formaPago` TEXT NULL,
    `observaciones` TEXT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `cotizacionPadreId` VARCHAR(191) NULL,
    `proyectoGeneradoId` VARCHAR(191) NULL,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaActualizacion` DATETIME(3) NULL,

    UNIQUE INDEX `COTIZACION_codigo_key`(`codigo`),
    UNIQUE INDEX `COTIZACION_proyectoGeneradoId_key`(`proyectoGeneradoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ACTIVIDAD_COMERCIAL` ADD CONSTRAINT `ACTIVIDAD_COMERCIAL_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `CLIENTE`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NOTIFICACION` ADD CONSTRAINT `NOTIFICACION_actividadComercialId_fkey` FOREIGN KEY (`actividadComercialId`) REFERENCES `ACTIVIDAD_COMERCIAL`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FICHA_TECNICA` ADD CONSTRAINT `FICHA_TECNICA_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `CLIENTE`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FICHA_TECNICA` ADD CONSTRAINT `FICHA_TECNICA_tecnicoId_fkey` FOREIGN KEY (`tecnicoId`) REFERENCES `Responsable`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FICHA_TECNICA_ADJUNTO` ADD CONSTRAINT `FICHA_TECNICA_ADJUNTO_fichaTecnicaId_fkey` FOREIGN KEY (`fichaTecnicaId`) REFERENCES `FICHA_TECNICA`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `INTERACCION` ADD CONSTRAINT `INTERACCION_cotizacionId_fkey` FOREIGN KEY (`cotizacionId`) REFERENCES `COTIZACION`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `COTIZACION` ADD CONSTRAINT `COTIZACION_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `CLIENTE`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `COTIZACION` ADD CONSTRAINT `COTIZACION_cotizacionPadreId_fkey` FOREIGN KEY (`cotizacionPadreId`) REFERENCES `COTIZACION`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `COTIZACION` ADD CONSTRAINT `COTIZACION_proyectoGeneradoId_fkey` FOREIGN KEY (`proyectoGeneradoId`) REFERENCES `Proyecto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Proyecto` ADD CONSTRAINT `Proyecto_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `CLIENTE`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Documento` ADD CONSTRAINT `Documento_cotizacionId_fkey` FOREIGN KEY (`cotizacionId`) REFERENCES `COTIZACION`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
