import { api } from './api.setup';
import { UserProfile, UserRole } from '../features/auth/authSlice';

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  userId?: string;
}

export const userApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query<UserProfile[], void>({
      query: () => '/user',
      providesTags: ['User'],
    }),
    getUserById: builder.query<UserProfile, string>({
      query: (id) => `/user/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'User', id }],
    }),
    createUser: builder.mutation<UserProfile, CreateUserRequest>({
      query: (newUser) => ({
        url: '/user',
        method: 'POST',
        body: newUser,
      }),
      invalidatesTags: ['User'],
    }),
    deleteUser: builder.mutation<{ success: boolean; message: string }, string>({
      query: (userId) => ({
        url: `/user/${userId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['User'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetUsersQuery,
  useGetUserByIdQuery,
  useCreateUserMutation,
  useDeleteUserMutation,
} = userApi;
