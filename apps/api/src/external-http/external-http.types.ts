export type ExternalOperationId = 'yandex.token' | 'yandex.profile' | 'vk.token' | 'vk.profile' | 'mailru.token' | 'mailru.profile' | 'expo.push';
export type ExternalRetryPolicy = 'none' | 'safe-transient';
export type ExternalFailureClass = 'timeout' | 'network' | 'http' | 'invalid-response' | 'invalid-request';
export interface ExternalJsonRequest { operation: ExternalOperationId; url: string; options?: RequestInit; retry?: ExternalRetryPolicy; }
export interface ExternalSafeLog { event: 'external-http.failure'; operation: ExternalOperationId; method: string; attempts: number; failureClass: ExternalFailureClass; status?: number; elapsedMs: number; }
