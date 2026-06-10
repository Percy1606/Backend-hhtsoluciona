import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
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
}
