import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { CONTACT_VERIFICATION_ERROR_CODES } from './contact-verification.errors';

@Catch(BadRequestException)
export class ContactVerificationValidationFilter implements ExceptionFilter {
  catch(_exception: BadRequestException, host: ArgumentsHost): void {
    host.switchToHttp().getResponse<Response>().status(400).json({
      code: CONTACT_VERIFICATION_ERROR_CODES.INVALID,
      message: 'Contact verification request was not accepted',
    });
  }
}
