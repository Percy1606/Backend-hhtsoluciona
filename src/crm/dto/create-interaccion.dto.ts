import { IsString, IsOptional, IsDateString } from 'class-validator';

export class CreateInteraccionDto {
  @IsString()
  clientId: string;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsString()
  tipo: string;

  @IsString()
  accion: string;

  @IsString()
  observaciones: string;

  @IsString()
  usuario: string;
}
