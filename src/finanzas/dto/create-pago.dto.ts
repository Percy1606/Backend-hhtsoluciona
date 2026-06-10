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
}
