import {
  IsString,
  Length,
  Matches,
  IsOptional,
  MaxLength,
  IsIn,
} from 'class-validator';

/**
 * DTO for registering a device push token (ADR-009).
 * The token value is validated for Expo push token shape but not logged.
 */
export class RegisterDeviceTokenDto {
  /**
   * Expo push token.
   * Format: ExponentPushToken[xxxxxx] or similar provider-specific format.
   * Max length bounds prevent unbounded storage; exact pattern enforced.
   */
  @IsString()
  @Length(1, 255, { message: 'token must be between 1 and 255 characters' })
  @Matches(/^(ExponentPushToken|ExpoPushToken)\[.+\]$|^[a-zA-Z0-9_\-:]+$/, {
    message: 'token must be a valid Expo push token',
  })
  token: string;

  /**
   * Platform hint: "expo" (default), "apns", or "fcm".
   * Restricted to this exact set so arbitrary strings cannot be stored.
   */
  @IsOptional()
  @IsIn(['expo', 'apns', 'fcm'], {
    message: 'platform must be one of: expo, apns, fcm',
  })
  platform?: 'expo' | 'apns' | 'fcm';

  /**
   * Optional human-readable label (e.g. "iPhone 14").
   * Never included in push payloads or logs.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}
