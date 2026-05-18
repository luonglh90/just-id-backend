import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import {
  PASTE_TTL,
  SEEN_TTL,
  MAX_CONTENT_BYTES,
  MAX_CHARS,
} from '../common/constants';

@Injectable()
export class PasteService {
  constructor(private redisService: RedisService) {}

  /**
   * Validate content beyond basic DTO checks.
   */
  validateContent(content: string, delta: Record<string, unknown>): void {
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      throw new HttpException(
        { error: 'Content is required and must be a non-empty string' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check plain text character limit (strip HTML)
    const plainText = trimmed.replace(/<[^>]*>/g, '');
    if (plainText.length > MAX_CHARS) {
      throw new HttpException(
        {
          error: `Content exceeds ${MAX_CHARS} character limit (${plainText.length} characters)`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate delta has root object (Lexical state)
    if (!('root' in delta) || typeof delta.root !== 'object') {
      throw new HttpException(
        { error: "Delta must have a 'root' object" },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check storage size
    const stored = JSON.stringify({ content: trimmed, delta });
    const byteSize = new TextEncoder().encode(stored).length;
    if (byteSize > MAX_CONTENT_BYTES) {
      throw new HttpException(
        {
          error: `Content exceeds ${MAX_CONTENT_BYTES} byte storage limit (${byteSize} bytes). Try reducing formatting or content length.`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Create a paste with collision-safe ID generation.
   */
  async create(
    content: string,
    delta: Record<string, unknown>,
  ): Promise<{ id: string; expiresAt: number; expiresIn: number }> {
    const redis = this.redisService.getClient();
    const trimmed = content.trim();
    const value = JSON.stringify({ content: trimmed, delta });

    // Try generating a random ID and setting it with NX (only if not exists)
    for (let attempt = 0; attempt < 10; attempt++) {
      const id = this.generateMemoryFriendlyId();

      const claimed = await redis.set(`paste:${id}`, value, {
        nx: true,
        ex: PASTE_TTL,
      });

      if (claimed) {
        await redis.set(`seen:${id}`, '1', { ex: SEEN_TTL });
        const expiresAt = Math.floor(Date.now() / 1000) + PASTE_TTL;
        return { id, expiresAt, expiresIn: PASTE_TTL };
      }
    }

    throw new HttpException(
      { error: 'Failed to create paste due to high collision. Please try again.' },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  /**
   * Get a paste by ID. Returns data or throws 404/410.
   */
  async findOne(id: string): Promise<{
    id: string;
    content: string;
    delta: Record<string, unknown>;
    expiresAt: number;
    expiresIn: number;
  }> {
    const redis = this.redisService.getClient();
    const pasteKey = `paste:${id}`;

    const [data, ttl] = await Promise.all([
      redis.get<string>(pasteKey),
      redis.ttl(pasteKey),
    ]);

    if (data) {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      const expiresIn = Math.max(ttl, 0);
      const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
      return {
        id: String(id),
        content: parsed.content,
        delta: parsed.delta,
        expiresIn,
        expiresAt,
      };
    }

    // Check if the paste was recently created (for 410 vs 404)
    const wasSeen = await redis.exists(`seen:${id}`);
    if (wasSeen) {
      throw new HttpException(
        { error: 'This content has expired' },
        HttpStatus.GONE,
      );
    }

    throw new HttpException(
      { error: 'Content not found' },
      HttpStatus.NOT_FOUND,
    );
  }

  /**
   * Get slot availability info.
   * Uses DBSIZE as a fast approximation (includes seen:* keys too,
   * but avoids expensive SCAN on serverless).
   */
  async getStatus(): Promise<{ used: number }> {
    const redis = this.redisService.getClient();
    const dbsize = await redis.dbsize();
    // Each paste creates 2 keys: paste:{id} + seen:{id}
    // Active pastes ≈ dbsize / 2 (rough but fast)
    const used = Math.max(0, Math.floor(dbsize / 2));
    return { used };
  }

  /**
   * Memory-friendly ID generator based on patterns (A2B4, ABAB, etc.)
   * and avoiding easily confused characters like 0, 1, O, I.
   */
  private generateMemoryFriendlyId(): string {
    const safeDigits = ['2', '3', '4', '5', '6', '7', '8', '9'];
    const safeChars = [
      'A', 'B', 'H', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'W', 'X', 'Y', 'Z'
    ];
    
    const getSafeDigit = () => safeDigits[Math.floor(Math.random() * safeDigits.length)];
    const getSafeChar = () => safeChars[Math.floor(Math.random() * safeChars.length)];
    
    const patterns = [
      () => { // A2B4 (1 char 1 digit, 1 char 1 digit)
        return getSafeChar() + getSafeDigit() + getSafeChar() + getSafeDigit();
      },
      () => { // ABAB (e.g. T6T6)
        const a = getSafeChar();
        const b = getSafeDigit();
        return a + b + a + b;
      },
      () => { // AABB (e.g. KK88)
        const a = getSafeChar();
        const b = getSafeDigit();
        return a + a + b + b;
      },
      () => { // Near sequence digit (e.g. AB23)
        const start = Math.floor(Math.random() * 6) + 2; // 2 to 7
        return getSafeChar() + getSafeChar() + start + (start + 1);
      },
      () => { // Mixed
        return getSafeChar() + getSafeDigit() + getSafeDigit() + getSafeChar();
      }
    ];

    const rand = Math.random();
    let genIndex = 0;
    if (rand < 0.4) genIndex = 0;       // 40% A2B4
    else if (rand < 0.6) genIndex = 1;  // 20% ABAB
    else if (rand < 0.8) genIndex = 2;  // 20% AABB
    else if (rand < 0.9) genIndex = 3;  // 10% Near sequence
    else genIndex = 4;                  // 10% Mixed random

    return patterns[genIndex]();
  }
}
