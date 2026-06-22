import { IsString, IsOptional, IsNumber, IsDateString, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateHitoPagoDto } from './create-hito-pago.dto';

export class CreateCotizacionDto {
  @IsString()
  clientId: string;

  @IsNumber()
  @Min(0, { message: 'El monto no puede ser negativo.' })
  @Max(1000000000, { message: 'El monto no puede exceder los 1,000 millones.' })
  @Type(() => Number)
  monto: number;

  @IsString()
  @IsOptional()
  moneda?: string;

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
  cajaId?: string;

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
  @Type(() => Number)
  version?: number;

  @IsOptional()
  @IsString()
  cotizacionPadreId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateHitoPagoDto)
  hitos?: CreateHitoPagoDto[];

  @IsOptional()
  @IsString()
  liderId?: string;
}
