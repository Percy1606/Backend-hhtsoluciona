import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsEnum,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { EstadoFactura, ClasificacionFinanciera } from '@prisma/client';

export class UpdateFacturaDto {
  @IsString()
  @IsOptional()
  codigo?: string;

  @IsUUID()
  @IsOptional()
  clienteId?: string;

  @IsUUID()
  @IsOptional()
  proyectoId?: string | null;

  @IsUUID()
  @IsOptional()
  cotizacionId?: string | null;

  @IsEnum(ClasificacionFinanciera)
  @IsOptional()
  clasificacion?: ClasificacionFinanciera;

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

  @IsDateString()
  @IsOptional()
  fechaEstimadaCobro?: string;

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

  @IsUUID()
  @IsOptional()
  cajaId?: string;

  @IsBoolean()
  @IsOptional()
  isManual?: boolean;

  @IsBoolean()
  @IsOptional()
  esRecurrente?: boolean;

  @IsString()
  @IsOptional()
  frecuencia?: string;

  @IsDateString()
  @IsOptional()
  proximaFacturacion?: string;

  @IsUUID()
  @IsOptional()
  hitoPagoId?: string | null;
}
