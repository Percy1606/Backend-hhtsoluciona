import { Injectable, OnModuleInit, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { google, drive_v3 } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';

export interface LibraryResource {
  id: string;
  title: string;
  description: string;
  clientOrService: string;
  date: string;
  category: string;
  driveFileId: string;
  driveWebViewLink?: string;
  driveWebContentLink?: string;
  mimeType: string;
  fileName: string;
  createdAt: string;
}

@Injectable()
export class LibraryService implements OnModuleInit {
  private readonly logger = new Logger(LibraryService.name);
  private drive: drive_v3.Drive;
  private readonly dbFilePath = path.join(process.cwd(), 'library_db.json');
  private readonly driveFolderId = '12ZUJiugv84BpM-I1pMWQfu9bldqrPU67';
  
  async onModuleInit() {
    this.initDb();
    await this.initGoogleDrive();
  }

  private initDb() {
    if (!fs.existsSync(this.dbFilePath)) {
      fs.writeFileSync(this.dbFilePath, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  private async initGoogleDrive() {
    try {
      const keyPath = path.join(process.cwd(), 'oauth-credentials.json');
      if (!fs.existsSync(keyPath)) {
        this.logger.warn(`OAuth credentials not found at ${keyPath}. Uploads will fail.`);
        return;
      }

      const tokens = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      
      const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
      const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
      const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3005';

      const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
      oAuth2Client.setCredentials(tokens);

      this.drive = google.drive({ version: 'v3', auth: oAuth2Client });
      this.logger.log('Google Drive API initialized successfully with OAuth.');
    } catch (error) {
      this.logger.error('Failed to initialize Google Drive API', error);
    }
  }

  private getResources(): LibraryResource[] {
    try {
      const data = fs.readFileSync(this.dbFilePath, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      this.logger.error('Error reading db', e);
      return [];
    }
  }

  private saveResources(resources: LibraryResource[]) {
    fs.writeFileSync(this.dbFilePath, JSON.stringify(resources, null, 2), 'utf-8');
  }

  async getAll(): Promise<LibraryResource[]> {
    return this.getResources().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getFolders(): Promise<any[]> {
    if (!this.drive) {
      throw new HttpException('Google Drive API not initialized', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    try {
      const res = await this.drive.files.list({
        q: `'${this.driveFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      return res.data.files || [];
    } catch (error: any) {
      this.logger.error(`Error fetching folders from Drive: ${error.message}`, error.stack);
      throw new HttpException('Error fetching folders from Drive', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async uploadResource(file: Express.Multer.File, body: any): Promise<LibraryResource> {
    if (!this.drive) {
      throw new HttpException('Google Drive API not initialized', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      const fileStream = Readable.from(file.buffer);

      const targetFolderId = body.folderId || this.driveFolderId;

      const requestBody = {
        name: file.originalname,
        parents: [targetFolderId],
      };

      const media = {
        mimeType: file.mimetype,
        body: fileStream,
      };

      const driveRes = await this.drive.files.create({
        requestBody,
        media,
        fields: 'id, webViewLink, webContentLink',
        supportsAllDrives: true
      });

      const fileId = driveRes.data.id;
      if (!fileId) throw new Error('File ID not returned from Drive');
      
      try {
        await this.drive.permissions.create({
          fileId: fileId,
          requestBody: {
            role: 'reader',
            type: 'anyone',
          },
          supportsAllDrives: true
        });
      } catch(e) {
        this.logger.error('Could not set permissions', e);
      }

      const resources = this.getResources();
      const newResource: LibraryResource = {
        id: uuidv4(),
        title: body.title || 'Sin título',
        description: body.description || '',
        clientOrService: body.clientOrService || '',
        date: body.date || new Date().toISOString(),
        category: body.category || 'general',
        driveFileId: fileId,
        driveWebViewLink: driveRes.data.webViewLink || undefined,
        driveWebContentLink: driveRes.data.webContentLink || undefined,
        mimeType: file.mimetype,
        fileName: file.originalname,
        createdAt: new Date().toISOString(),
      };

      resources.push(newResource);
      this.saveResources(resources);

      return newResource;
    } catch (error: any) {
      this.logger.error(`Error uploading file to Drive: ${error.message}`, error.stack);
      throw new HttpException(
        error.message || 'Error uploading file to Drive', 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async deleteResource(id: string): Promise<boolean> {
    const resources = this.getResources();
    const index = resources.findIndex(r => r.id === id);
    if (index === -1) {
      throw new HttpException('Resource not found', HttpStatus.NOT_FOUND);
    }

    const resource = resources[index];
    
    if (this.drive) {
      try {
        await this.drive.files.delete({ 
          fileId: resource.driveFileId,
          supportsAllDrives: true 
        });
      } catch (error) {
        this.logger.warn(`Could not delete file ${resource.driveFileId} from Drive: ${error.message}`);
      }
    }

    resources.splice(index, 1);
    this.saveResources(resources);
    
    return true;
  }

  async streamVideo(id: string, res: any) {
    if (!this.drive) {
      throw new HttpException('Google Drive API not initialized', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    
    // Check if resource exists
    const resources = this.getResources();
    const resource = resources.find(r => r.id === id);
    if (!resource) {
      throw new HttpException('Resource not found', HttpStatus.NOT_FOUND);
    }

    try {
      res.setHeader('Content-Type', resource.mimeType);
      
      const driveRes = await this.drive.files.get(
        { fileId: resource.driveFileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream' }
      );

      driveRes.data.on('error', (err: any) => {
        this.logger.error('Error downloading stream from Drive', err);
      });

      driveRes.data.pipe(res);
    } catch (error: any) {
      this.logger.error(`Error streaming file from Drive: ${error.message}`);
      res.status(500).send('Error streaming video');
    }
  }
}
