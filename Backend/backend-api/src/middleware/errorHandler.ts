import { Request, Response, NextFunction } from "express";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AppError extends Error {
  status?: number;
  code?: string;
  isOperational?: boolean;
  details?: unknown;
}

interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  status: number;
  details?: unknown;
  stack?: string;
  requestId?: string;
  timestamp: string;
}

// ─── Error Factory ───────────────────────────────────────────────────────────

export class HttpError extends Error implements AppError {
  status: number;
  code: string;
  isOperational: boolean;
  details?: unknown;

  constructor(
    status: number,
    message: string,
    code?: string,
    details?: unknown
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code ?? HttpError.defaultCode(status);
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static defaultCode(status: number): string {
    const codes: Record<number, string> = {
      400: "BAD_REQUEST",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      422: "UNPROCESSABLE_ENTITY",
      429: "TOO_MANY_REQUESTS",
      500: "INTERNAL_SERVER_ERROR",
      503: "SERVICE_UNAVAILABLE",
    };
    return codes[status] ?? "UNKNOWN_ERROR";
  }

  static badRequest(message: string, details?: unknown) {
    return new HttpError(400, message, "BAD_REQUEST", details);
  }

  static unauthorized(message = "Unauthorized") {
    return new HttpError(401, message, "UNAUTHORIZED");
  }

  static forbidden(message = "Forbidden") {
    return new HttpError(403, message, "FORBIDDEN");
  }

  static notFound(resource = "Resource") {
    return new HttpError(404, `${resource} not found`, "NOT_FOUND");
  }

  static conflict(message: string) {
    return new HttpError(409, message, "CONFLICT");
  }

  static internal(message = "Internal Server Error") {
    return new HttpError(500, message, "INTERNAL_SERVER_ERROR");
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isDev = process.env.NODE_ENV === "development";
const isProd = process.env.NODE_ENV === "production";

/**
 * Determines if an error is safe to expose to the client.
 * Operational errors (HttpError) are user-facing.
 * Everything else gets a generic 500 in production.
 */
const isOperational = (err: AppError): boolean =>
  err.isOperational === true;

/**
 * Normalizes any thrown value into an AppError shape.
 */
const normalizeError = (err: unknown): AppError => {
  if (err instanceof HttpError) return err;

  if (err instanceof Error) {
    const appErr = err as AppError;
    appErr.status = appErr.status ?? 500;
    appErr.isOperational = false;
    return appErr;
  }

  // Handle non-Error throws (strings, objects, etc.)
  const fallback = new HttpError(500, "An unexpected error occurred");
  fallback.isOperational = false;
  return fallback;
};

const formatLog = (
  status: number,
  message: string,
  req: Request,
  err: AppError
): string => {
  const parts = [
    `[${new Date().toISOString()}]`,
    `[${status >= 500 ? "ERROR" : "WARN"}]`,
    `${req.method} ${req.originalUrl}`,
    `→ ${status}: ${message}`,
  ];

  if (req.ip) parts.push(`| IP: ${req.ip}`);
  if (!isOperational(err) && err.stack) parts.push(`\n${err.stack}`);

  return parts.join(" ");
};

// ─── Middleware ───────────────────────────────────────────────────────────────

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const normalized = normalizeError(err);

  const status = normalized.status ?? 500;

  // In production, mask non-operational errors from the client
  const clientMessage =
    isProd && !isOperational(normalized)
      ? "An unexpected error occurred"
      : normalized.message;

  const clientCode =
    isProd && !isOperational(normalized)
      ? "INTERNAL_SERVER_ERROR"
      : normalized.code;

  // Structured logging — swap console.error for your logger (pino, winston, etc.)
  const logLine = formatLog(status, normalized.message, req, normalized);
  if (status >= 500) {
    console.error(logLine);
  } else {
    console.warn(logLine);
  }

  const body: ErrorResponse = {
    success: false,
    error: clientMessage,
    code: clientCode,
    status,
    timestamp: new Date().toISOString(),
    ...(normalized.details !== undefined && { details: normalized.details }),
    ...(isDev && { stack: normalized.stack }),
    ...(req.headers["x-request-id"] && {
      requestId: req.headers["x-request-id"] as string,
    }),
  };

  res.status(status).json(body);
};

/**
 * Catch-all for routes that don't exist.
 * Mount this after all routes, before errorHandler.
 */
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(HttpError.notFound(`Route ${req.method} ${req.originalUrl}`));
};