export const getGatewayBaseUrl = (): string => {
  // In production (Docker), Next.js rewrites /api/* → http://gateway:8000/api/*
  // so we use a relative path. The browser only ever needs port 3000 open.
  // In local dev (no Docker), fall back to localhost:8000 directly.
  if (typeof window !== 'undefined') {
    return '/api';
  }
  return process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:8000/api';
};
