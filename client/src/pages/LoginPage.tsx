import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/ui/button';
import { Input, Label, FieldError } from '../components/ui/input';
import { Alert } from '../components/ui/alert';
import { AuthLayout } from '../components/layout/AuthLayout';

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
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginFormValues): Promise<void> => {
    setServerError(null);
    try {
      const user = await login({
        ...values,
        tenantSubdomain: values.tenantSubdomain ? values.tenantSubdomain : undefined,
      });
      navigate(roleHomeRoute[user.role] ?? '/login');
    } catch {
      setServerError('Invalid email or password');
    }
  };

  return (
    <AuthLayout
      title="Log in"
      subtitle="Pick up where you left off."
      highlights={[
        'A storefront that carries your brand',
        'Your prices, your margin',
        'License keys issued automatically',
      ]}
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>{' '}
          or{' '}
          <Link to="/register-reseller" className="font-medium text-primary hover:underline">
            start reselling
          </Link>
          .
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email && <FieldError>{errors.email.message}</FieldError>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
          {errors.password && <FieldError>{errors.password.message}</FieldError>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tenantSubdomain">Store subdomain (optional)</Label>
          <Input id="tenantSubdomain" placeholder="acme" {...register('tenantSubdomain')} />
          <p className="text-xs text-muted">Leave blank if you sign in as the platform owner.</p>
        </div>

        {serverError && <Alert>{serverError}</Alert>}

        <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1 w-full">
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}
