import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
  'error-codes'?: string[];
}

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);
  private readonly secretKey: string | undefined;

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.get<string>('TURNSTILE_SECRET_KEY');
    if (!this.secretKey) {
      this.logger.warn(
        'TURNSTILE_SECRET_KEY not set — Turnstile verification will be skipped',
      );
    }
  }

  /**
   * Verify a Cloudflare Turnstile token server-side.
   */
  async verify(token: string, ip?: string): Promise<boolean> {
    if (!this.secretKey) {
      // Dev fallback only. In production the env var must be set.
      return true;
    }

    try {
      const body: Record<string, string> = {
        secret: this.secretKey,
        response: token,
      };

      if (ip) {
        body.remoteip = ip;
      }

      const response = await fetch(TURNSTILE_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body).toString(),
      });

      const data = (await response.json()) as TurnstileVerifyResponse;

      if (!data.success) {
        this.logger.warn(
          `Turnstile verification rejected. error-codes=${JSON.stringify(
            data['error-codes'] ?? [],
          )} hostname=${data.hostname ?? 'n/a'} ip=${ip ?? 'n/a'} tokenPrefix=${token.slice(0, 12)}…`,
        );
      }

      return data.success === true;
    } catch (error) {
      this.logger.error('Turnstile verification call failed', error as Error);
      return false;
    }
  }
}
