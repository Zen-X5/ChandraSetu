import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getSessionCookie } from '../utils/session.utils';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:8000/api',
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
