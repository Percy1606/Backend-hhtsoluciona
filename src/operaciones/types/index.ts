import { EstadoValidacion } from '@prisma/client';

/**
 * ============================================
 * TIPOS CENTRALIZADOS - HH T SOLUCIONA
 * Sistema ERP/CRM
 * ============================================
 */

// ============================================
// ÁREAS Y ENUMERACIONES
// ============================================

export enum Area {
  LogisticaYRecursos = 'LogisticaYRecursos',
  IngenieriaYSupervision = 'IngenieriaYSupervision',
  GestionDocumentaria = 'GestionDocumentaria',
  OperacionesDeCampo = 'OperacionesDeCampo',
}

export enum Prioridad {
  Baja = 'Baja',
  Media = 'Media',
  Alta = 'Alta',
  Critica = 'Critica',
}

export enum EstadoProyecto {
  Planificacion = 'Planificacion',
  EnEjecucion = 'EnEjecucion',
  Detenido = 'Detenido',
  Finalizado = 'Finalizado',
}

export enum Semaforo {
  Verde = 'Verde',
  Amarillo = 'Amarillo',
  Rojo = 'Rojo',
}

export enum TipoActividad {
  Tecnica = 'Tecnica',
  Administrativa = 'Administrativa',
  Logistica = 'Logistica',
  Documental = 'Documental',
  Validacion = 'Validacion',
}

export enum TipoValidacion {
  Tecnica = 'Tecnica',
  Campo = 'Campo',
  Documental = 'Documental',
  Calidad = 'Calidad',
}

export enum EstadoActividad {
  Pendiente = 'Pendiente',
  EnProgreso = 'EnProgreso',
  Completada = 'Completada',
  Validada = 'Validada',
  Bloqueada = 'Bloqueada',
}

export type TipoDocumento =
  | 'Tecnica'
  | 'Administrativa'
  | 'Legal'
  | 'Financiero'
  | 'Otro';

export type EstadoDocumento =
  | 'Borrador'
  | 'PendienteRevision'
  | 'Aprobado'
  | 'Obsoleto';

// ============================================
// RESPONSABLE Y PERSONAL
// ============================================

export interface Responsable {
  id: string;
  nombre: string;
  area: Area;
  cargo: string;
  email?: string;
  telefono?: string;
  avatar?: string;
  color: string;
  esSubresponsable?: boolean;
  reportesA?: string;
  activo?: boolean;
}

// ============================================
// ACTIVIDADES Y SUBTAREAS
// ============================================

export interface Subtarea {
  id: string;
  actividadId: string;
  descripcion: string;
  completada: boolean;
  responsableId?: string;
  fechaVencimiento?: string;
  fechaCompletada?: string;
  bloqueada?: boolean;
  motivoBloqueo?: string;
}

export interface ValidacionRequerida {
  id: string;
  tipo: TipoValidacion;
  area: Area;
  estado: EstadoValidacion;
  validadoPor?: string;
  fechaValidacion?: string;
  observaciones?: string;
  evidenciaUrl?: string;
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
  responsablePrincipalId: string;
  responsablesApoyo: string[];
  validacionesRequeridas: ValidacionRequerida[];
  subtareas: Subtarea[];
  checklistBloqueado?: boolean;
  motivoBloqueoChecklist?: string;
  comentarios: Comentario[];
  evidencias: Evidencia[];
  observaciones?: string;
  seguimientoOperativo?: string;
  progreso: number;
  ponderacion?: number;
  orden: number;
  historialCambios: HistorialCambio[];
  padreId?: string;
  esSuboperacion?: boolean;
}

// ============================================
// COMENTARIOS Y EVIDENCIAS
// ============================================

export interface Comentario {
  id: string;
  entidadId: string;
  entidadTipo: 'proyecto' | 'actividad' | 'tarea' | 'validacion';
  usuario: string;
  usuarioArea: Area;
  contenido: string;
  fecha: string;
  esInterno: boolean;
}

export interface Evidencia {
  id: string;
  entidadId: string;
  entidadTipo: 'proyecto' | 'actividad' | 'tarea' | 'validacion';
  nombre: string;
  tipo: string;
  url: string;
  tamano: string;
  subidoPor: string;
  fecha: string;
  descripcion?: string;
}

// ============================================
// ALCANCE DE PROYECTO
// ============================================

export interface EvaluacionTecnica {
  id: string;
  proyectoId: string;
  fechaEvaluacion: string;
  evaluadoPor: string;
  hallazgos: string[];
  solucionesPropuestas: string[];
  recomendaciones: string;
  estado: 'Pendiente' | 'En Progreso' | 'Completada';
  documentoUrl?: string;
}

