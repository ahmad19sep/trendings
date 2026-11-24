export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid credentials");
    this.name = "InvalidCredentialsError";
  }
}

export class LoginRateLimitedError extends Error {
  readonly retryAt: Date;

  constructor(retryAt: Date) {
    super("Login temporarily rate limited");
    this.name = "LoginRateLimitedError";
    this.retryAt = retryAt;
  }
}

