import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';

@Injectable()
export class ConfigService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // USUARIOS
  // ============================================

  async findAllUsers() {
    try {
      const users = await this.prisma.usuario.findMany({
        include: {
          responsable: true,
        },
      });
      
      // Ensure modulos is always an array
      return users.map(user => {
        let modulos = user.modulos;
        if (typeof modulos === 'string') {
          try {
            modulos = JSON.parse(modulos);
          } catch (e) {
            modulos = ['dashboard'];
          }
        }
        if (!Array.isArray(modulos)) {
          modulos = ['dashboard'];
        }
        return {
          ...user,
          modulos,
        };
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  async findOneUser(id: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { id },
      include: { responsable: true },
    });
    if (!user) throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    return user;
  }

  async createUser(dto: CreateUserDto) {
    const existing = await this.prisma.usuario.findUnique({
      where: { username: dto.username },
    });
    if (existing) throw new ConflictException('El nombre de usuario ya existe');

    const hashedPassword = await bcrypt.hash(dto.password || '123456', 10);
    const modulos = dto.modulos || ['dashboard'];

    return this.prisma.usuario.create({
      data: {
        ...dto,
        password: hashedPassword,
        modulos,
      },
    });
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const user = await this.findOneUser(id);

    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma.usuario.update({
      where: { id },
      data: {
        ...dto,
        modulos: dto.modulos !== undefined ? dto.modulos : undefined,
      },
    });
  }

  async removeUser(id: string) {
    await this.findOneUser(id);
    return this.prisma.usuario.update({
      where: { id },
      data: { activo: false },
    });
  }

  // ============================================
  // TRABAJADORES (RESPONSABLES)
  // ============================================

  async findAllWorkers() {
    return this.prisma.responsable.findMany({
      include: { usuario: true },
    });
  }

  async findOneWorker(id: string) {
    const worker = await this.prisma.responsable.findUnique({
      where: { id },
      include: { usuario: true },
    });
    if (!worker) throw new NotFoundException(`Trabajador con ID ${id} no encontrado`);
    return worker;
  }

  async createWorker(dto: CreateWorkerDto) {
    return this.prisma.responsable.create({
      data: dto,
    });
  }

  async updateWorker(id: string, dto: UpdateWorkerDto) {
    await this.findOneWorker(id);
    return this.prisma.responsable.update({
      where: { id },
      data: dto,
    });
  }

  async removeWorker(id: string) {
    await this.findOneWorker(id);
    return this.prisma.responsable.update({
      where: { id },
      data: { activo: false },
    });
  }
}
