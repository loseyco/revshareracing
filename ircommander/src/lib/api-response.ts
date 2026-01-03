import { NextResponse } from "next/server";

/**
 * Standard API response helpers for consistent response format across all endpoints.
 */

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Create a successful API response.
 */
export function apiSuccess<T>(data: T, meta?: ApiSuccessResponse["meta"]): NextResponse {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
  };
  if (meta) {
    response.meta = meta;
  }
  return NextResponse.json(response);
}

/**
 * Simplified successful response (alias for apiSuccess).
 * Returns { success: true, data: T }
 */
export function apiResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

/**
 * Create an error API response (full signature with code).
 */
export function apiErrorFull(
  code: string,
  message: string,
  status: number = 400,
  details?: unknown
): NextResponse {
  const errorObj: { code: string; message: string; details?: unknown } = {
    code,
    message,
  };
  if (details !== undefined) {
    errorObj.details = details;
  }
  const response: ApiErrorResponse = {
    success: false,
    error: errorObj,
  };
  return NextResponse.json(response, { status });
}

/**
 * Simplified error response.
 * Returns { success: false, error: message, details?: unknown }
 */
export function apiError(
  message: string,
  status: number = 400,
  details?: unknown
): NextResponse {
  const body: { success: false; error: string; details?: unknown } = { 
    success: false, 
    error: message,
  };
  if (details !== undefined) {
    body.details = details;
  }
  return NextResponse.json(body, { status });
}

/**
 * Common error responses.
 */
export const ApiErrors = {
  unauthorized: (message = "Authentication required") => 
    apiErrorFull("UNAUTHORIZED", message, 401),
  
  forbidden: (message = "Access denied") => 
    apiErrorFull("FORBIDDEN", message, 403),
  
  notFound: (resource = "Resource") => 
    apiErrorFull("NOT_FOUND", `${resource} not found`, 404),
  
  badRequest: (message: string, details?: unknown) => 
    apiErrorFull("BAD_REQUEST", message, 400, details),
  
  validationError: (details: unknown) => 
    apiErrorFull("VALIDATION_ERROR", "Invalid request data", 400, details),
  
  serverError: (message = "Internal server error") => 
    apiErrorFull("SERVER_ERROR", message, 500),
  
  conflict: (message: string) => 
    apiErrorFull("CONFLICT", message, 409),
  
  paymentRequired: (message: string, details?: unknown) => 
    apiErrorFull("PAYMENT_REQUIRED", message, 402, details),
  
  serviceUnavailable: (message: string) => 
    apiErrorFull("SERVICE_UNAVAILABLE", message, 503),
  
  rateLimited: (message = "Too many requests") => 
    apiErrorFull("RATE_LIMITED", message, 429)
};
