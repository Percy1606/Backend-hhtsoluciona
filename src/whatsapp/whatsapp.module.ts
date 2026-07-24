import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { LibraryModule } from '../library/library.module';

@Module({
  imports: [LibraryModule],
  controllers: [WhatsappController],
  providers: [WhatsappService],
  exports: [WhatsappService]
})
export class WhatsappModule {}
