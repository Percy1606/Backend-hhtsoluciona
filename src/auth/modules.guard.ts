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

    // El ADMIN siempre tiene acceso a todo
    if (user.rol === 'ADMIN') {
      return true;
    }

    const userModules = user.modulos;
    let finalModules: string[] = [];

    // Normalización ultra-robusta de los módulos del usuario
    try {
      if (Array.isArray(userModules)) {
        finalModules = userModules.map((m) => String(m).toLowerCase());
      } else if (typeof userModules === 'string') {
        if (userModules.startsWith('[') || userModules.startsWith('{')) {
          const parsed = JSON.parse(userModules);
          finalModules = Array.isArray(parsed) ? parsed : Object.values(parsed);
        } else {
          finalModules = userModules.split(',').map((m) => m.trim());
        }
      } else if (typeof userModules === 'object' && userModules !== null) {
        finalModules = Object.values(userModules);
      }

      // Limpiar y normalizar a minúsculas
      finalModules = finalModules.map((m) => String(m).toLowerCase());
    } catch (e) {
      console.error(
        '[ModulesGuard] Error crítico al procesar módulos:',
        e.message,
      );
      finalModules = [];
    }

    const requiredMapped = requiredModules.map((m) =>
      String(moduleIdMapping(m)).toLowerCase(),
    );

    // Verificación de acceso: ¿Tiene el usuario alguno de los módulos requeridos?
    const hasAccess = requiredMapped.some(
      (reqMod) =>
        finalModules.includes(reqMod) ||
        finalModules.some((userMod) => userMod.includes(reqMod)),
    );

    if (!hasAccess) {
      console.warn(`[ModulesGuard] ACCESO RECHAZADO: ${user.username}`);
      console.warn(
        `[ModulesGuard] El usuario tiene estos módulos: ${JSON.stringify(finalModules)}`,
      );
      console.warn(
        `[ModulesGuard] Pero se requiere uno de estos: ${JSON.stringify(requiredMapped)}`,
      );
    }

    return hasAccess;
  }
}

// Función auxiliar para mapear IDs de módulos si es necesario
function moduleIdMapping(module: string): string {
  // Aquí puedes añadir lógica de mapeo si los nombres en el decorador
  // difieren de los guardados en el token
  return module;
}
