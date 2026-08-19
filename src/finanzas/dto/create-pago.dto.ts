import {
  IsNumber,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  Min,
} from 'class-validator';
import { MetodoPago } from '@prisma/client';

export class CreatePagoDto {
  @IsUUID()
  @IsNotEmpty()
  facturaId: string;

  @IsNumber()
  @Min(0.01, { message: 'El monto del pago debe ser mayor a cero' })
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
