import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { EstadoFactura } from '@prisma/client';

export class UpdateFacturaDto {
  @IsString()
  @IsOptional()
  codigo?: string;

  @IsUUID()
  @IsOptional()
  clienteId?: string;

  @IsUUID()
  @IsOptional()
  proyectoId?: string;

  @IsUUID()
  @IsOptional()
  cotizacionId?: string;

  @IsNumber()
  @IsOptional()
  montoSubtotal?: number;

  @IsNumber()
  @IsOptional()
  montoIgv?: number;

  @IsNumber()
  @IsOptional()
  montoTotal?: number;

  @IsDateString()
  @IsOptional()
  fechaEmision?: string;

  @IsDateString()
  @IsOptional()
  fechaVencimiento?: string;

  @IsEnum(EstadoFactura)
  @IsOptional()
  estado?: EstadoFactura;

  @IsString()
  @IsOptional()
  observaciones?: string;

  @IsString()
  @IsOptional()
  archivoUrl?: string;

  @IsNumber()
  @IsOptional()
  saldoPendiente?: number;
}
