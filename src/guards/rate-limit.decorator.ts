import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_TYPE_KEY = 'rateLimitType';
export type RateLimitType = 'create' | 'view' | 'status';

/**
 * Decorator to specify which rate limit to apply to a route.
 * Usage: @RateLimit('create')
 */
export const RateLimit = (type: RateLimitType) =>
  SetMetadata(RATE_LIMIT_TYPE_KEY, type);
