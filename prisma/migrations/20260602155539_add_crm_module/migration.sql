-- AlterTable
ALTER TABLE `actividad` MODIFY `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `fechaInicio` DATETIME(3) NULL,
    MODIFY `fechaFin` DATETIME(3) NULL,
    MODIFY `fechaVencimiento` DATETIME(3) NULL,
    MODIFY `fechaDesbloqueoChecklist` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `comentario` MODIFY `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `documento` MODIFY `fechaSubida` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `fechaVencimiento` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `entregable` MODIFY `fechaEntrega` DATETIME(3) NULL,
    MODIFY `fechaAprobacion` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `evaluaciontecnica` MODIFY `fechaEvaluacion` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `evidencia` MODIFY `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `expedientetecnico` MODIFY `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `fechaActualizacion` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `historialcambio` MODIFY `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `indicadoravance` MODIFY `ultimaActualizacion` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `ingenieriadiseno` MODIFY `fechaInicio` DATETIME(3) NOT NULL,
    MODIFY `fechaFinEstimada` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `planodiseno` MODIFY `fecha` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `proyecto` MODIFY `fechaInicio` DATETIME(3) NOT NULL,
    MODIFY `fechaFinEstimada` DATETIME(3) NOT NULL,
    MODIFY `fechaFinReal` DATETIME(3) NULL,
    MODIFY `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `fechaActualizacion` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `reportediario` MODIFY `fecha` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `suboperacion` MODIFY `fechaInicio` DATETIME(3) NOT NULL,
    MODIFY `fechaFinEstimada` DATETIME(3) NOT NULL,
    MODIFY `fechaFinReal` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `subtarea` MODIFY `fechaVencimiento` DATETIME(3) NULL,
    MODIFY `fechaCompletada` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `validacionrequerida` MODIFY `fechaValidacion` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `CLIENTE` (
    `id` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `empresa` VARCHAR(191) NOT NULL,
    `ruc` VARCHAR(191) NOT NULL,
    `direccion` VARCHAR(191) NOT NULL,
    `tarifa` VARCHAR(191) NOT NULL,
    `contacto` VARCHAR(191) NOT NULL,
    `telefono` VARCHAR(191) NULL,
    `cargo` VARCHAR(191) NULL,
    `correo` VARCHAR(191) NULL,
    `asignadoA` VARCHAR(191) NOT NULL,
    `diaTrabajo` VARCHAR(191) NOT NULL,
    `estado` VARCHAR(191) NOT NULL,
    `prioridad` VARCHAR(191) NOT NULL,
    `accion` VARCHAR(191) NOT NULL,
    `ultimoContacto` DATETIME(3) NULL,
    `proximoSeguimiento` DATETIME(3) NULL,
    `observaciones` TEXT NULL,
    `zona` VARCHAR(191) NOT NULL,
    `semaforo` VARCHAR(191) NOT NULL,
    `temperatura` VARCHAR(191) NOT NULL,
    `montoEstimado` DOUBLE NOT NULL DEFAULT 0,
    `probabilidad` DOUBLE NOT NULL DEFAULT 0,
    `ventaProyectada` DOUBLE NOT NULL DEFAULT 0,
    `tipoCliente` VARCHAR(191) NULL,
    `etapaComercial` VARCHAR(191) NOT NULL,
    `hallazgosTecnicos` JSON NULL,
    `solucionesPropuestas` JSON NULL,
    `propuestaTecnicaUrl` VARCHAR(191) NULL,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaActualizacion` DATETIME(3) NULL,

    UNIQUE INDEX `CLIENTE_codigo_key`(`codigo`),
    UNIQUE INDEX `CLIENTE_ruc_key`(`ruc`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `INTERACCION` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tipo` VARCHAR(191) NOT NULL,
    `accion` VARCHAR(191) NOT NULL,
    `observaciones` TEXT NOT NULL,
    `usuario` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `INTERACCION` ADD CONSTRAINT `INTERACCION_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `CLIENTE`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Proyecto` ADD CONSTRAINT `Proyecto_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `CLIENTE`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Documento` ADD CONSTRAINT `Documento_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `CLIENTE`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
