import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { TurnstileService } from '../turnstile/turnstile.service';
import type { Request } from 'express';

/**
 * Guard that verifies the Cloudflare Turnstile token from the request body.
 * Only apply to POST routes that require bot protection.
 */
@Injectable()
export class TurnstileGuard implements CanActivate {
  constructor(private turnstileService: TurnstileService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.body?.turnstileToken;

    if (!token || typeof token !== 'string') {
      throw new HttpException(
        { error: 'Turnstile verification token is required' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const ip = this.getClientIp(request);
    const isValid = await this.turnstileService.verify(token, ip);

    if (!isValid) {
      throw new HttpException(
        { error: 'Bot verification failed. Please try again.' },
        HttpStatus.FORBIDDEN,
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
