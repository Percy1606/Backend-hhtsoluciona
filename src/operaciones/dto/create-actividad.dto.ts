import { IsString, IsOptional, IsEnum, IsNumber, Min, Max, IsDateString, IsBoolean, IsArray } from 'class-validator';
import { TipoActividad, Prioridad, EstadoActividad } from '@prisma/client';

export class CreateActividadDto {
  @IsString()
  proyectoId: string;

  @IsString()
  descripcion: string;

  @IsEnum(TipoActividad)
  tipo: TipoActividad;

  @IsEnum(Prioridad)
  prioridad: Prioridad;

  @IsEnum(EstadoActividad)
  estado: EstadoActividad;

  @IsDateString()
  fechaCreacion: string;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;

  @IsString()
  responsablePrincipalId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  responsablesApoyo?: string[];

  @IsOptional()
  @IsBoolean()
  checklistBloqueado?: boolean;

  @IsOptional()
  @IsString()
  motivoBloqueoChecklist?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progreso?: number;

  @IsOptional()
  @IsNumber()
  ponderacion?: number;

  @IsOptional()
  @IsNumber()
  orden?: number;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsString()
  seguimientoOperativo?: string;
}
