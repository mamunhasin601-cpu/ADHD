import { Controller, Get, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { PlanService } from './plan.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { User } from '@prisma/client';

@Controller('plan')
@UseGuards(JwtAuthGuard)
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  /**
   * GET /plan
   * Возвращает информацию о текущем плане и использовании лимитов.
   */
  @Get()
  getPlanInfo(@CurrentUser() user: User) {
    return this.planService.getPlanInfo(user.id);
  }

  /**
   * POST /plan/upgrade
   * Апгрейд до Pro (в реальном приложении вызывается после подтверждения платежа).
   * Сейчас работает как dev endpoint без проверки платежа.
   */
  @Post('upgrade')
  @HttpCode(HttpStatus.OK)
  async upgradeToPro(@CurrentUser() user: User) {
    await this.planService.upgradeToPro(user.id);
    return { message: 'Upgraded to Pro successfully', plan: 'PRO' };
  }

  /**
   * POST /plan/downgrade
   * Даунгрейд до Free (для тестирования).
   */
  @Post('downgrade')
  @HttpCode(HttpStatus.OK)
  async downgradeToFree(@CurrentUser() user: User) {
    await this.planService.downgradeToFree(user.id);
    return { message: 'Downgraded to Free', plan: 'FREE' };
  }
}
