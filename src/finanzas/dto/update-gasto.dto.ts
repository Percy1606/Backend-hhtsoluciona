import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsEnum,
  IsDateString,
} from 'class-validator';
import {
  EstadoGasto,
  TipoGasto,
  ClasificacionFinanciera,
  CategoriaDistribucion,
} from '@prisma/client';

export class UpdateGastoDto {
  @IsString()
  @IsOptional()
  codigo?: string;

  @IsUUID()
  @IsOptional()
  proveedorId?: string | null;

  @IsUUID()
  @IsOptional()
  proyectoId?: string | null;

  @IsUUID()
  @IsOptional()
  ordenCompraId?: string | null;

  @IsUUID()
  @IsOptional()
  cajaId?: string | null;

  @IsEnum(TipoGasto)
  @IsOptional()
  tipo?: TipoGasto;

  @IsEnum(ClasificacionFinanciera)
  @IsOptional()
  clasificacion?: ClasificacionFinanciera;

  @IsEnum(CategoriaDistribucion)
  @IsOptional()
  categoriaDistribucion?: CategoriaDistribucion;

  @IsString()
  @IsOptional()
  concepto?: string;

  @IsNumber()
  @IsOptional()
  montoTotal?: number;

  @IsDateString()
  @IsOptional()
  fechaEmision?: string;

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
