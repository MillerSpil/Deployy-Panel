const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Auth endpoints where 401 is expected behavior (not an error to log)
const AUTH_CHECK_ENDPOINTS = ['/auth/me', '/auth/setup-status'];

export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public details?: any
  ) {
    super(message);
  }
}

export async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  } catch (networkErr) {
    // Network error - backend is unreachable or crashed
    console.error(`Network error for ${endpoint}:`, networkErr);
    throw new ApiError(
      0,
      'Unable to connect to the server. Please check that the backend is running.',
    );
  }

  if (!response.ok) {
    // Suppress error throwing for expected 401s on auth check endpoints
    const isAuthCheck = AUTH_CHECK_ENDPOINTS.some(ep => endpoint.startsWith(ep));
    if (response.status === 401 && isAuthCheck) {
      return { authenticated: false } as T;
    }

    const error = await response.json().catch(() => ({}));
    const message = error.error || `Request failed (${response.status})`;
    const apiError = new ApiError(response.status, message, error.details);

    // Only log 5xx server errors to console - 4xx are user errors handled by UI
    if (response.status >= 500) {
      console.error(`API Error [${response.status}]: ${apiError.message}`, endpoint);
    }

    throw apiError;
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
