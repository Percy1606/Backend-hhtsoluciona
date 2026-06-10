import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsDateString,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { EstadoFactura } from '@prisma/client';

export class CreateFacturaDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsUUID()
  @IsNotEmpty()
  clienteId: string;

  @IsUUID()
  @IsOptional()
  proyectoId?: string;

  @IsUUID()
  @IsOptional()
  cotizacionId?: string;

  @IsNumber()
  @IsNotEmpty()
  montoSubtotal: number;

  @IsNumber()
  @IsNotEmpty()
  montoIgv: number;

  @IsNumber()
  @IsNotEmpty()
  montoTotal: number;

  @IsDateString()
  @IsNotEmpty()
  fechaEmision: string;

  @IsDateString()
  @IsNotEmpty()
  fechaVencimiento: string;

  @IsEnum(EstadoFactura)
  @IsOptional()
  estado?: EstadoFactura;

  @IsString()
  @IsOptional()
  observaciones?: string;

  @IsString()
  @IsOptional()
  archivoUrl?: string;
}
