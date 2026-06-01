-- CreateTable
CREATE TABLE `Responsable` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `area` ENUM('Steven', 'Diego', 'Guillermo', 'Mario') NOT NULL,
    `cargo` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `telefono` VARCHAR(191) NULL,
    `avatar` VARCHAR(191) NULL,
    `color` VARCHAR(191) NOT NULL,
    `esSubresponsable` BOOLEAN NULL DEFAULT false,
    `reportesA` VARCHAR(191) NULL,
    `activo` BOOLEAN NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Proyecto` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NULL,
    `estado` ENUM('Planificacion', 'EnEjecucion', 'Detenido', 'Finalizado') NOT NULL,
    `semaforo` ENUM('Verde', 'Amarillo', 'Rojo') NOT NULL,
    `prioridad` ENUM('Baja', 'Media', 'Alta', 'Critica') NOT NULL,
    `fechaInicio` DATE NOT NULL,
    `fechaFinEstimada` DATE NOT NULL,
    `fechaFinReal` DATE NULL,
    `responsablePrincipalId` VARCHAR(191) NOT NULL,
    `responsablesAdicionales` JSON NOT NULL,
    `area` ENUM('Steven', 'Diego', 'Guillermo', 'Mario') NOT NULL,
    `avance` DOUBLE NOT NULL DEFAULT 0,
    `avanceCalculado` DOUBLE NOT NULL DEFAULT 0,
    `costoPresupuestado` DOUBLE NULL,
    `costoReal` DOUBLE NULL,
    `creadoPor` VARCHAR(191) NULL,
    `fechaCreacion` DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `actualizadoPor` VARCHAR(191) NULL,
    `fechaActualizacion` DATE NULL,

    UNIQUE INDEX `Proyecto_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Actividad` (
    `id` VARCHAR(191) NOT NULL,
    `proyectoId` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NOT NULL,
    `tipo` ENUM('Tecnica', 'Administrativa', 'Logistica', 'Documental', 'Validacion') NOT NULL,
    `prioridad` ENUM('Baja', 'Media', 'Alta', 'Critica') NOT NULL,
    `estado` ENUM('Pendiente', 'EnProgreso', 'Completada', 'Validada', 'Bloqueada') NOT NULL,
    `fechaCreacion` DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `fechaInicio` DATE NULL,
    `fechaFin` DATE NULL,
    `fechaVencimiento` DATE NULL,
    `responsablePrincipalId` VARCHAR(191) NOT NULL,
    `responsablesApoyo` JSON NOT NULL,
    `checklistBloqueado` BOOLEAN NULL DEFAULT false,
    `motivoBloqueoChecklist` VARCHAR(191) NULL,
    `desbloqueadoPor` VARCHAR(191) NULL,
    `fechaDesbloqueoChecklist` DATE NULL,
    `observaciones` TEXT NULL,
    `seguimientoOperativo` TEXT NULL,
    `progreso` DOUBLE NOT NULL DEFAULT 0,
    `ponderacion` DOUBLE NULL,
    `orden` INTEGER NOT NULL,
    `padreId` VARCHAR(191) NULL,
    `esSuboperacion` BOOLEAN NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subtarea` (
    `id` VARCHAR(191) NOT NULL,
    `actividadId` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NOT NULL,
    `completada` BOOLEAN NOT NULL DEFAULT false,
    `responsableId` VARCHAR(191) NULL,
    `fechaVencimiento` DATE NULL,
    `fechaCompletada` DATE NULL,
    `bloqueada` BOOLEAN NULL DEFAULT false,
    `motivoBloqueo` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ValidacionRequerida` (
    `id` VARCHAR(191) NOT NULL,
    `actividadId` VARCHAR(191) NOT NULL,
    `tipo` ENUM('Tecnica', 'Campo', 'Documental', 'Calidad') NOT NULL,
    `area` ENUM('Steven', 'Diego', 'Guillermo', 'Mario') NOT NULL,
    `estado` ENUM('Pendiente', 'Aprobada', 'Rechazada', 'Observada') NOT NULL,
    `validadoPor` VARCHAR(191) NULL,
    `fechaValidacion` DATE NULL,
    `observaciones` TEXT NULL,
    `evidenciaUrl` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Comentario` (
    `id` VARCHAR(191) NOT NULL,
    `proyectoId` VARCHAR(191) NULL,
    `actividadId` VARCHAR(191) NULL,
    `usuario` VARCHAR(191) NOT NULL,
    `usuarioArea` ENUM('Steven', 'Diego', 'Guillermo', 'Mario') NOT NULL,
    `contenido` TEXT NOT NULL,
    `fecha` DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `esInterno` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Evidencia` (
    `id` VARCHAR(191) NOT NULL,
    `proyectoId` VARCHAR(191) NULL,
    `actividadId` VARCHAR(191) NULL,
    `reporteDiarioId` VARCHAR(191) NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `tamano` VARCHAR(191) NOT NULL,
    `subidoPor` VARCHAR(191) NOT NULL,
    `fecha` DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `descripcion` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EvaluacionTecnica` (
    `id` VARCHAR(191) NOT NULL,
    `proyectoId` VARCHAR(191) NOT NULL,
    `fechaEvaluacion` DATE NOT NULL,
    `evaluadoPor` VARCHAR(191) NOT NULL,
    `hallazgos` JSON NOT NULL,
    `solucionesPropuestas` JSON NOT NULL,
    `recomendaciones` TEXT NOT NULL,
    `estado` VARCHAR(191) NOT NULL,
    `documentoUrl` VARCHAR(191) NULL,

    UNIQUE INDEX `EvaluacionTecnica_proyectoId_key`(`proyectoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IngenieriaDiseno` (
    `id` VARCHAR(191) NOT NULL,
    `proyectoId` VARCHAR(191) NOT NULL,
    `fechaInicio` DATE NOT NULL,
    `fechaFinEstimada` DATE NULL,
    `ingenieroResponsable` VARCHAR(191) NOT NULL,
    `especificaciones` JSON NOT NULL,
    `estado` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `IngenieriaDiseno_proyectoId_key`(`proyectoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlanoDiseno` (
    `id` VARCHAR(191) NOT NULL,
    `ingenieriaDisenoId` VARCHAR(191) NOT NULL,
    `numero` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NULL,
    `url` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `fecha` DATE NOT NULL,
    `estado` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExpedienteTecnico` (
    `id` VARCHAR(191) NOT NULL,
    `proyectoId` VARCHAR(191) NOT NULL,
    `numeroExpediente` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NULL,
    `estado` VARCHAR(191) NOT NULL,
    `fechaCreacion` DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `fechaActualizacion` DATE NOT NULL,

    UNIQUE INDEX `ExpedienteTecnico_proyectoId_key`(`proyectoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Documento` (
    `id` VARCHAR(191) NOT NULL,
    `proyectoId` VARCHAR(191) NULL,
    `expedienteTecnicoId` VARCHAR(191) NULL,
    `clientId` VARCHAR(191) NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `tipo` ENUM('Tecnica', 'Administrativa', 'Legal', 'Financiero', 'Otro') NOT NULL,
    `subtype` VARCHAR(191) NULL,
    `numero` VARCHAR(191) NULL,
    `url` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NULL,
    `estado` ENUM('Borrador', 'PendienteRevision', 'Aprobado', 'Obsoleto') NOT NULL,
    `subidoPor` VARCHAR(191) NOT NULL,
    `fechaSubida` DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `fechaVencimiento` DATE NULL,
    `observaciones` TEXT NULL,
    `esEntregable` BOOLEAN NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Suboperacion` (
    `id` VARCHAR(191) NOT NULL,
    `proyectoId` VARCHAR(191) NOT NULL,
    `actividadPadreId` VARCHAR(191) NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NOT NULL,
    `tipo` ENUM('Tecnica', 'Administrativa', 'Logistica', 'Documental', 'Validacion') NOT NULL,
    `responsablePrincipalId` VARCHAR(191) NOT NULL,
    `responsablesApoyo` JSON NOT NULL,
    `fechaInicio` DATE NOT NULL,
    `fechaFinEstimada` DATE NOT NULL,
    `fechaFinReal` DATE NULL,
    `progreso` DOUBLE NOT NULL DEFAULT 0,
    `estado` ENUM('Pendiente', 'EnProgreso', 'Completada', 'Validada', 'Bloqueada') NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Entregable` (
    `id` VARCHAR(191) NOT NULL,
    `suboperacionId` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NULL,
    `estado` VARCHAR(191) NOT NULL,
    `fechaEntrega` DATE NULL,
    `fechaAprobacion` DATE NULL,
    `aprobadoPor` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReporteDiario` (
    `id` VARCHAR(191) NOT NULL,
    `proyectoId` VARCHAR(191) NOT NULL,
    `fecha` DATE NOT NULL,
    `usuario` VARCHAR(191) NOT NULL,
    `usuarioArea` ENUM('Steven', 'Diego', 'Guillermo', 'Mario') NOT NULL,
    `actividades` TEXT NOT NULL,
    `hallazgos` TEXT NOT NULL,
    `personal` TEXT NOT NULL,
    `proximosPasos` TEXT NOT NULL,
    `estado` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HistorialCambio` (
    `id` VARCHAR(191) NOT NULL,
    `proyectoId` VARCHAR(191) NULL,
    `actividadId` VARCHAR(191) NULL,
    `campo` VARCHAR(191) NOT NULL,
    `valorAnterior` TEXT NOT NULL,
    `valorNuevo` TEXT NOT NULL,
    `usuario` VARCHAR(191) NOT NULL,
    `area` ENUM('Steven', 'Diego', 'Guillermo', 'Mario') NOT NULL,
    `fecha` DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `motivo` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IndicadorAvance` (
    `id` VARCHAR(191) NOT NULL,
    `proyectoId` VARCHAR(191) NOT NULL,
    `area` ENUM('Steven', 'Diego', 'Guillermo', 'Mario') NOT NULL,
    `porcentaje` DOUBLE NOT NULL,
    `actividadesTotal` INTEGER NOT NULL,
    `actividadesCompletadas` INTEGER NOT NULL,
    `ultimaActualizacion` DATE NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Proyecto` ADD CONSTRAINT `Proyecto_responsablePrincipalId_fkey` FOREIGN KEY (`responsablePrincipalId`) REFERENCES `Responsable`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Actividad` ADD CONSTRAINT `Actividad_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `Proyecto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Actividad` ADD CONSTRAINT `Actividad_responsablePrincipalId_fkey` FOREIGN KEY (`responsablePrincipalId`) REFERENCES `Responsable`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subtarea` ADD CONSTRAINT `Subtarea_actividadId_fkey` FOREIGN KEY (`actividadId`) REFERENCES `Actividad`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subtarea` ADD CONSTRAINT `Subtarea_responsableId_fkey` FOREIGN KEY (`responsableId`) REFERENCES `Responsable`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ValidacionRequerida` ADD CONSTRAINT `ValidacionRequerida_actividadId_fkey` FOREIGN KEY (`actividadId`) REFERENCES `Actividad`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comentario` ADD CONSTRAINT `Comentario_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `Proyecto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comentario` ADD CONSTRAINT `Comentario_actividadId_fkey` FOREIGN KEY (`actividadId`) REFERENCES `Actividad`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evidencia` ADD CONSTRAINT `Evidencia_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `Proyecto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evidencia` ADD CONSTRAINT `Evidencia_actividadId_fkey` FOREIGN KEY (`actividadId`) REFERENCES `Actividad`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evidencia` ADD CONSTRAINT `Evidencia_reporteDiarioId_fkey` FOREIGN KEY (`reporteDiarioId`) REFERENCES `ReporteDiario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvaluacionTecnica` ADD CONSTRAINT `EvaluacionTecnica_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `Proyecto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IngenieriaDiseno` ADD CONSTRAINT `IngenieriaDiseno_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `Proyecto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlanoDiseno` ADD CONSTRAINT `PlanoDiseno_ingenieriaDisenoId_fkey` FOREIGN KEY (`ingenieriaDisenoId`) REFERENCES `IngenieriaDiseno`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExpedienteTecnico` ADD CONSTRAINT `ExpedienteTecnico_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `Proyecto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Documento` ADD CONSTRAINT `Documento_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `Proyecto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Documento` ADD CONSTRAINT `Documento_expedienteTecnicoId_fkey` FOREIGN KEY (`expedienteTecnicoId`) REFERENCES `ExpedienteTecnico`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Suboperacion` ADD CONSTRAINT `Suboperacion_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `Proyecto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Suboperacion` ADD CONSTRAINT `Suboperacion_responsablePrincipalId_fkey` FOREIGN KEY (`responsablePrincipalId`) REFERENCES `Responsable`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entregable` ADD CONSTRAINT `Entregable_suboperacionId_fkey` FOREIGN KEY (`suboperacionId`) REFERENCES `Suboperacion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReporteDiario` ADD CONSTRAINT `ReporteDiario_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `Proyecto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HistorialCambio` ADD CONSTRAINT `HistorialCambio_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `Proyecto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HistorialCambio` ADD CONSTRAINT `HistorialCambio_actividadId_fkey` FOREIGN KEY (`actividadId`) REFERENCES `Actividad`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IndicadorAvance` ADD CONSTRAINT `IndicadorAvance_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `Proyecto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
