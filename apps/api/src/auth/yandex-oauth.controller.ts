import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import type { CoreEnvironment } from '../config/core-environment';
import { OAuthService } from './oauth.service';
import type { OAuthProfile } from './oauth.service';
import { ExternalHttpService } from '../external-http/external-http.service';
import {
  OAuthAccountLinkingRequiredError,
  OAUTH_ACCOUNT_LINKING_REQUIRED_RESPONSE,
} from './oauth-account-linking.error';
import { OAUTH_PROVIDER_UNAVAILABLE_RESPONSE } from './oauth-provider-unavailable';

/**
 * Yandex OAuth 2.0 flow
 * 
 * Docs: https://yandex.ru/dev/id/doc/ru/
 * 
 * Flow:
 * 1. Mobile app открывает /auth/yandex → редирект на Yandex
 * 2. Пользователь логинится на Yandex
 * 3. Yandex редиректит на /auth/yandex/callback с code
 * 4. Backend обменивает code на access_token
 * 5. Backend получает профиль пользователя
 * 6. Backend создаёт/находит User и возвращает JWT токены
 */
@Controller('auth/yandex')
export class YandexOAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly externalHttp: ExternalHttpService,
    private readonly config: ConfigService<CoreEnvironment, true>,
  ) {}

  private unavailable(res: Response) {
    return res
      .status(HttpStatus.SERVICE_UNAVAILABLE)
      .json(OAUTH_PROVIDER_UNAVAILABLE_RESPONSE);
  }

  /**
   * GET /auth/yandex
   * Инициирует OAuth flow — редирект на Yandex
   */
  @Get()
  initiateOAuth(@Res() res: Response) {
    if (!this.config.get('YANDEX_OAUTH_ENABLED')) return this.unavailable(res);
    const clientId = this.config.getOrThrow('YANDEX_CLIENT_ID');
    const redirectUri = this.config.getOrThrow('YANDEX_REDIRECT_URI');
    const authUrl = new URL('https://oauth.yandex.ru/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'login:email login:info');

    res.redirect(authUrl.toString());
  }

  /**
   * GET /auth/yandex/callback
   * Обрабатывает callback от Yandex с authorization code
   */
  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    if (!this.config.get('YANDEX_OAUTH_ENABLED')) return this.unavailable(res);
    const clientId = this.config.getOrThrow('YANDEX_CLIENT_ID');
    const clientSecret = this.config.getOrThrow('YANDEX_CLIENT_SECRET');
    if (error) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        message: 'OAuth callback was not accepted',
      });
    }

    if (!code) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        message: 'Authorization code not provided',
      });
    }

    try {
      // 1. Обмениваем code на access_token
      const tokenData = await this.externalHttp.requestJson<any>({
        operation: 'yandex.token',
        retry: 'none',
        url: 'https://oauth.yandex.ru/token',
        options: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: clientId,
          client_secret: clientSecret,
        }),
        },
      });
      if (tokenData.error || !tokenData.access_token) {
        throw new Error('Yandex token exchange rejected');
      }
      const accessToken = tokenData.access_token;

      // 2. Получаем профиль пользователя
      const profileData = await this.externalHttp.requestJson<any>({
        operation: 'yandex.profile',
        retry: 'safe-transient',
        url: 'https://login.yandex.ru/info',
        options: { headers: {
          Authorization: `OAuth ${accessToken}`,
        } },
      });

      // 3. Формируем профиль для нашей системы
      if (
        typeof profileData.id !== 'string' ||
        profileData.id.trim().length === 0
      ) {
        throw new Error('Yandex profile is invalid');
      }
      const profile: OAuthProfile = {
        provider: 'yandex',
        providerId: profileData.id,
        email: profileData.default_email || profileData.emails?.[0],
        firstName: profileData.first_name,
        lastName: profileData.last_name,
      };

      // 4. Создаём/находим пользователя и генерируем JWT токены
      const tokens = await this.oauthService.handleOAuthCallback(profile);

      // 5. Редирект обратно в mobile app с токенами
      // Deep link: focus://auth/callback?accessToken=...&refreshToken=...
      const deepLink = new URL('focus://auth/callback');
      deepLink.searchParams.set('accessToken', tokens.accessToken);
      deepLink.searchParams.set('refreshToken', tokens.refreshToken);

      res.redirect(deepLink.toString());
    } catch (error) {
      if (error instanceof OAuthAccountLinkingRequiredError) {
        return res
          .status(HttpStatus.CONFLICT)
          .json(OAUTH_ACCOUNT_LINKING_REQUIRED_RESPONSE);
      }
      if (error instanceof BadRequestException) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message: 'OAuth profile did not include a usable identity',
        });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Failed to process Yandex OAuth',
      });
    }
  }
}
