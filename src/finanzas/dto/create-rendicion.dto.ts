import {
  IsString,
  IsOptional,
  IsNumber,
  IsNotEmpty,
  IsUUID,
  IsDateString,
} from 'class-validator';

export class CreateRendicionDto {
  @IsUUID()
  @IsNotEmpty()
  gastoId: string;

  @IsNumber()
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
