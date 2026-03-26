export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface AuthUser {
  id: number;
  username: string;
  role: string;
}
