import { IsString, IsNumber, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { EstadoHitoPago } from '@prisma/client';

export class CreateHitoPagoDto {
  @IsString()
  descripcion: string;

  @IsNumber()
  @Type(() => Number)
  porcentaje: number;

  @IsNumber()
  @Type(() => Number)
  monto: number;

  @IsOptional()
  @IsDateString()
  fechaEstimada?: string;

  @IsOptional()
  @IsEnum(EstadoHitoPago)
  estado?: EstadoHitoPago;
}
