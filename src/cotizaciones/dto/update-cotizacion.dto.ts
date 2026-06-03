import { PartialType } from '@nestjs/mapped-types';
import { CreateCotizacionDto } from './create-cotizacion.dto';

export class UpdateCotizacionDto extends PartialType(CreateCotizacionDto) {}
