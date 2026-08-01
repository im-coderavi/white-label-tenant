import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';

const registerSchema = z.object({
  tenantSubdomain: z.string().min(3, 'Enter your store subdomain'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterCustomerPage(): JSX.Element {
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values: RegisterFormValues): Promise<void> => {
    setServerError(null);
    try {
      await api.post('/auth/register', values);
      setSuccess(true);
    } catch {
      setServerError('Registration failed. Please check your details and try again.');
    }
  };

  if (success) {
    return <p>Check your email to verify your account, then log in.</p>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h1>Create your account</h1>
      <label htmlFor="tenantSubdomain">Store subdomain</label>
      <input id="tenantSubdomain" {...register('tenantSubdomain')} />
      {errors.tenantSubdomain && <p>{errors.tenantSubdomain.message}</p>}

      <label htmlFor="email">Email</label>
      <input id="email" type="email" {...register('email')} />
      {errors.email && <p>{errors.email.message}</p>}

      <label htmlFor="password">Password</label>
      <input id="password" type="password" {...register('password')} />
      {errors.password && <p>{errors.password.message}</p>}

      {serverError && <p role="alert">{serverError}</p>}

      <Button type="submit" disabled={isSubmitting}>
        Register
      </Button>
    </form>
  );
}
