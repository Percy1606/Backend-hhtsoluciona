import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';

export class CreateCotizacionDto {
  @IsString()
  clientId: string;

  @IsNumber()
  monto: number;

  @IsString()
  estado: string;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsString()
  validez?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsString()
  referencia?: string;

  @IsOptional()
  @IsString()
  objetivo?: string;

  @IsOptional()
  alcance?: any;

  @IsOptional()
  @IsString()
  consideraciones?: string;

  @IsOptional()
  @IsString()
  entregables?: string;

  @IsOptional()
  @IsString()
  plazo?: string;

  @IsOptional()
  @IsString()
  formaPago?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  fileType?: string;

  @IsOptional()
  @IsNumber()
  version?: number;

  @IsOptional()
  @IsString()
  cotizacionPadreId?: string;
}
