import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

@Injectable()
export class RedisService {
  private readonly client: Redis;

  constructor(private configService: ConfigService) {
    const url = this.configService.getOrThrow<string>('UPSTASH_REDIS_REST_URL');
    const token = this.configService.getOrThrow<string>('UPSTASH_REDIS_REST_TOKEN');

    this.client = new Redis({ url, token });
  }

  getClient(): Redis {
    return this.client;
  }
}
