const PLACEHOLDER_VALUES = new Set(['', 'change-me', 'replace-me', 'your-secret-here']);

function requiredProviderValue(environment: Record<string, unknown>, key: string): string {
  const value = environment[key];
  if (typeof value !== 'string' || value.trim().length === 0 || PLACEHOLDER_VALUES.has(value.trim().toLowerCase())) {
    throw new Error(`Invalid contact verification configuration: ${key} is required`);
  }
  if (value !== value.trim()) {
    throw new Error(`Invalid contact verification configuration: ${key} must not contain surrounding whitespace`);
  }
  return value;
}

export function validateContactVerificationEnvironment(
  environment: Record<string, unknown>,
  jwtSecrets: readonly string[],
): Record<string, unknown> {
  const enabledValue = environment.CONTACT_VERIFICATION_ENABLED;
  if (enabledValue !== undefined && typeof enabledValue !== 'string') {
    throw new Error('Invalid contact verification configuration: CONTACT_VERIFICATION_ENABLED must be true or false');
  }
  const enabled = enabledValue === 'true';
  if (!enabled) return { ...environment, CONTACT_VERIFICATION_ENABLED: false };

  const secret = requiredProviderValue(environment, 'CONTACT_VERIFICATION_SECRET');
  if (secret.length < 32 || jwtSecrets.includes(secret)) {
    throw new Error('Invalid contact verification configuration: CONTACT_VERIFICATION_SECRET must be a dedicated secret of at least 32 characters');
  }
  for (const key of ['SMSAERO_EMAIL', 'SMSAERO_API_KEY', 'SMSAERO_SIGN', 'TIMEWEB_SMTP_USER', 'TIMEWEB_SMTP_PASSWORD', 'TIMEWEB_SMTP_FROM_EMAIL', 'TIMEWEB_SMTP_FROM_NAME']) {
    requiredProviderValue(environment, key);
  }
  return { ...environment, CONTACT_VERIFICATION_ENABLED: true, CONTACT_VERIFICATION_SECRET: secret };
}
