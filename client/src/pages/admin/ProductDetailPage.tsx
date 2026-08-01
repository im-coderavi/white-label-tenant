import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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

      <form onSubmit={handleSyncModeSubmit}>
        <label htmlFor="syncMode">Sync mode</label>
        <select id="syncMode" value={syncMode} onChange={(e) => setSyncMode(e.target.value)}>
          <option value="global">global</option>
          <option value="optional">optional</option>
          <option value="private">private</option>
          <option value="exclusive">exclusive</option>
        </select>

        {(syncMode === 'private' || syncMode === 'exclusive') && (
          <>
            <label htmlFor="tenantId">Tenant</label>
            <select id="tenantId" value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
              <option value="">Select a tenant</option>
              {tenants?.map((tenant) => (
                <option key={tenant._id} value={tenant._id}>
                  {tenant.name} ({tenant.subdomain})
                </option>
              ))}
            </select>
          </>
        )}

        {syncModeError && <p role="alert">{syncModeError}</p>}

        <Button type="submit">Update sync mode</Button>
      </form>

      <section>
        <h2>Versions</h2>
        <ul>
          {versions?.map((version) => (
            <li key={version._id}>
              <strong>{version.version}</strong> — {version.changelog}
            </li>
          ))}
        </ul>

        <form onSubmit={handleSubmitVersion(onSubmitVersion)}>
          <label htmlFor="version">Version</label>
          <input id="version" {...registerVersion('version')} />
          {versionErrors.version && <p>{versionErrors.version.message}</p>}

          <label htmlFor="changelog">Changelog</label>
          <textarea id="changelog" {...registerVersion('changelog')} />

          <label htmlFor="versionFile">File</label>
          <input id="versionFile" type="file" onChange={(e) => setVersionFile(e.target.files?.[0])} />

          <Button type="submit" disabled={isSubmittingVersion}>
            Add version
          </Button>
        </form>
      </section>
    </div>
  );
}
