CREATE TABLE IF NOT EXISTS tarea_estrategica (
  id VARCHAR(191) NOT NULL,
  clienteId VARCHAR(191) NULL,
  empresa VARCHAR(191) NOT NULL,
  etapaProceso VARCHAR(191) NOT NULL,
  actividadInmediata TEXT NOT NULL,
  proximoPaso TEXT NOT NULL,
  responsable VARCHAR(191) NOT NULL,
  fechaCompromiso VARCHAR(191) NOT NULL,
  estado VARCHAR(191) NOT NULL,
  subtareas JSON NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  PRIMARY KEY (id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
