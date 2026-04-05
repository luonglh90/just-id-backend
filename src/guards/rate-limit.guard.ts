import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Ratelimit } from '@upstash/ratelimit';
import { RedisService } from '../redis/redis.service';
import {
  RATE_LIMIT_TYPE_KEY,
  type RateLimitType,
} from './rate-limit.decorator';
import type { Request } from 'express';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private limiters: Map<string, Ratelimit> | null = null;

  constructor(
    private reflector: Reflector,
    private redisService: RedisService,
  ) {}

  private getLimiters(): Map<string, Ratelimit> {
    if (!this.limiters) {
      const redis = this.redisService.getClient();
      this.limiters = new Map<string, Ratelimit>([
        [
          'create',
          new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(5, '1 m'),
            prefix: 'rl:create',
          }),
        ],
        [
          'view',
          new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(15, '1 m'),
            prefix: 'rl:view',
          }),
        ],
        [
          'status',
          new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(15, '1 m'),
            prefix: 'rl:status',
          }),
        ],
      ]);
    }
    return this.limiters;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const type = this.reflector.get<RateLimitType>(
      RATE_LIMIT_TYPE_KEY,
      context.getHandler(),
    );

    if (!type) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIp(request);
    const limiter = this.getLimiters().get(type);

    if (!limiter) return true;

    const result = await limiter.limit(ip);

    if (!result.success) {
      const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
      throw new HttpException(
        { error: 'Rate limit exceeded', retryAfter },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return (request.headers['x-real-ip'] as string) || request.ip || 'unknown';
  }
}
