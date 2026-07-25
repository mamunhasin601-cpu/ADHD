import { IsString, Matches } from 'class-validator';

export class RegisterPushTokenDto {
  /**
   * Expo push token формата ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
   * или нативный FCM/APNs токен.
   */
  @IsString()
  @Matches(
    /^ExponentPushToken\[.+\]$|^[a-zA-Z0-9_-]{100,}$/,
    { message: 'Некорректный формат Expo push token' },
  )
  token: string;
}
