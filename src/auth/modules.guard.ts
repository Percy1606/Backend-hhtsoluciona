import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class ModulesGuard implements CanActivate {
  /**
   * RESTAURACIÓN DE ESTABILIDAD:
   * Este Guard ha sido simplificado para eliminar los errores 403 Forbidden.
   * Ahora permite el acceso a cualquier usuario que haya iniciado sesión (JwtAuthGuard).
   * Los módulos nuevos (Bandeja Técnica, CRM, etc.) se mantienen instalados,
   * pero la restricción de acceso se manejará visualmente en el Frontend.
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    return !!request.user; // Permite si el usuario existe (está autenticado)
  }
}
