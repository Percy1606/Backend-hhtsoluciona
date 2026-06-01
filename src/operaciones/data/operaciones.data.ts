// src/operaciones/data/operaciones.data.ts

import { Proyecto, Responsable, Area, EstadoActividad, EstadoProyecto, Prioridad, Semaforo, TipoActividad, TipoValidacion } from '../types/index';
import { EstadoValidacion } from '@prisma/client';

export const RESPONSABLES_DEFAULT: Responsable[] = [
  { id: 'resp_steven', nombre: 'Steven', area: Area.LogisticaYRecursos, cargo: 'Coordinador Logístico', color: '#3B82F6', email: 'steven@hhtsoluciona.com', telefono: '999888777', activo: true },
  { id: 'resp_diego', nombre: 'Diego', area: Area.IngenieriaYSupervision, cargo: 'Ingeniero Supervisor', color: '#8B5CF6', email: 'diego@hhtsoluciona.com', telefono: '999888776', activo: true },
  { id: 'resp_guillermo', nombre: 'Guillermo', area: Area.GestionDocumentaria, cargo: 'Gestor Documental', color: '#10B981', email: 'guillermo@hhtsoluciona.com', telefono: '999888775', activo: true },
  { id: 'resp_mario', nombre: 'Mario', area: Area.OperacionesDeCampo, cargo: 'Soporte de Campo', color: '#F59E0B', email: 'mario@hhtsoluciona.com', telefono: '999888774', activo: true },
];

