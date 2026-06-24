import * as fs from 'fs/promises';
import { resolve, sep } from 'path';
import { Logger, BadRequestException } from '@nestjs/common';

const logger = new Logger('FileUtils');

/**
 * Elimina un archivo físico del disco de forma segura.
 * Solo permite borrar archivos dentro de la carpeta 'uploads'.
 */
export async function deletePhysicalFile(fileUrl: string | null | undefined): Promise<void> {
  if (!fileUrl) return;

  try {
    // Limpiar la ruta y resolverla
    const relativePath = fileUrl.startsWith('/') ? fileUrl.substring(1) : fileUrl;
    const absolutePath = resolve(process.cwd(), relativePath);
    const uploadsPath = resolve(process.cwd(), 'uploads');

    // Validar que la ruta esté dentro de uploads para evitar borrados accidentales del sistema
    if (!absolutePath.startsWith(uploadsPath + sep) && absolutePath !== uploadsPath) {
      logger.warn(`Intento de borrar archivo fuera de uploads denegado: ${absolutePath}`);
      return;
    }

    try {
      await fs.access(absolutePath);
    } catch {
      // Si el archivo no existe, simplemente ignoramos
      return;
    }

    await fs.unlink(absolutePath);
    logger.log(`Archivo eliminado con éxito: ${absolutePath}`);
  } catch (error) {
    logger.error(`Error al intentar eliminar el archivo ${fileUrl}: ${error.message}`);
    throw new BadRequestException(
      'No se pudo eliminar el documento físico asociado en el servidor. La operación fue cancelada para proteger la integridad de los datos. Por favor, inténtelo de nuevo o contacte al administrador.',
    );
  }
}

/**
 * Elimina múltiples archivos físicos en paralelo.
 */
export async function deletePhysicalFiles(fileUrls: (string | null | undefined)[]): Promise<void> {
  const uniqueUrls = [...new Set(fileUrls.filter(Boolean))];
  if (uniqueUrls.length === 0) return;
  
  await Promise.all(uniqueUrls.map(url => deletePhysicalFile(url)));
}
