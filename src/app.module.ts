import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PasteModule } from './paste/paste.module';
import { RedisService } from './redis/redis.service';
import { TurnstileService } from './turnstile/turnstile.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PasteModule,
  ],
  providers: [RedisService, TurnstileService],
  exports: [RedisService, TurnstileService],
})
export class AppModule {}
