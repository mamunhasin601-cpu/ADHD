import { Injectable, Logger } from '@nestjs/common';
import {
  EXTERNAL_HTTP_DEADLINE_MS,
  EXTERNAL_HTTP_RETRY_DELAY_MS,
  EXTERNAL_HTTP_SAFE_ATTEMPT_MS,
  RETRYABLE_HTTP_STATUSES,
} from './external-http.constants';
import { ExternalHttpError } from './external-http.error';
import type { ExternalFailureClass, ExternalJsonRequest, ExternalSafeLog } from './external-http.types';

@Injectable()
export class ExternalHttpService {
  private readonly logger = new Logger(ExternalHttpService.name);

  async requestJson<T>({ operation, url, options = {}, retry = 'none' }: ExternalJsonRequest): Promise<T> {
    const startedAt = Date.now();
    const deadline = startedAt + EXTERNAL_HTTP_DEADLINE_MS;
    const method = (options.method ?? 'GET').toUpperCase();
    const maxAttempts = retry === 'safe-transient' ? 2 : 1;
    let attempts = 0;

    try {
      this.validateUrl(url, operation);

      while (attempts < maxAttempts) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          throw new ExternalHttpError('timeout', operation, undefined, attempts);
        }

        attempts += 1;
        const attemptBudget = retry === 'safe-transient'
          ? Math.min(EXTERNAL_HTTP_SAFE_ATTEMPT_MS, remaining)
          : remaining;
        const attemptDeadline = Date.now() + attemptBudget;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), attemptBudget);
        let failure: ExternalHttpError;

        try {
          const response = await fetch(url, { ...options, signal: controller.signal });
          if (!response.ok) {
            await this.cancelBody(response, Math.min(attemptDeadline, deadline));
            throw new ExternalHttpError('http', operation, response.status, attempts);
          }

          try {
            return (await response.json()) as T;
          } catch {
            const failureClass: ExternalFailureClass = controller.signal.aborted
              ? 'timeout'
              : 'invalid-response';
            throw new ExternalHttpError(failureClass, operation, response.status, attempts);
          }
        } catch (error) {
          failure = error instanceof ExternalHttpError
            ? error
            : new ExternalHttpError(
                controller.signal.aborted ? 'timeout' : 'network',
                operation,
                undefined,
                attempts,
              );
        } finally {
          clearTimeout(timer);
        }

        if (!this.canRetry(failure, retry, attempts, maxAttempts, deadline)) {
          throw failure;
        }

        await this.delay(deadline);
        if (Date.now() >= deadline) {
          throw failure;
        }
      }

      throw new ExternalHttpError('timeout', operation, undefined, attempts);
    } catch (error) {
      const failure = error instanceof ExternalHttpError
        ? error
        : new ExternalHttpError('invalid-request', operation, undefined, attempts);
      this.logFinalFailure({
        event: 'external-http.failure',
        operation,
        method,
        attempts: failure.attempts,
        failureClass: failure.failureClass,
        ...(failure.status === undefined ? {} : { status: failure.status }),
        elapsedMs: Math.min(EXTERNAL_HTTP_DEADLINE_MS, Math.max(0, Date.now() - startedAt)),
      });
      throw failure;
    }
  }

  private validateUrl(value: string, operation: ExternalJsonRequest['operation']): void {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'https:') throw new Error('unsupported protocol');
    } catch {
      throw new ExternalHttpError('invalid-request', operation, undefined, 0);
    }
  }

  private canRetry(
    failure: ExternalHttpError,
    retry: ExternalJsonRequest['retry'],
    attempts: number,
    maxAttempts: number,
    deadline: number,
  ): boolean {
    if (retry !== 'safe-transient' || attempts >= maxAttempts || Date.now() >= deadline) return false;
    if (failure.failureClass === 'timeout' || failure.failureClass === 'network') return true;
    return failure.failureClass === 'http'
      && failure.status !== undefined
      && RETRYABLE_HTTP_STATUSES.has(failure.status);
  }

  private async cancelBody(response: Response, cleanupDeadline: number): Promise<void> {
    const body = response.body;
    const remaining = Math.max(0, cleanupDeadline - Date.now());
    if (!body || remaining <= 0) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.resolve(body.cancel()).catch(() => undefined),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, remaining);
        }),
      ]);
    } catch {
      // Cleanup is best-effort and must not replace the safe transport failure.
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private logFinalFailure(entry: ExternalSafeLog): void {
    this.logger.warn(entry);
  }

  private async delay(deadline: number): Promise<void> {
    const ms = Math.min(EXTERNAL_HTTP_RETRY_DELAY_MS, Math.max(0, deadline - Date.now()));
    if (ms > 0) await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}
