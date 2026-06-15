import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private prisma: PrismaService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // SOPORTE PARA TOKEN POR URL (Para previsualización de archivos)
    const urlToken = request.query?.token;
    if (urlToken && !request.headers.authorization) {
      request.headers.authorization = `Bearer ${urlToken}`;
    }

    const canActivate = await super.canActivate(context);
    if (!canActivate) return false;

    const user = request.user;

    if (user && user.id) {
      // Actualizar última actividad de forma asíncrona (fire and forget para no retrasar la respuesta)
      this.prisma.usuario
        .update({
          where: { id: user.id },
          data: { ultimaActividad: new Date() },
        })
        .catch((err) => console.error('Error updating ultimaActividad:', err));
    }

    return true;
  }
}
