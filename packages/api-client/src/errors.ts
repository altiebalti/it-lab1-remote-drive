import { AxiosError } from 'axios';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,

    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  static fromAxios(error: AxiosError): ApiError {
    const status = error.response?.status ?? 0;
    const body = error.response?.data as
      | { message?: string | string[] }
      | undefined;

    let details: string[] = [];
    let message = `Помилка ${status}`;

    if (Array.isArray(body?.message)) {
      details = body.message.map(String);
      message = details.join('; ');
    } else if (typeof body?.message === 'string') {
      message = body.message;
    }

    return new ApiError(status, message, details);
  }
}

export class NetworkError extends Error {
  constructor(readonly cause: unknown) {
    super('Не вдалося зв’язатися з сервером. Перевірте, чи він запущений.');
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Сервер не відповів за ${Math.round(timeoutMs / 1000)} с`);
    this.name = 'TimeoutError';
  }
}
