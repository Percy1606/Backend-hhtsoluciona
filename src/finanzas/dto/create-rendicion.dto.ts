import {
  IsString,
  IsOptional,
  IsNumber,
  IsNotEmpty,
  IsUUID,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateRendicionDto {
  @IsUUID()
  @IsNotEmpty()
  gastoId: string;

  @IsNumber()
  @Min(0.01, { message: 'El monto debe ser mayor a cero' })
  @IsNotEmpty()
  monto: number;

  @IsDateString()
  @IsOptional()
  fecha?: string;

  @IsString()
  @IsOptional()
  comprobanteUrl?: string;

  @IsString()
  @IsOptional()
  observaciones?: string;

  @IsUUID()
  @IsNotEmpty()
  registradoPorId: string;
}
