import { IsString, IsOptional, IsNumber, IsDateString, IsJSON, IsArray } from 'class-validator';

export class CreateClienteDto {
  @IsString()
  codigo: string;

  @IsString()
  empresa: string;

  @IsString()
  ruc: string;

  @IsString()
  direccion: string;

  @IsString()
  tarifa: string;

  @IsString()
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

  @IsString()
  asignadoA: string;

  @IsOptional()
  @IsString()
  diaTrabajo?: string;

  @IsString()
  estado: string;

  @IsString()
  prioridad: string;

  @IsString()
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
  zona: string;

  @IsString()
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
  @IsString()
  tipoCliente?: string;

  @IsString()
  etapaComercial: string;

  @IsOptional()
  hallazgosTecnicos?: any;

  @IsOptional()
  solucionesPropuestas?: any;

  @IsOptional()
  @IsString()
  propuestaTecnicaUrl?: string;
}
