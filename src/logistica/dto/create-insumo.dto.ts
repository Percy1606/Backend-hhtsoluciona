import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateInsumoDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsString()
  @IsNotEmpty()
  unidadMedida: string;

  @IsNumber()
  @Min(0)
  stockActual: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  stockMinimo?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  precioReferencial?: number;

  @IsString()
  @IsOptional()
  categoria?: string;
}
