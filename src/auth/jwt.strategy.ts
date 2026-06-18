import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.JWT_SECRET || 'software-hh-secret-key-2026';
    console.log('[JwtStrategy] Inicializando con secret:', secret ? '***DEFINIDO***' : '---UNDEFINED---');
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: any) => {
          if (req && req.query && req.query.token) {
            console.log('[JwtStrategy] Token encontrado en query params');
            return req.query.token;
          }
          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    return {
      id: payload.sub,
      username: payload.username,
      rol: payload.rol,
      nombre: payload.nombre,
      modulos: payload.modulos,
      responsable: payload.responsable,
    };
  }
}