export interface IngenieriaDiseno {
  id: string;
  proyectoId: string;
  fechaInicio: string;
  fechaFinEstimada?: string;
  ingenieroResponsable: string;
  planos: PlanoDiseno[];
  especificaciones: string[];
  estado: 'Pendiente' | 'En Progreso' | 'Aprobado' | 'Obsoleto';
}

export interface PlanoDiseno {
  id: string;
  numero: string;
  titulo: string;
  descripcion?: string;
  url: string;
  version: string;
  fecha: string;
  estado: 'Borrador' | 'En Revisión' | 'Aprobado';
}

export interface ExpedienteTecnico {
  id: string;
  proyectoId: string;
  numeroExpediente: string;
  titulo: string;
  descripcion?: string;
  contenido: Documento[];
  estado: 'En Elaboración' | 'Completo' | 'Archivado';
  fechaCreacion: string;
  fechaActualizacion: string;
}

export interface Suboperacion {
  id: string;
  proyectoId: string;
  actividadPadreId?: string;
  titulo: string;
  descripcion: string;
  tipo: TipoActividad;
  responsablePrincipalId: string;
  responsablesApoyo: string[];
  fechaInicio: string;
  fechaFinEstimada: string;
  fechaFinReal?: string;
  progreso: number;
  estado: EstadoActividad;
  entregables: Entregable[];
  validaciones: ValidacionRequerida[];
}

export interface Entregable {
  id: string;
  suboperacionId: string;
  nombre: string;
  descripcion?: string;
  tipo: 'Documento' | 'Plano' | 'Informe' | 'Certificado' | 'Otro';
  url?: string;
  estado: 'Pendiente' | 'En Progreso' | 'Entregado' | 'Aprobado';
  fechaEntrega?: string;
  fechaAprobacion?: string;
  aprobadoPor?: string;
}

// ============================================
// PROYECTO COMPLETO
// ============================================

export interface Proyecto {
  id: string;
  clientId: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  estado: EstadoProyecto;
  semaforo: Semaforo;
  prioridad: Prioridad;
  fechaInicio: string;
  fechaFinEstimada: string;
  fechaFinReal?: string;
  responsablePrincipalId: string;
  responsablesAdicionales: string[];
  area: Area;
  actividades: Actividad[];
  reportesDiarios: ReporteDiario[];
  comentarios: Comentario[];
  evidencias: Evidencia[];
  documentos: Documento[];
  evaluacionTecnica?: EvaluacionTecnica;
  ingenieriaDiseno?: IngenieriaDiseno;
  expedienteTecnico?: ExpedienteTecnico;
  suboperaciones: Suboperacion[];
  avance: number;
  avanceCalculado: number;
  costoPresupuestado?: number;
  costoReal?: number;
  historialCambios: HistorialCambio[];
  indicadoresAvance?: IndicadorAvance[];
  creadoPor?: string;
  fechaCreacion?: string;
  actualizadoPor?: string;
  fechaActualizacion?: string;
}

export interface IndicadorAvance {
  area: Area;
  porcentaje: number;
  actividadesTotal: number;
  actividadesCompletadas: number;
  ultimaActualizacion: string;
}

// ============================================
// REPORTE DIARIO
// ============================================

export interface ReporteDiario {
  id: string;
  proyectoId: string;
  fecha: string;
  usuario: string;
  usuarioArea: Area;
  actividades: string;
  hallazgos: string;
  personal: string;
  proximosPasos: string;
  evidencias: Evidencia[];
  estado: 'Borrador' | 'Enviado' | 'Revisado';
}

// ============================================
// GESTIÓN DOCUMENTAL
// ============================================

export interface Documento {
  id: string;
  proyectoId: string;
  clientId?: string;
  nombre: string;
  tipo: TipoDocumento;
  subtype?: string;
  numero?: string;
  url: string;
  version?: string;
  estado: EstadoDocumento;
  subidoPor: string;
  fechaSubida: string;
  fechaVencimiento?: string;
  validaciones: ValidacionRequerida[];
  observaciones?: string;
  esEntregable?: boolean;
}

// ============================================
// HISTORIAL Y AUDITORÍA
// ============================================

export interface HistorialCambio {
  id: string;
  entidadId: string;
  entidadTipo: 'proyecto' | 'actividad' | 'tarea' | 'validacion';
  campo: string;
  valorAnterior: string;
  valorNuevo: string;
  usuario: string;
  area: Area;
  fecha: string;
  motivo?: string;
}
