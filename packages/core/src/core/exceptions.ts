/**
 * Base HTTP Exception class
 */
export class HttpException extends Error {
  public readonly statusCode: number;
  public readonly data?: Record<string, any>;

  constructor(statusCode: number, message: string, data?: Record<string, any>) {
    super(message);
    this.name = 'HttpException';
    this.statusCode = statusCode;
    this.data = data;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * 400 Bad Request Exception
 */
export class BadRequestException extends HttpException {
  constructor(message: string = 'Bad Request', data?: Record<string, any>) {
    super(400, message, data);
    this.name = 'BadRequestException';
  }
}

/**
 * 404 Not Found Exception
 */
export class NotFoundException extends HttpException {
  constructor(message: string = 'Not Found', data?: Record<string, any>) {
    super(404, message, data);
    this.name = 'NotFoundException';
  }
}

/**
 * 500 Internal Server Error Exception
 */
export class InternalServerErrorException extends HttpException {
  constructor(message: string = 'Internal Server Error', data?: Record<string, any>) {
    super(500, message, data);
    this.name = 'InternalServerErrorException';
  }
}

/**
 * 503 Service Unavailable Exception
 */
export class ServiceUnavailableException extends HttpException {
  constructor(message: string = 'Service Unavailable', data?: Record<string, any>) {
    super(503, message, data);
    this.name = 'ServiceUnavailableException';
  }
}

/**
 * Redirect Exception - for HTTP redirects (301/302)
 */
export class RedirectException extends Error {
  public readonly url: string;
  public readonly statusCode: number;
  public readonly data?: Record<string, any>;

  constructor(url: string, statusCode: number = 302, data?: Record<string, any>) {
    super(`Redirect to ${url}`);
    this.name = 'RedirectException';
    this.url = url;
    this.statusCode = statusCode;
    this.data = data;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
