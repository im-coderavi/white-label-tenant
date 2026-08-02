import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Rocket } from 'lucide-react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input, Select, Label, FieldError } from '../components/ui/input';
import { Alert } from '../components/ui/alert';
import { AuthLayout } from '../components/layout/AuthLayout';

interface Plan {
  _id: string;
  name: string;
  price: number;
  currency: string;
  billingCycle: string;
}

const registerResellerSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  subdomain: z
    .string()
    .min(3, 'Subdomain must be at least 3 characters')
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and hyphens only'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  planId: z.string().min(1, 'Choose a plan'),
});

type RegisterResellerFormValues = z.infer<typeof registerResellerSchema>;

const HIGHLIGHTS = [
  'Your own branded storefront',
  'Set custom prices or a flat discount',
  'Keep every rupee above your cost',
];

export default function RegisterResellerPage(): JSX.Element {
  const [result, setResult] = useState<{ gatewayOrderId: string; amount: number; currency: string } | null>(
    null
  );
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['reseller-plans'],
    queryFn: async () => {
      const res = await api.get<{ plans: Plan[] }>('/plans');
      return res.data.plans;
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterResellerFormValues>({ resolver: zodResolver(registerResellerSchema) });

  const onSubmit = async (values: RegisterResellerFormValues): Promise<void> => {
    setServerError(null);
    try {
      const res = await api.post('/auth/register-reseller', values);
      setResult(res.data);
    } catch {
      setServerError('Registration failed. Please check your details and try again.');
    }
  };

  if (result) {
    return (
      <AuthLayout title="Store reserved" subtitle="Payment is the last step." highlights={HIGHLIGHTS}>
        <div className="rounded-lg border border-border bg-surface p-6 text-center shadow-card">
          <span className="mx-auto mb-4 grid size-11 place-items-center rounded-md bg-primary/10 text-primary">
            <Rocket className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm text-muted">
            Almost there — complete payment (order {result.gatewayOrderId}) for {result.amount}{' '}
            {result.currency} to activate your store.
          </p>
          <Button asChild className="mt-5 w-full">
            <Link to="/login">Go to login</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Become a reseller"
      subtitle="Pick a plan and your storefront goes live the moment payment clears."
      highlights={HIGHLIGHTS}
      footer={
        <>
          Already selling with us?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
          .
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="businessName">Business name</Label>
          <Input id="businessName" placeholder="Acme Digital" {...register('businessName')} />
          {errors.businessName && <FieldError>{errors.businessName.message}</FieldError>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="subdomain">Store subdomain</Label>
          <Input id="subdomain" placeholder="acme" {...register('subdomain')} />
          {errors.subdomain ? (
            <FieldError>{errors.subdomain.message}</FieldError>
          ) : (
            <p className="text-xs text-muted">Lowercase letters, numbers, and hyphens.</p>
          )}
        </div>

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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="planId">Plan</Label>
          <Select id="planId" disabled={plansLoading} {...register('planId')}>
            <option value="">Select a plan</option>
            {plans?.map((plan) => (
              <option key={plan._id} value={plan._id}>
                {plan.name} — {plan.price} {plan.currency}
              </option>
            ))}
          </Select>
          {errors.planId && <FieldError>{errors.planId.message}</FieldError>}
        </div>

        {serverError && <Alert>{serverError}</Alert>}

        <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1 w-full">
          Register
        </Button>
      </form>
    </AuthLayout>
  );
}
