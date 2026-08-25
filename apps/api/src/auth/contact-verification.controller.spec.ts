import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ContactVerificationController } from './contact-verification.controller';
import { ContactVerificationService } from './contact-verification.service';
import { ContactVerificationChannelDto, ConfirmContactVerificationDto, StartContactVerificationDto } from './dto/contact-verification.dto';
import { ContactVerificationValidationFilter } from './contact-verification-validation.filter';

describe('ContactVerificationController', () => {
  const service = { start: jest.fn(), confirm: jest.fn() };
  const controller = new ContactVerificationController(service as any);
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

  beforeEach(() => jest.clearAllMocks());

  it('declares exact 202/200 endpoint status codes and safe shapes', async () => {
    service.start.mockResolvedValue({ challengeId: '11111111-1111-4111-8111-111111111111', expiresInSeconds: 600, resendAfterSeconds: 60 });
    service.confirm.mockResolvedValue({ verificationToken: 'token', expiresInSeconds: 900 });
    expect(await controller.start({ channel: ContactVerificationChannelDto.EMAIL, destination: 'user@example.ru' })).not.toHaveProperty('destination');
    expect(await controller.confirm({ challengeId: '11111111-1111-4111-8111-111111111111', code: '123456' })).not.toHaveProperty('destination');
    const startCode = Reflect.getMetadata('__httpCode__', ContactVerificationController.prototype.start);
    const confirmCode = Reflect.getMetadata('__httpCode__', ContactVerificationController.prototype.confirm);
    expect(startCode).toBe(HttpStatus.ACCEPTED);
    expect(confirmCode).toBe(HttpStatus.OK);
  });

  it.each([
    [{ channel: 'EMAIL', destination: 'user@example.ru' }, true],
    [{ channel: 'PHONE', destination: '+79991234567' }, true],
    [{ channel: 'email', destination: 'user@example.ru' }, false],
    [{ channel: 'PHONE', destination: 79991234567 }, false],
    [{ channel: 'EMAIL' }, false],
  ])('validates start DTO %p', async (value, valid) => {
    const action = pipe.transform(value, { type: 'body', metatype: StartContactVerificationDto });
    if (valid) await expect(action).resolves.toBeInstanceOf(StartContactVerificationDto);
    else await expect(action).rejects.toBeDefined();
  });

  it.each([
    [{ challengeId: '11111111-1111-4111-8111-111111111111', code: '123456' }, true],
    [{ challengeId: 'not-uuid', code: '123456' }, false],
    [{ challengeId: '11111111-1111-4111-8111-111111111111', code: '12345' }, false],
    [{ challengeId: '11111111-1111-4111-8111-111111111111', code: '12345a' }, false],
  ])('validates confirm DTO %p', async (value, valid) => {
    const action = pipe.transform(value, { type: 'body', metatype: ConfirmContactVerificationDto });
    if (valid) await expect(action).resolves.toBeInstanceOf(ConfirmContactVerificationDto);
    else await expect(action).rejects.toBeDefined();
  });

  it('returns indistinguishable accepted bodies supplied by the service', async () => {
    const body = { challengeId: '11111111-1111-4111-8111-111111111111', expiresInSeconds: 600, resendAfterSeconds: 60 };
    service.start.mockResolvedValue(body);
    const unknown = await controller.start({ channel: ContactVerificationChannelDto.EMAIL, destination: 'unknown@example.ru' });
    service.start.mockResolvedValue(body);
    const registered = await controller.start({ channel: ContactVerificationChannelDto.EMAIL, destination: 'registered@example.ru' });
    expect(registered).toEqual(unknown);
    expect(JSON.stringify(registered)).not.toMatch(/registered@example|destination/);
  });

  it('maps DTO failures to the exact shared safe 400 body', () => {
    const response = { status: jest.fn(), json: jest.fn() };
    response.status.mockReturnValue(response);
    const host = { switchToHttp: () => ({ getResponse: () => response }) };
    new ContactVerificationValidationFilter().catch({} as any, host as any);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      code: 'CONTACT_VERIFICATION_INVALID_OR_EXPIRED',
      message: 'Contact verification request was not accepted',
    });
  });
});
