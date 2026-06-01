import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class CreateEvidenciaDto {
  @IsOptional()
  @IsString()
  proyectoId?: string;

  @IsOptional()
  @IsString()
  actividadId?: string;

  @IsOptional()
  @IsString()
  reporteDiarioId?: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  tipo: string;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsNotEmpty()
  tamano: string;

  @IsString()
  @IsNotEmpty()
  subidoPor: string;

  @IsOptional()
  @IsString()
  descripcion?: string;
}
