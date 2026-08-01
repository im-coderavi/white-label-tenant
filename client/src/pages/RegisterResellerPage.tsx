import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';

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
      <p>
        Almost there — complete payment (order {result.gatewayOrderId}) for {result.amount} {result.currency} to
        activate your store.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h1>Become a reseller</h1>
      <label htmlFor="businessName">Business name</label>
      <input id="businessName" {...register('businessName')} />
      {errors.businessName && <p>{errors.businessName.message}</p>}

      <label htmlFor="subdomain">Store subdomain</label>
      <input id="subdomain" {...register('subdomain')} />
      {errors.subdomain && <p>{errors.subdomain.message}</p>}

      <label htmlFor="email">Email</label>
      <input id="email" type="email" {...register('email')} />
      {errors.email && <p>{errors.email.message}</p>}

      <label htmlFor="password">Password</label>
      <input id="password" type="password" {...register('password')} />
      {errors.password && <p>{errors.password.message}</p>}

      <label htmlFor="planId">Plan</label>
      <select id="planId" {...register('planId')} disabled={plansLoading}>
        <option value="">Select a plan</option>
        {plans?.map((plan) => (
          <option key={plan._id} value={plan._id}>
            {plan.name} — {plan.price} {plan.currency}
          </option>
        ))}
      </select>
      {errors.planId && <p>{errors.planId.message}</p>}

      {serverError && <p role="alert">{serverError}</p>}

      <Button type="submit" disabled={isSubmitting}>
        Register
      </Button>
    </form>
  );
}
