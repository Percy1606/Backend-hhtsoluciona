-- DropForeignKey
ALTER TABLE `proyecto` DROP FOREIGN KEY `Proyecto_clientId_fkey`;

-- DropIndex
DROP INDEX `Proyecto_clientId_fkey` ON `proyecto`;

-- AlterTable
ALTER TABLE `cliente` MODIFY `diaTrabajo` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `documento` ADD COLUMN `cotizacionId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `interaccion` ADD COLUMN `cotizacionId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `proyecto` MODIFY `clientId` VARCHAR(191) NULL;

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
