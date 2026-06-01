import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MODULES_KEY } from './modules.decorator';

@Injectable()
export class ModulesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredModules = this.reflector.getAllAndOverride<string[]>(MODULES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (!requiredModules || requiredModules.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    if (!user) {
      return false;
    }

    // Admins have access to everything
    if (user.rol === 'ADMIN') {
      return true;
    }

    let userModules = user.modulos;
    
    if (typeof userModules === 'string') {
      try {
        userModules = JSON.parse(userModules);
      } catch (e) {
        userModules = [];
      }
    }

    if (!Array.isArray(userModules)) {
      userModules = [];
    }

    return requiredModules.some((module) => userModules.includes(module));
  }
}
