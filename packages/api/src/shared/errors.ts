import type { ErrorCode } from '../services/types';

const HTTP_STATUS_MAP: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  AUTH_ERROR: 401,
  INTERNAL_ERROR: 500,
};

export function errorToHttpStatus(code: ErrorCode): number {
  return HTTP_STATUS_MAP[code] ?? 500;
}
