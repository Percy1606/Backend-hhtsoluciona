import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsJSON,
  IsArray,
  IsEnum,
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';
import { TipoCliente, ClasificacionCliente } from '@prisma/client';

export class CreateClienteDto {
  @IsOptional()
  @IsString()
  codigo?: string;

  @IsString()
  @IsNotEmpty({ message: 'La empresa es obligatoria' })
  empresa: string;

  @IsString()
  @IsOptional()
  ruc?: string;

  @IsString()
  @IsNotEmpty({ message: 'La dirección es obligatoria' })
  direccion: string;

  @IsString()
  @IsNotEmpty({ message: 'La tarifa es obligatoria' })
  tarifa: string;

  @IsString()
  @IsNotEmpty({ message: 'El contacto es obligatorio' })
  contacto: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  cargo?: string;

  @IsOptional()
  @IsString()
  correo?: string;

  @IsOptional()
  @IsString()
  linkedin?: string;

  @IsOptional()
  @IsString()
  cartera?: string;

  @IsString()
  @IsNotEmpty({ message: 'El usuario asignado es obligatorio' })
  asignadoA: string;

  @IsOptional()
  @IsString()
  responsableId?: string;

  @IsOptional()
  @IsString()
  diaTrabajo?: string;

  @IsString()
  @IsNotEmpty({ message: 'El estado es obligatorio' })
  estado: string;

  @IsString()
  @IsNotEmpty({ message: 'La prioridad es obligatoria' })
  prioridad: string;

  @IsString()
  @IsNotEmpty({ message: 'La acción es obligatoria' })
  accion: string;

  @IsOptional()
  @IsDateString()
  ultimoContacto?: string;

  @IsOptional()
  @IsDateString()
  proximoSeguimiento?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsString()
  @IsNotEmpty({ message: 'La zona es obligatoria' })
  zona: string;

  @IsString()
  @IsNotEmpty({ message: 'El semáforo es obligatorio' })
  semaforo: string;

  @IsOptional()
  @IsString()
  temperatura?: string;

  @IsOptional()
  @IsNumber()
  montoEstimado?: number;

  @IsOptional()
  @IsNumber()
  probabilidad?: number;

  @IsOptional()
  @IsNumber()
  ventaProyectada?: number;

  @IsOptional()
  @IsEnum(TipoCliente)
  tipoCliente?: TipoCliente;

  @IsOptional()
  @IsEnum(ClasificacionCliente)
  clasificacion?: ClasificacionCliente;

  @IsOptional()
  @IsBoolean()
  esClienteReal?: boolean;

  @IsString()
  @IsNotEmpty({ message: 'La etapa comercial es obligatoria' })
  etapaComercial: string;

  @IsOptional()
  hallazgosTecnicos?: any;

  @IsOptional()
  solucionesPropuestas?: any;

  @IsOptional()
  @IsString()
  propuestaTecnicaUrl?: string;
}
