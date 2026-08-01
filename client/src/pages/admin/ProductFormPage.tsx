import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { createProduct } from '../../api/adminProducts';
import { Button } from '../../components/ui/button';

const PRODUCT_TYPES = [
  'software',
  'ai_tool',
  'theme',
  'plugin',
  'script',
  'template',
  'landing_page',
  'bundle',
  'course',
  'digital_download',
  'subscription',
] as const;

const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(PRODUCT_TYPES),
  description: z.string().optional(),
  basePrice: z.coerce.number().min(0, 'Price must be zero or more'),
  currency: z.string().optional(),
});

type CreateProductFormValues = z.infer<typeof createProductSchema>;

export default function ProductFormPage(): JSX.Element {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<File | undefined>(undefined);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateProductFormValues>({ resolver: zodResolver(createProductSchema) });

  const onSubmit = async (values: CreateProductFormValues): Promise<void> => {
    setServerError(null);
    try {
      const product = await createProduct({ ...values, thumbnail });
      navigate(`/admin/products/${product._id}`);
    } catch {
      setServerError('Could not create the product. Please check your details and try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h1>New product</h1>
      <label htmlFor="name">Name</label>
      <input id="name" {...register('name')} />
      {errors.name && <p>{errors.name.message}</p>}

      <label htmlFor="type">Type</label>
      <select id="type" {...register('type')}>
        {PRODUCT_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      {errors.type && <p>{errors.type.message}</p>}

      <label htmlFor="description">Description</label>
      <textarea id="description" {...register('description')} />

      <label htmlFor="basePrice">Base price</label>
      <input id="basePrice" type="number" {...register('basePrice')} />
      {errors.basePrice && <p>{errors.basePrice.message}</p>}

      <label htmlFor="thumbnail">Thumbnail</label>
      <input id="thumbnail" type="file" onChange={(e) => setThumbnail(e.target.files?.[0])} />

      {serverError && <p role="alert">{serverError}</p>}

      <Button type="submit" disabled={isSubmitting}>
        Create product
      </Button>
    </form>
  );
}
