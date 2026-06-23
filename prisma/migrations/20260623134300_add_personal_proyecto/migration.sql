-- Agregar tabla personal_proyecto
-- Aplicar en producción con: npx prisma migrate deploy

CREATE TABLE `personal_proyecto` (
    `id` VARCHAR(191) NOT NULL,
    `proyectoId` VARCHAR(191) NOT NULL,
    `proyectoCodigo` VARCHAR(191) NULL,
    `proyectoNombre` VARCHAR(191) NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `documento` VARCHAR(191) NULL,
    `rol` VARCHAR(191) NOT NULL,
    `tipoContrato` VARCHAR(191) NOT NULL,
    `montoDiario` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `fechaInicio` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaFin` DATETIME(3) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `observaciones` TEXT NULL,
    `creadoPor` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `personal_proyecto_proyectoId_fkey`(`proyectoId`),
    INDEX `personal_proyecto_activo_idx`(`activo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
