import {
  Controller,
  Get,
  Param,
  Put,
  Post,
  Body,
  UseGuards,
  Req,
  Query,
  Sse,
  MessageEvent,
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Observable, merge, fromEvent, interval } from 'rxjs';
import { map } from 'rxjs/operators';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class SseAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.query.token;

    if (!token) {
      console.error('[SseAuthGuard] No se encontró token en la query');
      throw new UnauthorizedException('Token no proporcionado');
    }
try {
  const payload = await this.jwtService.verifyAsync(token);
  request.user = {
    id: payload.sub,
    username: payload.username,
    rol: payload.rol,
    nombre: payload.nombre,
    responsable: payload.responsable,
  };
  return true;
} catch (e) {
  throw new UnauthorizedException('Token inválido o expirado');
}
}
}

@Controller('notificaciones')
export class NotificacionesController {
constructor(
private readonly notificacionesService: NotificacionesService,
private eventEmitter: EventEmitter2,
) {}

@Sse('stream')
@UseGuards(SseAuthGuard)
stream(@Req() req: any): Observable<any> {
const usuarioId = req.user.id;

    const userStream = fromEvent(
      this.eventEmitter,
      `notification.${usuarioId}`,
    ).pipe(map((data) => ({ data })));

    const globalStream = fromEvent(
      this.eventEmitter,
      'notification.global',
    ).pipe(map((data) => ({ data })));

    const heartbeatStream = interval(25000).pipe(
      map(() => ({ data: { type: 'heartbeat' } })),
    );

    return merge(userStream, globalStream, heartbeatStream);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    return this.notificacionesService.findAllForUser(
      req.user.id,
      parseInt(page),
      parseInt(limit),
      req.user.rol,
    );
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  async getUnreadCount(@Req() req: any) {
    const count = await this.notificacionesService.getUnreadCount(
      req.user.id,
      req.user.rol,
    );
    return { count };
  }

  @Put('/read-all')
  @UseGuards(JwtAuthGuard)
  markAllAsRead(@Req() req: any) {
    return this.notificacionesService.markAllAsRead(req.user.id, req.user.rol);
  }

  @Put('/:id/read')
  @UseGuards(JwtAuthGuard)
  markAsRead(@Param('id') id: string) {
    return this.notificacionesService.markAsRead(id);
  }

  @Put('/:id/unread')
  @UseGuards(JwtAuthGuard)
  markAsUnread(@Param('id') id: string) {
    return this.notificacionesService.markAsUnread(id);
  }

  @Post('/')
  @UseGuards(JwtAuthGuard)
  async create(@Body() data: any) {
    console.log('POST /notificaciones called with data:', data);
    return this.notificacionesService.create(data);
  }
}
