import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/ui/button';

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
    <form onSubmit={handleSubmit(onSubmit)}>
      <h1>Log in</h1>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" {...register('email')} />
      {errors.email && <p>{errors.email.message}</p>}

      <label htmlFor="password">Password</label>
      <input id="password" type="password" {...register('password')} />
      {errors.password && <p>{errors.password.message}</p>}

      <label htmlFor="tenantSubdomain">Store subdomain (optional)</label>
      <input id="tenantSubdomain" {...register('tenantSubdomain')} />

      {serverError && <p role="alert">{serverError}</p>}

      <Button type="submit" disabled={isSubmitting}>
        Log in
      </Button>
    </form>
  );
}
