import { IsEnum, IsString, IsOptional, IsUUID } from 'class-validator';
import { EstadoAprobacion } from '@prisma/client';

export class SubmitAprobacionDto {
  @IsEnum(EstadoAprobacion)
  estado: EstadoAprobacion;

  @IsString()
  @IsOptional()
  comentario?: string;
}
