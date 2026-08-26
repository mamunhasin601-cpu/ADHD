import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { AuthController } from './auth.controller';
import { YandexOAuthController } from './yandex-oauth.controller';
import { VkOAuthController } from './vk-oauth.controller';
import {MailruOAuthController } from './mailru-oauth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ExternalHttpModule } from '../external-http/external-http.module';
import { ContactVerificationController } from './contact-verification.controller';
import { ContactVerificationService } from './contact-verification.service';
import { ContactDeliveryService } from './contact-delivery.service';
import { TimewebEmailDeliveryService } from './timeweb-email-delivery.service';
import { OAuthProviderAvailabilityController } from './oauth-provider-availability.controller';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}), // секреты передаём динамически в AuthService.generateTokens
    ExternalHttpModule,
  ],
  controllers: [AuthController, OAuthProviderAvailabilityController, YandexOAuthController, VkOAuthController, MailruOAuthController, ContactVerificationController],
  providers: [AuthService, OAuthService, JwtStrategy, ContactVerificationService, ContactDeliveryService, TimewebEmailDeliveryService],
  exports: [AuthService, ContactVerificationService],
})
export class AuthModule {}
