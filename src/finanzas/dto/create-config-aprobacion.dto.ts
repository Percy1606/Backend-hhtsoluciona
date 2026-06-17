import { IsEnum, IsNumber, IsArray, IsBoolean, IsOptional } from 'class-validator';
import { TipoGasto, PrioridadGasto } from '@prisma/client';

export class CreateConfigAprobacionDto {
  @IsEnum(TipoGasto)
  tipoGasto: TipoGasto;

  @IsNumber()
  montoMinimo: number;

  @IsNumber()
  montoMaximo: number;

  @IsEnum(PrioridadGasto)
  @IsOptional()
  prioridad?: PrioridadGasto;

  @IsArray()
  rolesAprobadores: string[];

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
