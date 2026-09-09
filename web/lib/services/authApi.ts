import { api } from './api.setup';
import { UserProfile } from '../features/auth/authSlice';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  expires_at: string;
  user: UserProfile;
}

export interface ValidateSessionResponse {
  session: {
    user_id: string;
    access_token: string;
    access_token_expires_at: string;
  };
  user: UserProfile;
}

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Session', 'User'],
    }),
    getMe: builder.query<ValidateSessionResponse, void>({
      query: () => '/auth/me',
      providesTags: ['Session', 'User'],
    }),
    logout: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      invalidatesTags: ['Session'],
    }),
  }),
  overrideExisting: false,
});

export const { useLoginMutation, useGetMeQuery, useLogoutMutation } = authApi;
