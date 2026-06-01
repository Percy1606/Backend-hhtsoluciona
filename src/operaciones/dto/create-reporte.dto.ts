import { IsString, IsNotEmpty, IsDateString, IsEnum } from 'class-validator';
import { Area } from '@prisma/client';

export class CreateReporteDiarioDto {
  @IsString()
  @IsNotEmpty()
  proyectoId: string;

  @IsDateString()
  fecha: string;

  @IsString()
  @IsNotEmpty()
  usuario: string;

  @IsEnum(Area)
  usuarioArea: Area;

  @IsString()
  @IsNotEmpty()
  actividades: string;

  @IsString()
  @IsNotEmpty()
  hallazgos: string;

  @IsString()
  @IsNotEmpty()
  personal: string;

  @IsString()
  @IsNotEmpty()
  proximosPasos: string;

  @IsString()
  @IsNotEmpty()
  estado: string;
}
