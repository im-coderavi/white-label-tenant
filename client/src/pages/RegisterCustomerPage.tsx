import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck, Store } from 'lucide-react';
import { api } from '../lib/api';
import { useCurrentStore } from '../lib/useCurrentStore';
import { Button } from '../components/ui/button';
import { Input, Label, FieldError } from '../components/ui/input';
import { Alert } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { AuthLayout } from '../components/layout/AuthLayout';

const registerSchema = z.object({
  // Optional in the schema because a storefront host supplies it instead of the visitor.
  tenantSubdomain: z.string().optional(),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const HIGHLIGHTS = [
  'Instant access after checkout',
  'A license key with every order',
  'Re-download anything you have bought',
];

export default function RegisterCustomerPage(): JSX.Element {
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { subdomain, store } = useCurrentStore();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values: RegisterFormValues): Promise<void> => {
    setServerError(null);
    // On a storefront host the subdomain comes from the URL, so it is never typed.
    const tenantSubdomain = subdomain ?? values.tenantSubdomain;
    if (!tenantSubdomain || tenantSubdomain.length < 3) {
      setError('tenantSubdomain', { message: 'Enter your store subdomain' });
      return;
    }
    try {
      await api.post('/auth/register', { ...values, tenantSubdomain });
      setSuccess(true);
    } catch {
      setServerError('Registration failed. Please check your details and try again.');
    }
  };

  if (success) {
    return (
      <AuthLayout title="Account created" subtitle="One more step." highlights={HIGHLIGHTS}>
        <div className="rounded-lg border border-border bg-surface p-6 text-center shadow-card">
          <span className="mx-auto mb-4 grid size-11 place-items-center rounded-md bg-success/10 text-success">
            <MailCheck className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm text-muted">Check your email to verify your account, then log in.</p>
          <Button asChild className="mt-5 w-full">
            <Link to="/login">Go to login</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Buy from your reseller's store in a couple of clicks."
      highlights={HIGHLIGHTS}
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
          .
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {subdomain ? (
          <Badge tone="brand" className="w-fit">
            <Store className="size-3" aria-hidden="true" />
            Joining {store?.name ?? subdomain}
          </Badge>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tenantSubdomain">Store subdomain</Label>
            <Input id="tenantSubdomain" placeholder="acme" {...register('tenantSubdomain')} />
            {errors.tenantSubdomain ? (
              <FieldError>{errors.tenantSubdomain.message}</FieldError>
            ) : (
              <p className="text-xs text-muted">The store you are buying from.</p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email && <FieldError>{errors.email.message}</FieldError>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
          {errors.password && <FieldError>{errors.password.message}</FieldError>}
        </div>

        {serverError && <Alert>{serverError}</Alert>}

        <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1 w-full">
          Register
        </Button>
      </form>
    </AuthLayout>
  );
}
