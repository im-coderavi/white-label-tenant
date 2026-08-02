import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Archive, History, Send, Share2 } from 'lucide-react';
import {
  getProduct,
  updateProduct,
  archiveProduct,
  publishProduct,
  updateSyncMode,
  listVersions,
  addVersion,
} from '../../api/adminProducts';
import { listTenants } from '../../api/adminTenants';
import { Button } from '../../components/ui/button';
import { Input, Textarea, Select, Label, FieldError } from '../../components/ui/input';
import { Alert } from '../../components/ui/alert';
import { StatusBadge } from '../../components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/card';

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

  const [syncMode, setSyncMode] = useState('optional');
  const [tenantId, setTenantId] = useState('');
  const [syncModeError, setSyncModeError] = useState<string | null>(null);

  const { data: tenants } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: listTenants,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (product) {
      setSyncMode(product.syncMode);
      setTenantId(product.tenantId ?? '');
    }
  }, [product]);

  const {
    register: registerVersion,
    handleSubmit: handleSubmitVersion,
    reset: resetVersionForm,
    formState: { errors: versionErrors, isSubmitting: isSubmittingVersion },
  } = useForm<{ version: string; changelog?: string }>({
    resolver: zodResolver(
      z.object({
        version: z.string().min(1, 'Version is required'),
        changelog: z.string().optional(),
      })
    ),
  });
  const [versionFile, setVersionFile] = useState<File | undefined>(undefined);

  const { data: versions } = useQuery({
    queryKey: ['admin-product-versions', id],
    queryFn: () => listVersions(id as string),
    enabled: Boolean(id),
  });

  if (isLoading || !product) {
    return <p className="text-sm text-muted">Loading...</p>;
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

  const handleSyncModeSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSyncModeError(null);
    try {
      await updateSyncMode(product._id, {
        syncMode,
        tenantId: syncMode === 'private' || syncMode === 'exclusive' ? tenantId : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-product', id] });
    } catch {
      setSyncModeError('Could not update sync mode. Please try again.');
    }
  };

  const onSubmitVersion = async (values: { version: string; changelog?: string }): Promise<void> => {
    await addVersion(product._id, { ...values, file: versionFile });
    setVersionFile(undefined);
    resetVersionForm();
    await queryClient.invalidateQueries({ queryKey: ['admin-product-versions', id] });
    await queryClient.invalidateQueries({ queryKey: ['admin-product', id] });
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

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-1.5 text-eyebrow uppercase text-primary">{product.type.replace('_', ' ')}</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold sm:text-[1.75rem]">{product.name}</h1>
              <StatusBadge status={product.status} />
            </div>
            <p className="mt-1.5 font-mono text-xs text-muted">/{product.slug}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button onClick={handlePublish}>
              <Send aria-hidden="true" />
              Publish
            </Button>
            <Button variant="destructive" onClick={handleArchive}>
              <Archive aria-hidden="true" />
              Archive
            </Button>
          </div>
        </div>
      </div>

      {publishError && <Alert>{publishError}</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <form onSubmit={handleSubmit(onSubmitInfo)} noValidate>
            <Card>
              <CardHeader>
                <CardTitle>Product details</CardTitle>
                <CardDescription>Shown to every reseller who lists this product.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" {...register('name')} />
                  {errors.name && <FieldError>{errors.name.message}</FieldError>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" {...register('description')} />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="basePrice">Base price</Label>
                    <Input id="basePrice" type="number" {...register('basePrice')} />
                    {errors.basePrice && <FieldError>{errors.basePrice.message}</FieldError>}
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
                </div>

                {infoError && <Alert>{infoError}</Alert>}
              </CardContent>
              <CardFooter className="justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  Save changes
                </Button>
              </CardFooter>
            </Card>
          </form>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-4 text-muted" aria-hidden="true" />
                Versions
              </CardTitle>
              <CardDescription>A product needs at least one version before it can be published.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {versions && versions.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {versions.map((version) => (
                    <li
                      key={version._id}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md border border-border bg-secondary/40 px-3.5 py-2.5"
                    >
                      <strong className="font-mono text-sm font-bold text-foreground">
                        {version.version}
                      </strong>
                      <span className="text-sm text-muted">{version.changelog}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No versions yet.</p>
              )}

              <form
                onSubmit={handleSubmitVersion(onSubmitVersion)}
                className="flex flex-col gap-4 border-t border-border pt-5"
                noValidate
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="version">Version</Label>
                    <Input id="version" placeholder="1.0.0" {...registerVersion('version')} />
                    {versionErrors.version && <FieldError>{versionErrors.version.message}</FieldError>}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="versionFile">File</Label>
                    <Input
                      id="versionFile"
                      type="file"
                      onChange={(e) => setVersionFile(e.target.files?.[0])}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="changelog">Changelog</Label>
                  <Textarea id="changelog" placeholder="What changed in this release?" {...registerVersion('changelog')} />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" variant="outline" disabled={isSubmittingVersion}>
                    Add version
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <form onSubmit={handleSyncModeSubmit} className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="size-4 text-muted" aria-hidden="true" />
                Distribution
              </CardTitle>
              <CardDescription>Controls which reseller storefronts can list this product.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="syncMode">Sync mode</Label>
                <Select id="syncMode" value={syncMode} onChange={(e) => setSyncMode(e.target.value)}>
                  <option value="global">global</option>
                  <option value="optional">optional</option>
                  <option value="private">private</option>
                  <option value="exclusive">exclusive</option>
                </Select>
                <p className="text-xs text-muted">
                  {syncMode === 'global' && 'Enabled for every reseller and cannot be turned off.'}
                  {syncMode === 'optional' && 'Offered to every reseller, who each choose to enable it.'}
                  {syncMode === 'private' && 'Only the selected reseller can list it.'}
                  {syncMode === 'exclusive' && 'Reserved for the selected reseller alone.'}
                </p>
              </div>

              {(syncMode === 'private' || syncMode === 'exclusive') && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tenantId">Tenant</Label>
                  <Select id="tenantId" value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
                    <option value="">Select a tenant</option>
                    {tenants?.map((tenant) => (
                      <option key={tenant._id} value={tenant._id}>
                        {tenant.name} ({tenant.subdomain})
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {syncModeError && <Alert>{syncModeError}</Alert>}
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit" variant="outline">
                Update sync mode
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </div>
  );
}
