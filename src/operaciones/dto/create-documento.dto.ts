import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { TipoDocumento, EstadoDocumento } from '@prisma/client';

export class CreateDocumentoDto {
  @IsOptional()
  @IsString()
  proyectoId?: string;

  @IsOptional()
  @IsString()
  expedienteTecnicoId?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsEnum(TipoDocumento)
  tipo: TipoDocumento;

  @IsOptional()
  @IsString()
  subtype?: string;

  @IsOptional()
  @IsString()
  numero?: string;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsEnum(EstadoDocumento)
  estado?: EstadoDocumento;

  @IsString()
  @IsNotEmpty()
  subidoPor: string;

  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsBoolean()
  esEntregable?: boolean;
}
