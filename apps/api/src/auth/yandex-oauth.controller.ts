import { Controller, Get, Query, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { OAuthService } from './oauth.service';
import type { OAuthProfile } from './oauth.service';

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
  constructor(private readonly oauthService: OAuthService) {}

  private readonly clientId = process.env.YANDEX_CLIENT_ID || 'dev-client-id';
  private readonly clientSecret = process.env.YANDEX_CLIENT_SECRET || 'dev-secret';
  private readonly redirectUri =
    process.env.YANDEX_REDIRECT_URI || 'http://localhost:3000/auth/yandex/callback';

  /**
   * GET /auth/yandex
   * Инициирует OAuth flow — редирект на Yandex
   */
  @Get()
  initiateOAuth(@Res() res: Response) {
    const authUrl = new URL('https://oauth.yandex.ru/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', this.clientId);
    authUrl.searchParams.set('redirect_uri', this.redirectUri);
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
    if (error) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        message: 'Yandex OAuth error',
        error,
      });
    }

    if (!code) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        message: 'Authorization code not provided',
      });
    }

    try {
      // 1. Обмениваем code на access_token
      const tokenResponse = await fetch('https://oauth.yandex.ru/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange code for token');
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // 2. Получаем профиль пользователя
      const profileResponse = await fetch('https://login.yandex.ru/info', {
        headers: {
          Authorization: `OAuth ${accessToken}`,
        },
      });

      if (!profileResponse.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const profileData = await profileResponse.json();

      // 3. Формируем профиль для нашей системы
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
    } catch (err) {
      console.error('Yandex OAuth error:', err);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Failed to process Yandex OAuth',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }
}
