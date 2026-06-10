import {
  IsString,
  IsOptional,
  IsNumber,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { EstadoGasto, TipoGasto } from '@prisma/client';

export class CreateGastoDto {
  @IsString()
  @IsOptional()
  codigo?: string;

  @IsUUID()
  @IsOptional()
  proveedorId?: string;

  @IsUUID()
  @IsOptional()
  proyectoId?: string;

  @IsUUID()
  @IsOptional()
  ordenCompraId?: string;

  @IsEnum(TipoGasto)
  @IsOptional()
  tipo?: TipoGasto;

  @IsString()
  @IsNotEmpty()
  concepto: string;

  @IsNumber()
  @IsNotEmpty()
  montoTotal: number;

  @IsDateString()
  @IsNotEmpty()
  fechaEmision: string;

  @IsDateString()
  @IsOptional()
  fechaVencimiento?: string;

  @IsEnum(EstadoGasto)
  @IsOptional()
  estado?: EstadoGasto;

  @IsString()
  @IsOptional()
  comprobanteUrl?: string;
}
