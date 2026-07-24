import { Injectable, Logger, OnModuleInit, HttpException, HttpStatus } from '@nestjs/common';
import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import * as qrcodeLib from 'qrcode';
import * as path from 'path';
import { LibraryService } from '../library/library.service';

export interface WhatsAppStatus {
  isReady: boolean;
  qrCodeDataUrl: string | null;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  
  // Maps to hold multi-session data
  private clients = new Map<string, Client>();
  private statuses = new Map<string, WhatsAppStatus>();
  private abortedTasks = new Set<string>();

  constructor(private readonly libraryService: LibraryService) {}

  /**
   * Initializes or gets the WhatsApp client for a specific user ID.
   */
  private async getClientForUser(userId: string): Promise<Client> {
    if (this.clients.has(userId)) {
      return this.clients.get(userId)!;
    }

    this.logger.log(`Initializing WhatsApp for user ${userId}`);
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: userId, // Creates a specific folder in .wwebjs_auth for this user
        dataPath: path.join(process.cwd(), '.wwebjs_auth')
      }),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
      }
    });

    this.statuses.set(userId, { isReady: false, qrCodeDataUrl: null });
    this.clients.set(userId, client);

    client.on('qr', async (qr) => {
      this.logger.log(`QR Code received for user ${userId}`);
      try {
        const qrCodeDataUrl = await qrcodeLib.toDataURL(qr);
        this.statuses.set(userId, { isReady: false, qrCodeDataUrl });
      } catch (e) {
        this.logger.error(`Error generating QR data URL for user ${userId}`, e);
      }
    });

    client.on('ready', () => {
      this.logger.log(`Whatsapp Client is ready for user ${userId}!`);
      this.statuses.set(userId, { isReady: true, qrCodeDataUrl: null });
    });

    client.on('authenticated', () => {
      this.logger.log(`Whatsapp Client is authenticated for user ${userId}!`);
      this.statuses.set(userId, { isReady: false, qrCodeDataUrl: null });
    });

    client.on('auth_failure', msg => {
      this.logger.error(`Whatsapp auth failure for user ${userId}`, msg);
    });

    client.initialize();
    return client;
  }

  async getStatus(userId: string) {
    if (!this.clients.has(userId)) {
      await this.getClientForUser(userId); // Trigger init lazily
    }
    return this.statuses.get(userId) || { isReady: false, qrCodeDataUrl: null };
  }

  async cancelVideo(abortId: string) {
    if (abortId) {
      this.abortedTasks.add(abortId);
      // Clean up after 1 minute to avoid memory leaks
      setTimeout(() => this.abortedTasks.delete(abortId), 60000);
    }
  }

  async sendVideo(userId: string, phone: string, message: string, resourceId: string, abortId?: string): Promise<boolean> {
    const status = this.statuses.get(userId);
    if (!status || !status.isReady) {
      throw new HttpException('El cliente de WhatsApp no está listo para este usuario. Por favor escanea el código QR primero.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    
    const client = this.clients.get(userId)!;

    try {
      if (abortId && this.abortedTasks.has(abortId)) throw new Error('Aborted by user');

      const resources = await this.libraryService.getAll();
      const resource = resources.find(r => r.id === resourceId);
      if (!resource) {
        throw new HttpException('Resource not found', HttpStatus.NOT_FOUND);
      }

      const cleanPhone = phone.replace(/\D/g, '');
      const numberId = await client.getNumberId(cleanPhone);
      
      if (!numberId) {
        throw new HttpException(
          'El número proporcionado no tiene una cuenta de WhatsApp activa o no se pudo validar (No LID).', 
          HttpStatus.BAD_REQUEST
        );
      }

      if (abortId && this.abortedTasks.has(abortId)) throw new Error('Aborted by user');
      
      const drive = (this.libraryService as any).drive;
      if (!drive) {
        throw new Error('Google Drive API not initialized');
      }

      // Añadir un pequeño retraso (2.5s) para dar tiempo a que el usuario presione el botón Cancelar
      await new Promise(resolve => setTimeout(resolve, 2500));

      if (abortId && this.abortedTasks.has(abortId)) throw new Error('Aborted by user');

      const driveRes = await drive.files.get(
        { fileId: resource.driveFileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'arraybuffer' }
      );

      if (abortId && this.abortedTasks.has(abortId)) throw new Error('Aborted by user');

      const buffer = Buffer.from(driveRes.data);
      const base64Data = buffer.toString('base64');
      
      const media = new MessageMedia(resource.mimeType, base64Data, resource.fileName);

      if (abortId && this.abortedTasks.has(abortId)) throw new Error('Aborted by user');

      await client.sendMessage(numberId._serialized, media, { caption: message });
      
      return true;
    } catch (error: any) {
      if (error.message === 'Aborted by user') {
        this.logger.warn(`WhatsApp send aborted for ${phone} by user ${userId}`);
        return false;
      }
      
      this.logger.error(`Error validating whatsapp video request: ${error.message}`, error.stack);
      
      if (error.message && error.message.includes('No LID for user')) {
        throw new HttpException(
          'El número proporcionado no tiene una cuenta de WhatsApp activa o no se pudo validar (No LID).', 
          HttpStatus.BAD_REQUEST
        );
      }

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException('Failed to process whatsapp request: ' + error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
