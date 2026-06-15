import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsOptional()
  rol?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @IsOptional()
  @IsString()
  responsableId?: string | null;

  @IsOptional()
  modulos?: any;
}
