import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

class OrdenItemDto {
  @IsString()
  @IsNotEmpty()
  insumoId: string;

  @IsNumber()
  @Min(0.01)
  cantidad: number;

  @IsNumber()
  @Min(0)
  precioUnitario: number;
}

export class CreateOrdenCompraDto {
  @IsOptional()
  @IsString()
  codigo?: string;

  @IsString()
  @IsNotEmpty()
  proveedorId: string;

  @IsOptional()
  @IsString()
  proyectoId?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsString()
  archivoFactura?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrdenItemDto)
  items: OrdenItemDto[];

  @IsOptional()
  @IsBoolean()
  aprobarConCredito?: boolean;
}
