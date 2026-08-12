import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import type { User } from '@prisma/client';

/**
 * Device-token lifecycle endpoints (ADR-009).
 * All routes require JWT authentication; userId always comes from @CurrentUser().
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /**
   * POST /notifications/devices
   * Register a push token for the authenticated user's device.
   * Idempotent: re-registering the same token returns the existing record.
   */
  @Post('devices')
  async register(
    @CurrentUser() user: User,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    const result = await this.notifications.registerDeviceToken(
      user.id,
      dto.token,
      dto.platform ?? 'expo',
      dto.label,
    );
    return { id: result.id, platform: result.platform };
  }

  /**
   * DELETE /notifications/devices/:id
   * Revoke (remove) a device token by its record ID.
   * Ownership-enforced: only the owning user can remove their own token.
   */
  @Delete('devices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) tokenId: string,
  ) {
    const removed = await this.notifications.removeDeviceToken(user.id, tokenId);
    if (!removed) {
      throw new NotFoundException('Device token not found or does not belong to this user');
    }
  }
}
