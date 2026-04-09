import { Module } from '@nestjs/common';
import { OllamaService } from './ollama.service';
import { OllamaController } from './ollama.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [OllamaService],
  controllers: [OllamaController],
  exports: [OllamaService],
})
export class OllamaModule {}
