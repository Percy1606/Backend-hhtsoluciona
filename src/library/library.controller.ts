import { Controller, Get, Post, Delete, Param, Body, UseInterceptors, UploadedFile, UseGuards, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LibraryService } from './library.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Assuming there is a JwtAuthGuard

@Controller('commercial-library')
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get()
  async getAll() {
    return this.libraryService.getAll();
  }

  @Get('folders')
  async getFolders() {
    return this.libraryService.getFolders();
  }

  @Get('stream/:id')
  async streamVideo(@Param('id') id: string, @Res() res: any) {
    return this.libraryService.streamVideo(id, res);
  }

  // NOTE: You can uncomment UseGuards to enforce auth, but the user said "todos los usuarios pueden verlo".
  // Assuming upload should still be protected. If not, remove UseGuards.
  // @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    if (!file) {
      throw new Error('No file provided');
    }
    return this.libraryService.uploadResource(file, body);
  }

  // @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.libraryService.deleteResource(id);
  }
}
