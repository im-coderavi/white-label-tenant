import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { createProduct } from '../../api/adminProducts';
import { Button } from '../../components/ui/button';
import { Input, Textarea, Select, Label, FieldError } from '../../components/ui/input';
import { Alert } from '../../components/ui/alert';
import { PageHeader } from '../../components/ui/page-header';
import { Card, CardContent, CardFooter } from '../../components/ui/card';

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
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to="/admin/products"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to products
        </Link>
        <PageHeader
          title="New product"
          description="Products start as drafts. Add a version, then publish when it is ready to sell."
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card className="max-w-2xl">
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Ecommerce starter kit" {...register('name')} />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="type">Type</Label>
                <Select id="type" {...register('type')}>
                  {PRODUCT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace('_', ' ')}
                    </option>
                  ))}
                </Select>
                {errors.type && <FieldError>{errors.type.message}</FieldError>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="basePrice">Base price</Label>
                <Input id="basePrice" type="number" placeholder="0" {...register('basePrice')} />
                {errors.basePrice ? (
                  <FieldError>{errors.basePrice.message}</FieldError>
                ) : (
                  <p className="text-xs text-muted">Resellers can charge more or less than this.</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What the buyer gets, in a sentence or two."
                {...register('description')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="thumbnail">Thumbnail</Label>
              <Input
                id="thumbnail"
                type="file"
                accept="image/*"
                onChange={(e) => setThumbnail(e.target.files?.[0])}
              />
            </div>

            {serverError && <Alert>{serverError}</Alert>}
          </CardContent>

          <CardFooter className="justify-end">
            <Button asChild variant="ghost">
              <Link to="/admin/products">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Create product
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
