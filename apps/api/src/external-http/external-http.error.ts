import type { ExternalFailureClass, ExternalOperationId } from './external-http.types';

export class ExternalHttpError extends Error {
  constructor(
    public readonly failureClass: ExternalFailureClass,
    public readonly operation: ExternalOperationId,
    public readonly status?: number,
    public readonly attempts = 1,
  ) {
    super(`External request failed: ${failureClass}`);
    this.name = 'ExternalHttpError';
  }
}
