import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi, settingsApi } from '@/services/api';
import { establishSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TrendingUp, Loader2 } from 'lucide-react';

function messageFromAxios(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const res = (err as { response?: { data?: { message?: string | string[] } } })
      .response?.data;
    const m = res?.message;
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string') return m;
  }
  return 'שגיאה בהרשמה';
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await authApi.register({ email, password });
      const { data } = await authApi.login({ email, password });
      await establishSession(data.accessToken, data.refreshToken);
      if (name.trim()) {
        try {
          await settingsApi.updateProfile({ name: name.trim() });
        } catch {
          /* לא קריטי */
        }
        await establishSession(data.accessToken, data.refreshToken);
      }
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setError(messageFromAxios(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <TrendingUp className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">הרשמה</CardTitle>
          <CardDescription>צור חשבון חדש</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">שם (אופציונלי)</label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="השם שלך"
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">אימייל</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                dir="ltr"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">סיסמה</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                dir="ltr"
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                לפחות 8 תווים (דרישת השרת)
              </p>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              הירשם
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            כבר רשום?{' '}
            <Link to="/login" className="text-primary hover:underline">
              התחבר
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
