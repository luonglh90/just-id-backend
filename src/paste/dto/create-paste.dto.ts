import { IsString, IsNotEmpty, IsObject } from 'class-validator';

export class CreatePasteDto {
  @IsString({ message: 'Content must be a string' })
  @IsNotEmpty({ message: 'Content is required and must be a non-empty string' })
  content!: string;

  @IsObject({ message: 'Delta must be a valid JSON object' })
  @IsNotEmpty({ message: 'Delta is required' })
  delta!: Record<string, unknown>;

  @IsString({ message: 'Turnstile token must be a string' })
  @IsNotEmpty({ message: 'Turnstile verification token is required' })
  turnstileToken!: string;
}
