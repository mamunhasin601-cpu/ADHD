import { HttpException, HttpStatus } from '@nestjs/common';

export const CONTACT_VERIFICATION_ERROR_CODES = {
  INVALID: 'CONTACT_VERIFICATION_INVALID_OR_EXPIRED',
  RATE_LIMITED: 'CONTACT_VERIFICATION_RATE_LIMITED',
  UNAVAILABLE: 'CONTACT_VERIFICATION_UNAVAILABLE',
} as const;

export class ContactVerificationError extends HttpException {
  constructor(code: string, status: HttpStatus) {
    super({ code, message: 'Contact verification request was not accepted' }, status);
  }
}

export const invalidContactVerification = () =>
  new ContactVerificationError(CONTACT_VERIFICATION_ERROR_CODES.INVALID, HttpStatus.BAD_REQUEST);
export const rateLimitedContactVerification = () =>
  new ContactVerificationError(CONTACT_VERIFICATION_ERROR_CODES.RATE_LIMITED, HttpStatus.TOO_MANY_REQUESTS);
export const unavailableContactVerification = () =>
  new ContactVerificationError(CONTACT_VERIFICATION_ERROR_CODES.UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE);
