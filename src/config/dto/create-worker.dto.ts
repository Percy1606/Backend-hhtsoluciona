import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { Area } from '@prisma/client';

export class CreateWorkerDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsEnum(Area)
  area: Area;

  @IsString()
  @IsNotEmpty()
  cargo: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsString()
  @IsNotEmpty()
  color: string;

  @IsBoolean()
  @IsOptional()
  esSubresponsable?: boolean;

  @IsString()
  @IsOptional()
  reportesA?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @IsString()
  @IsOptional()
  dni?: string;

  @IsDateString()
  @IsOptional()
  fechaNacimiento?: string;

  @IsString()
  @IsOptional()
  sexo?: string;

  @IsString()
  @IsOptional()
  estadoCivil?: string;

  @IsString()
  @IsOptional()
  nacionalidad?: string;

  @IsString()
  @IsOptional()
  direccion?: string;

  @IsString()
  @IsOptional()
  distrito?: string;

  @IsString()
  @IsOptional()
  ciudad?: string;

  @IsString()
  @IsOptional()
  correoPersonal?: string;

  @IsString()
  @IsOptional()
  contactoEmergenciaNombre?: string;

  @IsString()
  @IsOptional()
  contactoEmergenciaTelefono?: string;

  @IsBoolean()
  @IsOptional()
  disponibilidadViajes?: boolean;
}
