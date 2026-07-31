import { Controller, Get, Query, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { OAuthService } from './oauth.service';
import type { OAuthProfile } from './oauth.service';
import * as crypto from 'crypto';

/**
 * Mail.ru OAuth 2.0 flow
 *
 * Docs: https://api.mail.ru/docs/guides/oauth/
 *
 * Flow:
 * 1. Mobile app открывает /auth/mailru → редирект на Mail.ru
 * 2. Пользователь логинится в Mail.ru
 * 3. Mail.ru редиректит на /auth/mailru/callback с code
 * 4. Backend обменивает code на access_token
 * 5. Backend получает профиль пользователя
 * 6. Backend создаёт/находит User и возвращает JWT токены
 */
@Controller('auth/mailru')
export class MailruOAuthController {
  constructor(private readonly oauthService: OAuthService) {}

  private readonly clientId = process.env.MAILRU_CLIENT_ID || 'dev-client-id';
  private readonly clientSecret = process.env.MAILRU_CLIENT_SECRET || 'dev-secret';
  private readonly redirectUri =
    process.env.MAILRU_REDIRECT_URI || 'http://localhost:3000/auth/mailru/callback';

  /**
   * GET /auth/mailru
   * Инициирует OAuth flow — редирект на Mail.ru
   */
  @Get()
  initiateOAuth(@Res() res: Response) {
    const authUrl = new URL('https://oauth.mail.ru/login');
    authUrl.searchParams.set('client_id', this.clientId);
    authUrl.searchParams.set('redirect_uri', this.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'userinfo');

    res.redirect(authUrl.toString());
  }

  /**
   * GET /auth/mailru/callback
   * Обрабатывает callback от Mail.ru с authorization code
   */
  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    if (error) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        message: 'Mail.ru OAuth error',
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
      const tokenResponse = await fetch('https://oauth.mail.ru/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange code for token');
      }

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        throw new Error(`Mail.ru token error: ${tokenData.error_description}`);
      }

      const accessToken = tokenData.access_token;

      // 2. Получаем профиль пользователя
      // Mail.ru требует подпись запроса через sig параметр
      const params: Record<string, string> = {
        access_token: accessToken,
        app_id: this.clientId,
        method: 'users.getInfo',
        secure: '1',
        session_key: accessToken,
      };

      // Формируем sig: MD5(sorted_params + client_secret)
      const sortedParams = Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join('');
      const sig = crypto
        .createHash('md5')
        .update(sortedParams + this.clientSecret)
        .digest('hex');

      const profileUrl = new URL('https://www.appsmail.ru/platform/api');
      Object.entries({ ...params, sig }).forEach(([k, v]) =>
        profileUrl.searchParams.set(k, v),
      );

      const profileResponse = await fetch(profileUrl.toString());
      const profileData = await profileResponse.json();
      const mailruUser = Array.isArray(profileData) ? profileData[0] : null;

      if (!mailruUser) {
        throw new Error('Failed to fetch Mail.ru user profile');
      }

      // 3. Формируем профиль для нашей системы
      const profile: OAuthProfile = {
        provider: 'mailru',
        providerId: String(mailruUser.uid),
        email: mailruUser.email || undefined,
        firstName: mailruUser.first_name,
        lastName: mailruUser.last_name,
      };

      // 4. Создаём/находим пользователя и генерируем JWT токены
      const tokens = await this.oauthService.handleOAuthCallback(profile);

      // 5. Редирект обратно в mobile app с токенами
      const deepLink = new URL('focus://auth/callback');
      deepLink.searchParams.set('accessToken', tokens.accessToken);
      deepLink.searchParams.set('refreshToken', tokens.refreshToken);

      res.redirect(deepLink.toString());
    } catch (err) {
      console.error('Mail.ru OAuth error:', err);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Failed to process Mail.ru OAuth',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }
}
