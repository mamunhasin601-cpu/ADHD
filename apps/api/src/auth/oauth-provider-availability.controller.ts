import { ConfigService } from '@nestjs/config';
import { Controller, Get, Header } from '@nestjs/common';
import type { CoreEnvironment } from '../config/core-environment';

export interface OAuthProviderAvailability {
  yandex: boolean;
  vk: boolean;
  mailru: boolean;
}

@Controller('auth/oauth')
export class OAuthProviderAvailabilityController {
  constructor(
    private readonly config: ConfigService<CoreEnvironment, true>,
  ) {}

  @Get('providers')
  @Header('Cache-Control', 'no-store')
  getAvailability(): OAuthProviderAvailability {
    return {
      yandex: this.config.get('YANDEX_OAUTH_ENABLED'),
      vk: this.config.get('VK_OAUTH_ENABLED'),
      mailru: this.config.get('MAILRU_OAUTH_ENABLED'),
    };
  }
}
