import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

@Injectable()
export class CrmCronService {
  private readonly logger = new Logger(CrmCronService.name);

  constructor(
    private prisma: PrismaService,
    private notificaciones: NotificacionesService,
  ) {}

  // Se ejecuta de Lunes a Viernes a las 17:00 (5 PM) hora de Perú
  // @Cron('0 17 * * 1-5', { timeZone: 'America/Lima' }) // Deshabilitado por pedido del usuario
  async evaluacionCierreJornada() {
    this.logger.log('Iniciando evaluación diaria de Cierre de Jornada Comercial (17:00 PET)...');

    // Obtener rangos de fecha de "hoy"
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    // Definición de Unidades Comerciales y Asesores
    const sellers = [
      // Unidad 1 - Nuevos Negocios (Creados >= 03/08/2026)
      { name: 'Ariana', type: 'cazadora', unit: 'UNIDAD_1', meta: 15 },
      { name: 'Brenda', type: 'cazadora', unit: 'UNIDAD_1', meta: 15 },
      { name: 'Valentina', type: 'cerradora', unit: 'UNIDAD_1', meta: 15 },
      // Unidad 2 - Clientes Estratégicos (Cartera Histórica)
      { name: 'Angi', type: 'mixta', unit: 'UNIDAD_2', meta: 15 },
      { name: 'Javier', type: 'mixta', unit: 'UNIDAD_2', meta: 15 },
      { name: 'Mellani', type: 'mixta', unit: 'UNIDAD_2', meta: 15 },
      { name: 'Steven', type: 'mixta', unit: 'UNIDAD_2', meta: 15 },
    ];

    let resumenGlobal = '📋 *REPORTE DE CIERRE DE JORNADA*\n\n';
    let todasCumplieron = true;

    for (const seller of sellers) {
      let avance = 0;
      let label = '';

      if (seller.type === 'cazadora') {
        // Cazadoras: Evaluar nuevos prospectos creados hoy
        avance = await this.prisma.cliente.count({
          where: {
            asignadoA: { contains: seller.name },
            fechaCreacion: {
              gte: hoy,
              lt: manana,
            },
          },
        });
        label = 'Nuevos Prospectos';
      } else if (seller.type === 'mixta') {
        // Mixtas: Evaluar prospectos y seguimientos de hoy
        const prospectos = await this.prisma.cliente.count({
          where: {
            asignadoA: { contains: seller.name },
            fechaCreacion: {
              gte: hoy,
              lt: manana,
            },
          },
        });
        const seguimientos = await this.prisma.cliente.count({
          where: {
            asignadoA: { contains: seller.name },
            ultimoContacto: {
              gte: hoy,
              lt: manana,
            },
          },
        });
        avance = prospectos + seguimientos;
        label = 'Prospectos y Seguimientos';
      } else {
        // Cerradoras: Evaluar seguimientos / contactos realizados hoy
        avance = await this.prisma.cliente.count({
          where: {
            asignadoA: { contains: seller.name },
            ultimoContacto: {
              gte: hoy,
              lt: manana,
            },
          },
        });
        label = 'Seguimientos';
      }

      const cumplio = avance >= seller.meta;
      if (!cumplio) todasCumplieron = false;
      
      const estadoIcon = cumplio ? '✅' : '❌';
      resumenGlobal += `${estadoIcon} ${seller.name}: ${avance}/${seller.meta} ${label}\n`;

      // Intentar notificar individualmente a la asesora (si existe su usuario en DB)
      try {
        const usuarioAsesora = await this.prisma.usuario.findFirst({
          where: { nombre: { contains: seller.name } },
        });

        if (usuarioAsesora) {
          await this.notificaciones.create({
            usuarioId: usuarioAsesora.id,
            titulo: cumplio ? '¡Meta Diaria Alcanzada!' : 'Cierre de Jornada: Meta no alcanzada',
            mensaje: cumplio 
              ? `¡Excelente trabajo ${seller.name}! Has logrado registrar ${avance} ${label} hoy. ¡Sigue así!`
              : `Atención ${seller.name}, hoy lograste ${avance} de tu meta de ${seller.meta} ${label}. ¡A recuperar mañana!`,
            tipo: cumplio ? 'INFO' : 'ALERTA',
            esGlobal: false,
          });
        }
      } catch (err) {
        this.logger.error(`Error notificando a ${seller.name}: ${err}`);
      }
    }

    // Notificación Global (para el Supervisor/Administradores)
    try {
      await this.notificaciones.create({
        usuarioId: null, // Global
        titulo: todasCumplieron ? '🚀 Reporte Diario: ¡Equipo Invencible!' : '📊 Reporte Comercial: Cierre de Jornada',
        mensaje: resumenGlobal,
        tipo: todasCumplieron ? 'INFO' : 'ALERTA',
        esGlobal: true,
      });
      this.logger.log('Reporte de cierre de jornada enviado con éxito.');
    } catch (err) {
      this.logger.error('Error enviando reporte global de cierre de jornada:', err);
    }
  }
}
