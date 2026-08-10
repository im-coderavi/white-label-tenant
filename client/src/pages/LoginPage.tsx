import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useCurrentStore } from '../lib/useCurrentStore';
import { Button } from '../components/ui/button';
import { Input, Label, FieldError } from '../components/ui/input';
import { Alert } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { AuthLayout } from '../components/layout/AuthLayout';
import { KeyRound, Shield, Store, UserCheck, Sparkles } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
  tenantSubdomain: z.string().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const roleHomeRoute: Record<string, string> = {
  master_admin: '/admin',
  reseller_admin: '/reseller',
  reseller_staff: '/reseller',
  customer: '/account',
};

export default function LoginPage(): JSX.Element {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const { subdomain, store } = useCurrentStore();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginFormValues): Promise<void> => {
    setServerError(null);
    try {
      // On a storefront host the subdomain comes from the URL, so it is never typed.
      const tenantSubdomain = subdomain ?? (values.tenantSubdomain || undefined);
      const user = await login({ ...values, tenantSubdomain });
      navigate(roleHomeRoute[user.role] ?? '/login');
    } catch {
      setServerError('Invalid email or password. Please check your credentials.');
    }
  };

  const fillResellerDemo = () => {
    setValue('email', 'reseller@gmail.com');
    setValue('password', '123456');
    setValue('tenantSubdomain', 'resell');
  };

  const fillMasterAdminDemo = () => {
    setValue('email', 'admin@toolzypro.com');
    setValue('password', 'admin1234');
    setValue('tenantSubdomain', '');
  };

  return (
    <AuthLayout
      title="Welcome Back to ToolzyPro"
      subtitle="Sign in to manage your white-label store, license keys, and customers."
      highlights={[
        'Full White-Label Branding & Custom Subdomains / Domains',
        '10,000+ Synced Products & Instant Access Code Generator',
        'Auto-Generated TZP License Keys & File Downloads',
      ]}
      footer={
        <>
          New reseller?{' '}
          <Link to="/register-reseller" className="font-semibold text-primary hover:underline">
            Start Reselling Now
          </Link>{' '}
          or{' '}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Register as Customer
          </Link>
          .
        </>
      }
    >
      {/* Quick Demo Login Preset Buttons */}
      <div className="mb-6 p-4 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>🔐 Demo Login Credentials</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={fillResellerDemo}
            className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition-colors text-xs text-slate-200 group"
          >
            <Store className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
            <div>
              <div className="font-medium text-white">Reseller Login</div>
              <div className="text-[11px] text-slate-400">reseller@gmail.com / 123456</div>
            </div>
          </button>

          <button
            type="button"
            onClick={fillMasterAdminDemo}
            className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition-colors text-xs text-slate-200 group"
          >
            <Shield className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            <div>
              <div className="font-medium text-white">Master Admin</div>
              <div className="text-[11px] text-slate-400">admin@toolzypro.com / admin1234</div>
            </div>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email Address</Label>
          <Input id="email" type="email" placeholder="reseller@gmail.com" autoComplete="email" {...register('email')} />
          {errors.email && <FieldError>{errors.email.message}</FieldError>}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <Label htmlFor="password">Password</Label>
          </div>
          <Input id="password" type="password" placeholder="••••••••" autoComplete="current-password" {...register('password')} />
          {errors.password && <FieldError>{errors.password.message}</FieldError>}
        </div>

        {subdomain ? (
          <Badge tone="brand" className="w-fit">
            <Store className="size-3" aria-hidden="true" />
            Signing in to {store?.name ?? subdomain}
          </Badge>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tenantSubdomain">Store Subdomain / Slug (Optional)</Label>
            <Input id="tenantSubdomain" placeholder="resell" {...register('tenantSubdomain')} />
            <p className="text-[11px] text-slate-400">
              For Reseller/Customer login, enter your store slug (e.g. <span className="text-indigo-400 font-mono">resell</span>). Leave empty for Master Admin.
            </p>
          </div>
        )}

        {serverError && <Alert>{serverError}</Alert>}

        <Button type="submit" size="lg" disabled={isSubmitting} className="mt-2 w-full font-medium">
          {isSubmitting ? 'Authenticating...' : 'Sign In'}
        </Button>
      </form>
    </AuthLayout>
  );
}
