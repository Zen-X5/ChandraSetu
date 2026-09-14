export const getGatewayBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:8000/api`;
  }
  return process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:8000/api';
};
