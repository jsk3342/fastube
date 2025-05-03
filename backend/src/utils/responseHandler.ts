/**
 * 표준화된 API 응답 생성 유틸리티
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message?: string;
  timestamp: number;
}

export function createResponse<T>(
  success: boolean,
  data: T | null,
  message?: string
): ApiResponse<T> {
  return {
    success,
    data,
    message,
    timestamp: Date.now(),
  };
}
