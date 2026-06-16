export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'AUTH_ERROR';

export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ErrorCode; message: string } };

export function ok<T>(data: T): ServiceResult<T> {
  return { success: true, data };
}

export function err<T = never>(
  code: ErrorCode,
  message: string
): ServiceResult<T> {
  return { success: false, error: { code, message } };
}

export interface ServiceContext {
  userId: string;
}
