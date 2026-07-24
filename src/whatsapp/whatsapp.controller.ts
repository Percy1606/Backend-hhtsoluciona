import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('status')
  async getStatus(@Query('userId') userId: string) {
    if (!userId) throw new Error('userId is required');
    return this.whatsappService.getStatus(userId);
  }

  @Post('send-video')
  async sendVideo(@Body() body: { userId: string, phone: string, message: string, resourceId: string, abortId?: string }) {
    const { userId, phone, message, resourceId, abortId } = body;
    if (!userId || !phone || !resourceId) {
      throw new Error('userId, phone and resourceId are required');
    }
    const success = await this.whatsappService.sendVideo(userId, phone, message || '', resourceId, abortId);
    return { success };
  }

  @Post('cancel-video')
  async cancelVideo(@Body() body: { abortId: string }) {
    if (body.abortId) {
      await this.whatsappService.cancelVideo(body.abortId);
    }
    return { success: true };
  }
}
