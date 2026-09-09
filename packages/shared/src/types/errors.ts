
export enum ErrorCode {
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  VALIDATION = "VALIDATION",
  RATE_LIMITED = "RATE_LIMITED",
  IDEMPOTENT_REPLAY = "IDEMPOTENT_REPLAY",
  ABUSE_HELD = "ABUSE_HELD",
  TURNSTILE_FAILED = "TURNSTILE_FAILED",
  GPS_IMPLAUSIBLE = "GPS_IMPLAUSIBLE",
  MEDIA_REJECTED = "MEDIA_REJECTED",
  NOT_ROUTABLE = "NOT_ROUTABLE",
  CONFLICT = "CONFLICT",
  UNSUPPORTED_API_VERSION = "UNSUPPORTED_API_VERSION",
  API_VERSION_SUNSET = "API_VERSION_SUNSET",
  PAYMENT_UNAVAILABLE = "PAYMENT_UNAVAILABLE",
  INTERNAL = "INTERNAL",
}

export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.VALIDATION]: 422,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.IDEMPOTENT_REPLAY]: 200,
  [ErrorCode.ABUSE_HELD]: 202,
  [ErrorCode.TURNSTILE_FAILED]: 403,
  [ErrorCode.GPS_IMPLAUSIBLE]: 422,
  [ErrorCode.MEDIA_REJECTED]: 422,
  [ErrorCode.NOT_ROUTABLE]: 422,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.UNSUPPORTED_API_VERSION]: 400,
  [ErrorCode.API_VERSION_SUNSET]: 410,
  [ErrorCode.PAYMENT_UNAVAILABLE]: 503,
  [ErrorCode.INTERNAL]: 500,
}

export interface AppErrorOptions {
  httpStatus?: number
  fields?: Record<string, string>
  requestId?: string
  cause?: unknown
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly httpStatus: number
  readonly fields?: Record<string, string>
  requestId?: string

  constructor(code: ErrorCode, message: string, opts: AppErrorOptions = {}) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined)
    this.name = "AppError"
    this.code = code
    this.httpStatus = opts.httpStatus ?? ERROR_HTTP_STATUS[code]
    if (opts.fields !== undefined) this.fields = opts.fields
    if (opts.requestId !== undefined) this.requestId = opts.requestId
    Object.setPrototypeOf(this, AppError.prototype)
  }

  toJSON(): {
    code: ErrorCode
    message: string
    requestId?: string
    fields?: Record<string, string>
  } {
    return {
      code: this.code,
      message: this.message,
      ...(this.requestId !== undefined ? { requestId: this.requestId } : {}),
      ...(this.fields !== undefined ? { fields: this.fields } : {}),
    }
  }

  static unauthorized(message = "Unauthorized"): AppError {
    return new AppError(ErrorCode.UNAUTHORIZED, message)
  }

  static forbidden(message = "Forbidden"): AppError {
    return new AppError(ErrorCode.FORBIDDEN, message)
  }

  static notFound(message = "Not found"): AppError {
    return new AppError(ErrorCode.NOT_FOUND, message)
  }

  static validation(fields?: Record<string, string>, message = "Validation failed"): AppError {
    return new AppError(ErrorCode.VALIDATION, message, fields ? { fields } : {})
  }

  static rateLimited(message = "Too many requests"): AppError {
    return new AppError(ErrorCode.RATE_LIMITED, message)
  }

  static idempotentReplay(message = "Idempotent replay"): AppError {
    return new AppError(ErrorCode.IDEMPOTENT_REPLAY, message)
  }

  static abuseHeld(message = "Held for review"): AppError {
    return new AppError(ErrorCode.ABUSE_HELD, message)
  }

  static turnstileFailed(message = "Turnstile verification failed"): AppError {
    return new AppError(ErrorCode.TURNSTILE_FAILED, message)
  }

  static gpsImplausible(message = "GPS location implausible"): AppError {
    return new AppError(ErrorCode.GPS_IMPLAUSIBLE, message)
  }

  static mediaRejected(message = "Media rejected"): AppError {
    return new AppError(ErrorCode.MEDIA_REJECTED, message)
  }

  static notRoutable(message = "No routing contact on file"): AppError {
    return new AppError(ErrorCode.NOT_ROUTABLE, message)
  }

  static conflict(message = "Conflict"): AppError {
    return new AppError(ErrorCode.CONFLICT, message)
  }

  static unsupportedApiVersion(message = "Unsupported API version"): AppError {
    return new AppError(ErrorCode.UNSUPPORTED_API_VERSION, message)
  }

  static apiVersionSunset(message = "API version sunset"): AppError {
    return new AppError(ErrorCode.API_VERSION_SUNSET, message)
  }

  static paymentUnavailable(message = "Payments are temporarily unavailable"): AppError {
    return new AppError(ErrorCode.PAYMENT_UNAVAILABLE, message)
  }

  static internal(message = "Internal error"): AppError {
    return new AppError(ErrorCode.INTERNAL, message)
  }
}

export interface SmtpFailureDetail {
  responseCode?: number
  command?: string
  response?: string
  code?: string
}

export class MailSendError extends AppError {
  readonly smtp: SmtpFailureDetail

  constructor(
    code: ErrorCode,
    message: string,
    smtp: SmtpFailureDetail,
    opts: AppErrorOptions = {},
  ) {
    super(code, message, opts)
    this.name = "MailSendError"
    this.smtp = smtp
    Object.setPrototypeOf(this, MailSendError.prototype)
  }
}

export interface AppErrorLike {
  code: ErrorCode
  message: string
  httpStatus?: unknown
  fields?: unknown
  requestId?: unknown
}

const ERROR_CODE_VALUES: ReadonlySet<string> = new Set<string>(Object.values(ErrorCode))

export function isAppErrorLike(value: unknown): value is AppErrorLike {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as { code?: unknown; message?: unknown }
  return (
    typeof candidate.code === "string" &&
    ERROR_CODE_VALUES.has(candidate.code) &&
    typeof candidate.message === "string"
  )
}

export function toAppError(value: unknown): AppError {
  if (value instanceof AppError) return value

  if (isAppErrorLike(value)) {
    const { httpStatus, fields, requestId } = value
    const namedFields =
      typeof fields === "object" && fields !== null && !Array.isArray(fields)
        ? Object.entries(fields).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          )
        : []
    return new AppError(value.code, value.message || "Unknown error", {
      ...(typeof httpStatus === "number" ? { httpStatus } : {}),
      ...(namedFields.length > 0 ? { fields: Object.fromEntries(namedFields) } : {}),
      ...(typeof requestId === "string" ? { requestId } : {}),
      cause: value,
    })
  }

  if (value instanceof Error) {
    return new AppError(ErrorCode.INTERNAL, value.message || "Unknown error", { cause: value })
  }

  return new AppError(ErrorCode.INTERNAL, "Unknown error")
}
