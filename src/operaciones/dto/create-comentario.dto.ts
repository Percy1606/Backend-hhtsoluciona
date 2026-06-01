import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { Area } from '@prisma/client';

export class CreateComentarioDto {
  @IsOptional()
  @IsString()
  proyectoId?: string;

  @IsOptional()
  @IsString()
  actividadId?: string;

  @IsString()
  @IsNotEmpty()
  usuario: string;

  @IsEnum(Area)
  usuarioArea: Area;

  @IsString()
  @IsNotEmpty()
  contenido: string;

  @IsOptional()
  @IsBoolean()
  esInterno?: boolean;
}
