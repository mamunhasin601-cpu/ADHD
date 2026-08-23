import { Injectable, Logger } from '@nestjs/common';
import { EXTERNAL_HTTP_DEADLINE_MS, EXTERNAL_HTTP_RETRY_DELAY_MS, RETRYABLE_HTTP_STATUSES } from './external-http.constants';
import { ExternalHttpError } from './external-http.error';
import type { ExternalJsonRequest, ExternalSafeLog } from './external-http.types';

@Injectable()
export class ExternalHttpService {
  private readonly logger = new Logger(ExternalHttpService.name);

  async requestJson<T>({ operation, url, options = {}, retry = 'none' }: ExternalJsonRequest): Promise<T> {
    const deadline = Date.now() + EXTERNAL_HTTP_DEADLINE_MS;
    const maxAttempts = retry === 'safe-transient' ? 2 : 1;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new ExternalHttpError('timeout', operation, undefined, attempts);
      attempts += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), remaining);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (response.ok === false) {
          if (!(retry === 'safe-transient' && attempts < 2 && Date.now() < deadline && RETRYABLE_HTTP_STATUSES.has(response.status))) {
            throw new ExternalHttpError('http', operation, response.status, attempts);
          }
          await this.delay(deadline);
          continue;
        }
        try { return (await response.json()) as T; }
        catch { throw new ExternalHttpError('invalid-response', operation, response.status, attempts); }
      } catch (error) {
        if (error instanceof ExternalHttpError) {
          throw error;
        }
        const failure = new ExternalHttpError(controller.signal.aborted || Date.now() >= deadline ? 'timeout' : 'network', operation, undefined, attempts);
        if (!(retry === 'safe-transient' && attempts < 2 && Date.now() < deadline)) throw failure;
        await this.delay(deadline);
      } finally {
        clearTimeout(timer);
      }
    }
    throw new ExternalHttpError('timeout', operation, undefined, attempts);
  }

  logFailure(entry: ExternalSafeLog): void { this.logger.warn(entry); }

  private async delay(deadline: number): Promise<void> {
    const ms = Math.min(EXTERNAL_HTTP_RETRY_DELAY_MS, Math.max(0, deadline - Date.now()));
    if (ms > 0) await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}
