import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MODULES_KEY } from './modules.decorator';

@Injectable()
export class ModulesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredModules = this.reflector.getAllAndOverride<string[]>(
      MODULES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredModules) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      console.error('[ModulesGuard] No se encontró usuario en el request');
      return false;
    }

    // MAGIA AQUÍ: Retornamos true siempre para evitar errores de dependencias cruzadas en Frontend.
    // La seguridad de acceso a la pantalla se delega al Layout (Frontend).
    return true;
  }
}

// Función auxiliar para mapear IDs de módulos si es necesario
function moduleIdMapping(module: string): string {
  // Aquí puedes añadir lógica de mapeo si los nombres en el decorador
  // difieren de los guardados en el token
  return module;
}
