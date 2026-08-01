import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getProduct, updateProduct, archiveProduct, publishProduct } from '../../api/adminProducts';
import { Button } from '../../components/ui/button';

const updateInfoSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  basePrice: z.coerce.number().min(0, 'Price must be zero or more'),
  currency: z.string().optional(),
});

type UpdateInfoFormValues = z.infer<typeof updateInfoSchema>;

export default function ProductDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [publishError, setPublishError] = useState<string | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<File | undefined>(undefined);

  const { data: product, isLoading } = useQuery({
    queryKey: ['admin-product', id],
    queryFn: () => getProduct(id as string),
    enabled: Boolean(id),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateInfoFormValues>({
    resolver: zodResolver(updateInfoSchema),
    values: product
      ? {
          name: product.name,
          description: product.description,
          basePrice: product.basePrice,
          currency: product.currency,
        }
      : undefined,
  });

  if (isLoading || !product) {
    return <p>Loading...</p>;
  }

  const onSubmitInfo = async (values: UpdateInfoFormValues): Promise<void> => {
    setInfoError(null);
    try {
      await updateProduct(product._id, { ...values, thumbnail });
      await queryClient.invalidateQueries({ queryKey: ['admin-product', id] });
    } catch {
      setInfoError('Could not save changes. Please try again.');
    }
  };

  const handlePublish = async (): Promise<void> => {
    setPublishError(null);
    try {
      await publishProduct(product._id);
      await queryClient.invalidateQueries({ queryKey: ['admin-product', id] });
    } catch {
      setPublishError('Add a version before publishing');
    }
  };

  const handleArchive = async (): Promise<void> => {
    await archiveProduct(product._id);
    await queryClient.invalidateQueries({ queryKey: ['admin-product', id] });
  };

  return (
    <div>
      <h1>{product.name}</h1>
      <p>Status: {product.status}</p>

      <form onSubmit={handleSubmit(onSubmitInfo)}>
        <label htmlFor="name">Name</label>
        <input id="name" {...register('name')} />
        {errors.name && <p>{errors.name.message}</p>}

        <label htmlFor="description">Description</label>
        <textarea id="description" {...register('description')} />

        <label htmlFor="basePrice">Base price</label>
        <input id="basePrice" type="number" {...register('basePrice')} />
        {errors.basePrice && <p>{errors.basePrice.message}</p>}

        <label htmlFor="thumbnail">Thumbnail</label>
        <input id="thumbnail" type="file" onChange={(e) => setThumbnail(e.target.files?.[0])} />

        {infoError && <p role="alert">{infoError}</p>}

        <Button type="submit" disabled={isSubmitting}>
          Save changes
        </Button>
      </form>

      <Button onClick={handlePublish}>Publish</Button>
      {publishError && <p role="alert">{publishError}</p>}

      <Button variant="destructive" onClick={handleArchive}>
        Archive
      </Button>
    </div>
  );
}
