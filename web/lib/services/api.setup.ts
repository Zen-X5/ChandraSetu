import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getSessionCookie } from '../utils/session.utils';
import { getGatewayBaseUrl } from '../utils/gateway.utils';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: getGatewayBaseUrl(),
    prepareHeaders: (headers) => {
      const token = getSessionCookie();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
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
