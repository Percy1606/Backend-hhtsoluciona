import {
  IsNumber,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';
import { MetodoPago } from '@prisma/client';

export class CreatePagoDto {
  @IsUUID()
  @IsNotEmpty()
  facturaId: string;

  @IsNumber()
  @IsNotEmpty()
  monto: number;

  @IsUUID()
  @IsNotEmpty()
  cajaId: string;

  @IsDateString()
  @IsOptional()
  fechaPago?: string;

  @IsEnum(MetodoPago)
  @IsOptional()
  metodo?: MetodoPago;

  @IsString()
  @IsOptional()
  referencia?: string;

  @IsString()
  @IsOptional()
  comprobanteUrl?: string;

  @IsString()
  @IsOptional()
  observaciones?: string;
}