export const PROYECTOS_INICIALES: Proyecto[] = [
  {
    id: 'proj_001',
    clientId: '1',
    codigo: 'HHT-OPE-26-001',
    nombre: 'Mantenimiento Preventivo Subestación RIO VERDE',
    descripcion: 'Mantenimiento integral de subestación de media tensión',
    estado: EstadoProyecto.EnEjecucion,
    semaforo: Semaforo.Verde,
    prioridad: Prioridad.Alta,
    fechaInicio: '2026-05-10',
    fechaFinEstimada: '2026-05-28',
    responsablePrincipalId: 'resp_diego',
    responsablesAdicionales: ['resp_mario'],
    area: Area.IngenieriaYSupervision,
    avance: 50,
    avanceCalculado: 50,
    indicadoresAvance: [
      { area: Area.IngenieriaYSupervision, porcentaje: 100, actividadesTotal: 2, actividadesCompletadas: 2, ultimaActualizacion: '2026-05-20' },
      { area: Area.OperacionesDeCampo, porcentaje: 0, actividadesTotal: 1, actividadesCompletadas: 0, ultimaActualizacion: '2026-05-20' }
    ],
    actividades: [
      {
        id: 'act_001',
        proyectoId: 'proj_001',
        descripcion: 'Limpieza de aisladores y bushings',
        tipo: TipoActividad.Tecnica,
        prioridad: Prioridad.Alta,
        estado: EstadoActividad.Completada,
        fechaCreacion: '2026-05-10',
        fechaInicio: '2026-05-10',
        fechaFin: '2026-05-12',
        fechaVencimiento: '2026-05-12',
        responsablePrincipalId: 'resp_mario',
        responsablesApoyo: [],
        validacionesRequeridas: [
          {
            id: 'val_001',
            tipo: TipoValidacion.Tecnica,
            area: Area.IngenieriaYSupervision,
            estado: EstadoValidacion.Aprobada,
            validadoPor: 'Diego',
            fechaValidacion: '2026-05-12'
          }
        ],
        subtareas: [
          { id: 'sub_001', actividadId: 'act_001', descripcion: 'Limpieza de aisladores de porcelana', completada: true, responsableId: 'resp_mario' },
          { id: 'sub_002', actividadId: 'act_001', descripcion: 'Limpieza de bushings', completada: true, responsableId: 'resp_mario' }
        ],
        comentarios: [],
        evidencias: [],
        progreso: 100,
        ponderacion: 1,
        orden: 1,
        checklistBloqueado: true,
        motivoBloqueoChecklist: 'Completado automáticamente',
        historialCambios: []
      },
      {
        id: 'act_002',
        proyectoId: 'proj_001',
        descripcion: 'Pruebas dieléctricas de transformador',
        tipo: TipoActividad.Tecnica,
        prioridad: Prioridad.Critica,
        estado: EstadoActividad.Completada,
        fechaCreacion: '2026-05-12',
        fechaInicio: '2026-05-13',
        fechaFin: '2026-05-15',
        fechaVencimiento: '2026-05-15',
        responsablePrincipalId: 'resp_diego',
        responsablesApoyo: [],
        validacionesRequeridas: [
          {
            id: 'val_002',
            tipo: TipoValidacion.Tecnica,
            area: Area.IngenieriaYSupervision,
            estado: EstadoValidacion.Aprobada,
            validadoPor: 'Diego',
            fechaValidacion: '2026-05-15'
          }
        ],
        subtareas: [
          { id: 'sub_003', actividadId: 'act_002', descripcion: 'Prueba de resistencia de aislamiento', completada: true, responsableId: 'resp_diego' },
          { id: 'sub_004', actividadId: 'act_002', descripcion: 'Prueba de rigidez dieléctrica', completada: true, responsableId: 'resp_diego' }
        ],
        comentarios: [],
        evidencias: [],
        progreso: 100,
        ponderacion: 1,
        orden: 2,
        checklistBloqueado: true,
        motivoBloqueoChecklist: 'Completado automáticamente',
        historialCambios: []
      },
      {
        id: 'act_003',
        proyectoId: 'proj_001',
        descripcion: 'Regeneración de aceite dieléctrico',
        tipo: TipoActividad.Tecnica,
        prioridad: Prioridad.Alta,
        estado: EstadoActividad.EnProgreso,
        fechaCreacion: '2026-05-15',
        fechaInicio: '2026-05-20',
        fechaVencimiento: '2026-05-25',
        responsablePrincipalId: 'resp_mario',
        responsablesApoyo: ['resp_steven'],
        validacionesRequeridas: [
          {
            id: 'val_003',
            tipo: TipoValidacion.Campo,
            area: Area.OperacionesDeCampo,
            estado: EstadoValidacion.Pendiente
          },
          {
            id: 'val_004',
            tipo: TipoValidacion.Tecnica,
            area: Area.IngenieriaYSupervision,
            estado: EstadoValidacion.Pendiente
          }
        ],
        subtareas: [
          { id: 'sub_005', actividadId: 'act_003', descripcion: 'Drenado de aceite usado', completada: true, responsableId: 'resp_mario' },
          { id: 'sub_006', actividadId: 'act_003', descripcion: 'Filtrado de aceite', completada: false, responsableId: 'resp_mario' },
          { id: 'sub_007', actividadId: 'act_003', descripcion: 'Llenado de aceite nuevo', completada: false, responsableId: 'resp_mario' }
        ],
        comentarios: [],
        evidencias: [],
        progreso: 33,
        ponderacion: 1,
        orden: 3,
        historialCambios: []
      },
      {
        id: 'act_004',
        proyectoId: 'proj_001',
        descripcion: 'Pruebas de inyección de corriente a relés',
        tipo: TipoActividad.Validacion,
        prioridad: Prioridad.Alta,
        estado: EstadoActividad.Pendiente,
        fechaCreacion: '2026-05-20',
        fechaVencimiento: '2026-05-28',
        responsablePrincipalId: 'resp_diego',
        responsablesApoyo: [],
        validacionesRequeridas: [],
        subtareas: [],
        comentarios: [],
        evidencias: [],
        progreso: 0,
        ponderacion: 1,
        orden: 4,
        historialCambios: []
      }
    ],
    reportesDiarios: [],
    comentarios: [],
    evidencias: [],
    documentos: [],
    suboperaciones: [],
    historialCambios: [
      {
        id: 'hist_init_1',
        entidadId: 'proj_001',
        entidadTipo: 'proyecto',
        campo: 'Creación',
        valorAnterior: '',
        valorNuevo: 'HHT-OPE-26-001',
        usuario: 'Diego',
        area: Area.IngenieriaYSupervision,
        fecha: '2026-05-10',
      }
    ]
  },
  {
    id: 'proj_002',
    clientId: '3',
    codigo: 'HHT-OPE-26-002',
    nombre: 'Iluminación LED Almacenes LOS PEROLES',
    descripcion: 'Proyecto de modernización de sistema de iluminación',
    estado: EstadoProyecto.Finalizado,
    semaforo: Semaforo.Verde,
    prioridad: Prioridad.Media,
    fechaInicio: '2026-05-01',
    fechaFinEstimada: '2026-05-15',
    fechaFinReal: '2026-05-14',
    responsablePrincipalId: 'resp_mario',
    responsablesAdicionales: [],
    area: Area.OperacionesDeCampo,
    avance: 100,
    avanceCalculado: 100,
    indicadoresAvance: [
      { area: Area.OperacionesDeCampo, porcentaje: 100, actividadesTotal: 2, actividadesCompletadas: 2, ultimaActualizacion: '2026-05-14' }
    ],
    actividades: [
      {
        id: 'act_005',
        proyectoId: 'proj_002',
        descripcion: 'Desmontaje de luminarias antiguas',
        tipo: TipoActividad.Tecnica,
        prioridad: Prioridad.Media,
        estado: EstadoActividad.Completada,
        fechaCreacion: '2026-05-01',
        fechaFin: '2026-05-05',
        fechaVencimiento: '2026-05-05',
        responsablePrincipalId: 'resp_mario',
        responsablesApoyo: [],
        validacionesRequeridas: [],
        subtareas: [],
        comentarios: [],
        evidencias: [],
        progreso: 100,
        orden: 1,
        checklistBloqueado: true,
        motivoBloqueoChecklist: 'Completado automáticamente',
        historialCambios: []
      },
      {
        id: 'act_006',
        proyectoId: 'proj_002',
        descripcion: 'Instalación de proyectores LED 200W',
        tipo: TipoActividad.Tecnica,
        prioridad: Prioridad.Media,
        estado: EstadoActividad.Completada,
        fechaCreacion: '2026-05-05',
        fechaFin: '2026-05-14',
        fechaVencimiento: '2026-05-14',
        responsablePrincipalId: 'resp_mario',
        responsablesApoyo: [],
        validacionesRequeridas: [],
        subtareas: [],
        comentarios: [],
        evidencias: [],
        progreso: 100,
        orden: 2,
        checklistBloqueado: true,
        motivoBloqueoChecklist: 'Completado automáticamente',
        historialCambios: []
      }
    ],
    reportesDiarios: [],
    comentarios: [],
    evidencias: [],
    documentos: [],
    suboperaciones: [],
    historialCambios: [
      {
        id: 'hist_init_2',
        entidadId: 'proj_002',
        entidadTipo: 'proyecto',
        campo: 'Creación',
        valorAnterior: '',
        valorNuevo: 'HHT-OPE-26-002',
        usuario: 'Mario',
        area: Area.OperacionesDeCampo,
        fecha: '2026-05-01',
      },
      {
        id: 'hist_init_3',
        entidadId: 'proj_002',
        entidadTipo: 'proyecto',
        campo: 'Cierre de proyecto',
        valorAnterior: EstadoProyecto.EnEjecucion,
        valorNuevo: EstadoProyecto.Finalizado,
        usuario: 'Mario',
        area: Area.OperacionesDeCampo,
        fecha: '2026-05-14',
      }
    ]
  }
];
