import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ConfigService } from './config.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';

@Controller('config/trabajadores')
@UseGuards(JwtAuthGuard) // Solo JWT a nivel de clase para permitir acceso base a todos los autenticados
export class WorkersController {
  constructor(private readonly configService: ConfigService) {}

  @Get('me')
  async findMe(@Req() req: any) {
    const user = req.user;

    // Buscar el usuario en la DB para obtener el responsableId actualizado
    const dbUser = await this.configService.findOneUser(user.id);

    // -- DEBUGGING --
    console.log(
      'DEBUG: User profile fetched from DB in findMe:',
      JSON.stringify(dbUser, null, 2),
    );
    // -- END DEBUGGING --

    if (!dbUser.responsableId) {
      throw new ForbiddenException(
        'Su usuario no tiene un perfil de trabajador vinculado',
      );
    }
    return this.configService.findOneWorker(dbUser.responsableId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  create(@Body() createWorkerDto: CreateWorkerDto) {
    return this.configService.createWorker(createWorkerDto);
  }

  @Get()
  findAll() {
    return this.configService.findAllWorkers();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  findOne(@Param('id') id: string) {
    return this.configService.findOneWorker(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateWorkerDto: UpdateWorkerDto,
    @Req() req: any,
  ) {
    const user = req.user;

    // Si no es admin, solo puede editar su propio perfil
    if (user.rol !== 'ADMIN') {
      const dbUser = await this.configService.findOneUser(user.id);
      if (dbUser.responsableId !== id) {
        throw new ForbiddenException(
          'No tiene permiso para editar este perfil',
        );
      }
    }

    return this.configService.updateWorker(id, updateWorkerDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.configService.removeWorker(id);
  }

  @Get(':id/documentos')
  async getDocuments(@Param('id') id: string) {
    const userDir = join(process.cwd(), 'uploads', 'trabajadores', id);
    
    const docTypes = [
      { key: 'dni', label: 'DNI' },
      { key: 'cv', label: 'CV / Currículum Vitae' },
      { key: 'contrato', label: 'Contrato' },
      { key: 'certificados', label: 'Certificados' },
      { key: 'emo', label: 'EMO (Examen Médico Ocupacional)' },
      { key: 'sctr', label: 'SCTR' },
      { key: 'seguro_vida', label: 'Seguro Vida Ley' },
      { key: 'licencia', label: 'Licencia de Conducir' },
      { key: 'capacitacion', label: 'Certificados de Capacitación' },
    ];

    const result = docTypes.map(doc => {
      const folderPath = join(userDir, doc.key);
      let fileInfo = null;

      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath);
        if (files.length > 0) {
          const filename = files[0];
          const stats = fs.statSync(join(folderPath, filename));
          fileInfo = {
            filename,
            url: `/uploads/trabajadores/${id}/${doc.key}/${filename}`,
            size: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
            uploadedAt: stats.mtime,
          };
        }
      }

      return {
        ...doc,
        file: fileInfo,
      };
    });

    return result;
  }

  @Post(':id/documento/:docType')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req: any, file: any, cb: any) => {
          const { id, docType } = req.params;
          const dir = join(process.cwd(), 'uploads', 'trabajadores', id, docType);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          // Limpiar archivos anteriores del mismo tipo en esa carpeta
          try {
            const files = fs.readdirSync(dir);
            for (const f of files) {
              fs.unlinkSync(join(dir, f));
            }
          } catch (e) {
            console.error("Error clearing old files:", e);
          }
          cb(null, dir);
        },
        filename: (req: any, file: any, cb: any) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  async uploadDocument(
    @Param('id') id: string,
    @Param('docType') docType: string,
    @UploadedFile() file: any,
  ) {
    if (!file) throw new Error('Archivo no válido.');
    return {
      url: `/uploads/trabajadores/${id}/${docType}/${file.filename}`,
      filename: file.filename,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
    };
  }
}
