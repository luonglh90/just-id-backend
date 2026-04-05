import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PasteService } from './paste.service';
import { CreatePasteDto } from './dto/create-paste.dto';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { TurnstileGuard } from '../guards/turnstile.guard';
import { RateLimit } from '../guards/rate-limit.decorator';

@Controller()
export class PasteController {
  constructor(
    private pasteService: PasteService,
    private configService: ConfigService,
  ) {}

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  @RateLimit('create')
  @UseGuards(RateLimitGuard, TurnstileGuard)
  async create(@Body() dto: CreatePasteDto) {
    // Additional validation beyond DTO
    this.pasteService.validateContent(dto.content, dto.delta);

    const result = await this.pasteService.create(dto.content, dto.delta);
    const baseUrl =
      this.configService.get<string>('BASE_URL') || 'http://localhost:5173';

    return {
      id: String(result.id),
      url: `${baseUrl}/${result.id}`,
      expiresAt: result.expiresAt,
      expiresIn: result.expiresIn,
    };
  }

  @Get('status')
  @RateLimit('status')
  @UseGuards(RateLimitGuard)
  async getStatus() {
    return this.pasteService.getStatus();
  }

  @Get(':id')
  @RateLimit('view')
  @UseGuards(RateLimitGuard)
  async findOne(@Param('id') id: string) {
    if (!id || id.length !== 4) {
      throw new HttpException(
        { error: 'Invalid paste ID' },
        HttpStatus.NOT_FOUND,
      );
    }

    return this.pasteService.findOne(id);
  }
}
