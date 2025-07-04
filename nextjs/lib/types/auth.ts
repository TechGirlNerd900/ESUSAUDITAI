export type UserProfile = {
  id: string;
  auth_user_id: string;
  role: string;
  is_active: boolean;
  status: string;
};

export type AuthError = {
  status: number;
  message: string;
};

export type AuthSuccess = {
  success: true;
  profile: UserProfile;
};

export type AuthFailure = {
  success: false;
  error: AuthError;
};

export type AuthResult = AuthSuccess | AuthFailure;
