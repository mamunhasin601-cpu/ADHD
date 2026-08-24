export const OAUTH_ACCOUNT_LINKING_REQUIRED_CODE =
  'OAUTH_ACCOUNT_LINKING_REQUIRED' as const;

export const OAUTH_ACCOUNT_LINKING_REQUIRED_MESSAGE =
  'Sign in with your existing method before linking this provider.' as const;

export const OAUTH_ACCOUNT_LINKING_REQUIRED_RESPONSE = Object.freeze({
  code: OAUTH_ACCOUNT_LINKING_REQUIRED_CODE,
  message: OAUTH_ACCOUNT_LINKING_REQUIRED_MESSAGE,
});

export class OAuthAccountLinkingRequiredError extends Error {
  constructor() {
    super(OAUTH_ACCOUNT_LINKING_REQUIRED_MESSAGE);
    this.name = 'OAuthAccountLinkingRequiredError';
  }
}
