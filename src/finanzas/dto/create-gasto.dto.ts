import {
  IsString,
  IsOptional,
  IsNumber,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsDateString,
} from 'class-validator';
import {
  EstadoGasto,
  TipoGasto,
  ClasificacionFinanciera,
  CategoriaDistribucion,
  Area,
  NivelAprobacion,
  PrioridadGasto,
} from '@prisma/client';

export class CreateGastoDto {
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
  @IsNotEmpty()
  concepto: string;

  @IsString()
  @IsOptional()
  justificacion?: string;

  @IsEnum(Area)
  @IsOptional()
  area?: Area;

  @IsNumber()
  @IsNotEmpty()
  montoTotal: number;

  @IsDateString()
  @IsNotEmpty()
  fechaEmision: string;

  @IsDateString()
  @IsOptional()
  fechaVencimiento?: string;

  @IsDateString()
  @IsOptional()
  fechaProgramadaPago?: string;

  @IsEnum(EstadoGasto)
  @IsOptional()
  estado?: EstadoGasto;

  @IsEnum(PrioridadGasto)
  @IsOptional()
  prioridad?: PrioridadGasto;

  @IsString()
  @IsOptional()
  comprobanteUrl?: string;

  @IsUUID()
  @IsOptional()
  solicitanteId?: string;

  @IsUUID()
  @IsOptional()
  aprobadorFinanzasId?: string;

  @IsUUID()
  @IsOptional()
  aprobadorGerenciaId?: string;

  @IsEnum(NivelAprobacion)
  @IsOptional()
  nivelAprobacion?: NivelAprobacion;
}
