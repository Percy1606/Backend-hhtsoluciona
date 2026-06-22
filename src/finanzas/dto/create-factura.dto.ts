import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsDateString,
  IsEnum,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { EstadoFactura, ClasificacionFinanciera } from '@prisma/client';

export class CreateFacturaDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsUUID()
  @IsNotEmpty()
  clienteId: string;

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
  cajaId?: string;

  @IsUUID()
  @IsOptional()
  hitoPagoId?: string | null;
}
