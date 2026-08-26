import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { CoreEnvironment } from '../config/core-environment';
import { OAuthProviderAvailabilityController } from './oauth-provider-availability.controller';

describe('OAuthProviderAvailabilityController', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it.each([
    [{ YANDEX_OAUTH_ENABLED: false, VK_OAUTH_ENABLED: false, MAILRU_OAUTH_ENABLED: false }],
    [{ YANDEX_OAUTH_ENABLED: true, VK_OAUTH_ENABLED: false, MAILRU_OAUTH_ENABLED: false }],
    [{ YANDEX_OAUTH_ENABLED: false, VK_OAUTH_ENABLED: true, MAILRU_OAUTH_ENABLED: false }],
    [{ YANDEX_OAUTH_ENABLED: false, VK_OAUTH_ENABLED: false, MAILRU_OAUTH_ENABLED: true }],
    [{ YANDEX_OAUTH_ENABLED: true, VK_OAUTH_ENABLED: false, MAILRU_OAUTH_ENABLED: true }],
  ])('returns only validated boolean flags: %p', (flags) => {
    const config = { get: jest.fn((key: keyof typeof flags) => flags[key]) };
    const controller = new OAuthProviderAvailabilityController(config as unknown as ConfigService<CoreEnvironment, true>);

    const result = controller.getAvailability();

    expect(result).toEqual({
      yandex: flags.YANDEX_OAUTH_ENABLED,
      vk: flags.VK_OAUTH_ENABLED,
      mailru: flags.MAILRU_OAUTH_ENABLED,
    });
    expect(Object.keys(result)).toEqual(['yandex', 'vk', 'mailru']);
    expect(Object.values(result).every((value) => typeof value === 'boolean')).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/secret|redirect|client|production|process/i);
    expect(config.get).toHaveBeenCalledTimes(3);
  });

  it('does not need external or database services and reads no credentials', () => {
    const config = { get: jest.fn((key: string) => {
      if (key.endsWith('_OAUTH_ENABLED')) return false;
      throw new Error(`unexpected key: ${key}`);
    }) };
    const controller = new OAuthProviderAvailabilityController(config as unknown as ConfigService<CoreEnvironment, true>);
    expect(controller.getAvailability()).toEqual({ yandex: false, vk: false, mailru: false });
  });

  it('is public and sends an exact no-store HTTP response', async () => {
    const config = { get: jest.fn((key: keyof CoreEnvironment) => key !== 'VK_OAUTH_ENABLED') };
    const moduleRef = await Test.createTestingModule({
      controllers: [OAuthProviderAvailabilityController],
      providers: [{ provide: ConfigService, useValue: config }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    await request(app.getHttpServer())
      .get('/auth/oauth/providers')
      .expect(200)
      .expect('Cache-Control', 'no-store')
      .expect({ yandex: true, vk: false, mailru: true });
  });
});
