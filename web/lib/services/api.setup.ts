import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import { getSessionCookie } from '../utils/session.utils';
import { getGatewayBaseUrl } from '../utils/gateway.utils';

// Use a wrapper so baseUrl is resolved lazily on every request (browser-side),
// instead of being baked in at module-load time (which would always resolve
// to localhost during SSR/build).
const dynamicBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = (
  args,
  api,
  extraOptions,
) => {
  const baseQuery = fetchBaseQuery({
    baseUrl: getGatewayBaseUrl(),
    prepareHeaders: (headers) => {
      const token = getSessionCookie();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  });
  return baseQuery(args, api, extraOptions);
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery: dynamicBaseQuery,
  tagTypes: [
    'User',
    'Session',
    'RawImage',
    'PipelineRun',
    'Observation',
    'MoonMapPatch',
  ],
  endpoints: () => ({}),
});
