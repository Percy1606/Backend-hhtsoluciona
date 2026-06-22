import { PartialType } from '@nestjs/mapped-types';
import { CreateCotizacionDto } from './create-cotizacion.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateCotizacionDto extends PartialType(CreateCotizacionDto) {
  @IsOptional()
  @IsString()
  liderId?: string;
}
