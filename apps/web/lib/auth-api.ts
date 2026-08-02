import { apiRequest, jsonBody } from '@/lib/api-client'

export type AuthUser = {
  id: string
  phone_number: string
  first_name: string
  last_name: string
  email: string
}

export type RegistrationDetails = {
  phone_number: string
  first_name: string
  last_name: string
  email: string
}

type UserResponse = {
  user: AuthUser
}

export const authApi = {
  getMe: () =>
    apiRequest<UserResponse>('/auth/me/', {
      redirectOnUnauthorized: false,
    }),
  requestLoginCode: (phoneNumber: string) =>
    apiRequest<void>('/auth/login/request-code/', {
      method: 'POST',
      body: jsonBody({ phone_number: phoneNumber }),
      redirectOnUnauthorized: false,
    }),
  verifyLogin: (code: string) =>
    apiRequest<UserResponse>('/auth/login/verify/', {
      method: 'POST',
      body: jsonBody({ code }),
      redirectOnUnauthorized: false,
    }),
  requestRegistrationCode: (details: RegistrationDetails) =>
    apiRequest<void>('/auth/register/request-code/', {
      method: 'POST',
      body: jsonBody(details),
      redirectOnUnauthorized: false,
    }),
  verifyRegistration: (code: string) =>
    apiRequest<UserResponse>('/auth/register/verify/', {
      method: 'POST',
      body: jsonBody({ code }),
      redirectOnUnauthorized: false,
    }),
  logout: () =>
    apiRequest<void>('/auth/logout/', {
      method: 'POST',
      redirectOnUnauthorized: false,
    }),
}
