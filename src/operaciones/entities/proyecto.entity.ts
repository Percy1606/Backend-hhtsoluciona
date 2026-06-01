// src/operaciones/entities/proyecto.entity.ts

import {
  Area,
  Prioridad,
  EstadoProyecto,
  Semaforo,
  TipoActividad,
  EstadoActividad,
  TipoValidacion,
  TipoDocumento,
  Responsable,
  Subtarea,
  ValidacionRequerida,
  Comentario,
  Evidencia,
  EvaluacionTecnica,
  IngenieriaDiseno,
  PlanoDiseno,
  ExpedienteTecnico,
  Suboperacion,
  Entregable,
  ReporteDiario,
  Documento,
  HistorialCambio,
  IndicadorAvance,
} from '../types/index';

// Re-exporting necessary enums for external use
export {
  Area,
  Prioridad,
  EstadoProyecto,
  Semaforo,
  TipoActividad,
  EstadoActividad,
};

// Re-exporting necessary interfaces/type aliases for external use
export type {
  Responsable,
  ValidacionRequerida,
  Subtarea,
  Comentario,
  Evidencia,
  EvaluacionTecnica,
  IngenieriaDiseno,
  PlanoDiseno,
  ExpedienteTecnico,
  Suboperacion,
  Entregable,
  ReporteDiario,
  Documento,
  HistorialCambio,
  IndicadorAvance,
  TipoValidacion,
  TipoDocumento,
};


export interface Proyecto {
  id: string;
  clientId: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  estado: EstadoProyecto;
  semaforo: Semaforo;
  prioridad: Prioridad;

  // Fechas
  fechaInicio: string;
  fechaFinEstimada: string;
  fechaFinReal?: string;

  // Responsables
  responsablePrincipalId: string;
  responsablesAdicionales: string[];

  // Área
  area: Area;

  // Contenido
  actividades: Actividad[];
  reportesDiarios: ReporteDiario[];
  comentarios: Comentario[];
  evidencias: Evidencia[];
  documentos: Documento[];

  // Alcance técnico
  evaluacionTecnica?: EvaluacionTecnica;
  ingenieriaDiseno?: IngenieriaDiseno;
  expedienteTecnico?: ExpedienteTecnico;
  suboperaciones: Suboperacion[];

  // Métricas
  avance: number;
  avanceCalculado: number;
  costoPresupuestado?: number;
  costoReal?: number;

  // Historial
  historialCambios: HistorialCambio[];

  // Índices de avance por área
  indicadoresAvance?: IndicadorAvance[];

  // Auditoría
  creadoPor?: string;
  fechaCreacion?: string;
  actualizadoPor?: string;
  fechaActualizacion?: string;
}

export interface Actividad {
  id: string;
  proyectoId: string;
  descripcion: string;
  tipo: TipoActividad;
  prioridad: Prioridad;
  estado: EstadoActividad;
  fechaCreacion: string;
  fechaInicio?: string;
  fechaFin?: string;
  fechaVencimiento?: string;

  // Responsables
  responsablePrincipalId: string;
  responsablesApoyo: string[]; // IDs de responsables de apoyo

  // Validaciones
  validacionesRequeridas: ValidacionRequerida[];

  // Subtareas y checklist
  subtareas: Subtarea[];
  checklistBloqueado?: boolean;
  motivoBloqueoChecklist?: string;
  desbloqueadoPor?: string;
  fechaDesbloqueoChecklist?: string;

  // Seguimiento
  comentarios: Comentario[];
  evidencias: Evidencia[];
  observaciones?: string;
  seguimientoOperativo?: string;

  // Progreso
  progreso: number;
  ponderacion?: number; // Peso de la actividad en el cálculo de avance
  orden: number;

  // Historial
  historialCambios: HistorialCambio[];

  // Parent para anidación
  padreId?: string;
  esSuboperacion?: boolean;
}