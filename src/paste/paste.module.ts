import { Module } from '@nestjs/common';
import { PasteController } from './paste.controller';
import { PasteService } from './paste.service';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { TurnstileGuard } from '../guards/turnstile.guard';

@Module({
  controllers: [PasteController],
  providers: [PasteService, RateLimitGuard, TurnstileGuard],
})
export class PasteModule {}
