import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

@Injectable()
export class TurnstileService {
  private readonly secretKey: string | undefined;

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.get<string>('TURNSTILE_SECRET_KEY');
  }

  /**
   * Verify a Cloudflare Turnstile token server-side.
   */
  async verify(token: string, ip?: string): Promise<boolean> {
    if (!this.secretKey) {
      console.warn('TURNSTILE_SECRET_KEY not set — skipping verification');
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

      const data = (await response.json()) as { success: boolean };
      return data.success === true;
    } catch (error) {
      console.error('Turnstile verification failed:', error);
      return false;
    }
  }
}
