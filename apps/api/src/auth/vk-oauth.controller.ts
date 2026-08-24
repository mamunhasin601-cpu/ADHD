import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { OAuthService } from './oauth.service';
import type { OAuthProfile } from './oauth.service';
import { ExternalHttpService } from '../external-http/external-http.service';
import {
  OAuthAccountLinkingRequiredError,
  OAUTH_ACCOUNT_LINKING_REQUIRED_RESPONSE,
} from './oauth-account-linking.error';

/**
 * VK OAuth 2.0 flow
 *
 * Docs: https://dev.vk.com/api/oauth-parameters
 *
 * Flow:
 * 1. Mobile app открывает /auth/vk → редирект на VK
 * 2. Пользователь логинится в VK
 * 3. VK редиректит на /auth/vk/callback с code
 * 4. Backend обменивает code на access_token
 * 5. Backend получает профиль пользователя
 * 6. Backend создаёт/находит User и возвращает JWT токены
 */
@Controller('auth/vk')
export class VkOAuthController {
  constructor(private readonly oauthService: OAuthService, private readonly externalHttp: ExternalHttpService) {}

  private readonly clientId = process.env.VK_CLIENT_ID || 'dev-client-id';
  private readonly clientSecret = process.env.VK_CLIENT_SECRET || 'dev-secret';
  private readonly redirectUri =
    process.env.VK_REDIRECT_URI || 'http://localhost:3000/auth/vk/callback';

  /**
   * GET /auth/vk
   * Инициирует OAuth flow — редирект на VK
   */
  @Get()
  initiateOAuth(@Res() res: Response) {
    const authUrl = new URL('https://oauth.vk.com/authorize');
    authUrl.searchParams.set('client_id', this.clientId);
    authUrl.searchParams.set('redirect_uri', this.redirectUri);
    authUrl.searchParams.set('scope', 'email');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('v', '5.131');

    res.redirect(authUrl.toString());
  }

  /**
   * GET /auth/vk/callback
   * Обрабатывает callback от VK с authorization code
   */
  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Res() res: Response,
  ) {
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
      //1. Обмениваем code на access_token
      // VK возвращает email вответе на token запрос (не в profile)
      const tokenUrl = new URL('https://oauth.vk.com/access_token');
      tokenUrl.searchParams.set('client_id', this.clientId);
      tokenUrl.searchParams.set('client_secret', this.clientSecret);
      tokenUrl.searchParams.set('redirect_uri', this.redirectUri);
      tokenUrl.searchParams.set('code', code);

      const tokenData = await this.externalHttp.requestJson<any>({ operation: 'vk.token', url: tokenUrl.toString(), retry: 'none' });

      if (tokenData.error || !tokenData.access_token || tokenData.user_id == null) {
        throw new Error('VK token exchange rejected');
      }

      const accessToken = tokenData.access_token;
      const vkUserId = String(tokenData.user_id);
      // VK возвращает email в ответе на token, если был запрошен scope email
      const email = tokenData.email || null;

      // 2. Получаем профиль пользователя (имя, фамилия)
      const profileUrl = new URL('https://api.vk.com/method/users.get');
      profileUrl.searchParams.set('user_ids', vkUserId);
      profileUrl.searchParams.set('fields', 'first_name,last_name');
      profileUrl.searchParams.set('access_token', accessToken);
      profileUrl.searchParams.set('v', '5.131');

      const profileData = await this.externalHttp.requestJson<any>({ operation: 'vk.profile', url: profileUrl.toString(), retry: 'safe-transient' });
      const vkUser = profileData.response?.[0];

      // 3. Формируем профиль для нашей системы
      const profile: OAuthProfile = {
        provider: 'vk',
        providerId: vkUserId,
        email: email || undefined,
        firstName: vkUser?.first_name,
        lastName: vkUser?.last_name,
      };

      // 4. Создаём/находим пользователя и генерируем JWT токены
      const tokens = await this.oauthService.handleOAuthCallback(profile);

      // 5. Редирект обратно в mobile app с токенами
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
        message: 'Failed to process VK OAuth',
      });
    }
  }
}
