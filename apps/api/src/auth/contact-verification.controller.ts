import { Body, Controller, HttpCode, HttpStatus, Post, UseFilters } from '@nestjs/common';
import { ContactVerificationService } from './contact-verification.service';
import { ConfirmContactVerificationDto, StartContactVerificationDto } from './dto/contact-verification.dto';
import { ContactVerificationValidationFilter } from './contact-verification-validation.filter';

@Controller('auth/contact-verification')
@UseFilters(ContactVerificationValidationFilter)
export class ContactVerificationController {
  constructor(private readonly verification: ContactVerificationService) {}

  @Post('start')
  @HttpCode(HttpStatus.ACCEPTED)
  start(@Body() dto: StartContactVerificationDto) {
    return this.verification.start(dto.channel, dto.destination);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  confirm(@Body() dto: ConfirmContactVerificationDto) {
    return this.verification.confirm(dto.challengeId, dto.code);
  }
}
