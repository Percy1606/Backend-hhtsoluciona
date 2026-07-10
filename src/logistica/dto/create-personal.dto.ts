import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';

export class CreatePersonalDto {
  @IsString()
  @IsNotEmpty()
  proyectoId: string;

  @IsString()
  @IsOptional()
  proyectoCodigo?: string;

  @IsString()
  @IsOptional()
  proyectoNombre?: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsOptional()
  documento?: string;

  @IsString()
  @IsNotEmpty()
  rol: string;

  @IsString()
  @IsNotEmpty()
  tipoContrato: string;

  @IsNumber()
  @Min(0)
  montoDiario: number;

  @IsString()
  @IsOptional()
  fechaInicio?: string;

  @IsString()
  @IsOptional()
  fechaFin?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @IsString()
  @IsOptional()
  observaciones?: string;
}

export class UpdatePersonalDto {
  @IsString()
  @IsOptional()
  proyectoId?: string;

  @IsString()
  @IsOptional()
  proyectoCodigo?: string;

  @IsString()
  @IsOptional()
  proyectoNombre?: string;

  @IsString()
  @IsOptional()
  nombre?: string;

  @IsString()
  @IsOptional()
  documento?: string;

  @IsString()
  @IsOptional()
  rol?: string;

  @IsString()
  @IsOptional()
  tipoContrato?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  montoDiario?: number;

  @IsString()
  @IsOptional()
  fechaInicio?: string;

  @IsString()
  @IsOptional()
  fechaFin?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @IsString()
  @IsOptional()
  observaciones?: string;
}
