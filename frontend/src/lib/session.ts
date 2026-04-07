import api from '@/services/api';
import { useAuthStore } from '@/store/auth.store';

/**
 * מגדיר את הטוקן בחנות, טוען `/users/me` ו־`/settings/profile` ומעדכן את המשתמש.
 */
export async function establishSession(accessToken: string): Promise<void> {
  useAuthStore.getState().setAccessToken(accessToken);

  const { data: me } = await api.get<{ userId: string; email: string }>(
    '/users/me',
  );

  let name = '';
  let role = 'USER';
  let twoFactorEnabled: boolean | undefined;

  try {
    const { data: profile } = await api.get<{
      name?: string | null;
      role?: string;
      twoFactorEnabled?: boolean;
    }>('/settings/profile');
    name = profile.name?.trim() || '';
    role = profile.role || 'USER';
    twoFactorEnabled = profile.twoFactorEnabled;
  } catch {
    // פרופיל אופציונלי
  }

  const displayName =
    name || me.email.split('@')[0] || 'משתמש';

  useAuthStore.getState().setAuth(
    {
      id: me.userId,
      email: me.email,
      name: displayName,
      role,
      twoFactorEnabled,
    },
    accessToken,
  );
}
