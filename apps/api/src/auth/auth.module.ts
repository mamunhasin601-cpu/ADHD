import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { AuthController } from './auth.controller';
import { YandexOAuthController } from './yandex-oauth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}), // секреты передаём динамически в AuthService.generateTokens
  ],
  controllers: [AuthController, YandexOAuthController],
  providers: [AuthService, OAuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
