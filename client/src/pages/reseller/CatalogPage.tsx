import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listCatalog, updateCatalogItem } from '../../api/resellerCatalog';
import type { ResellerCatalogItem } from '../../api/resellerCatalog';
import { Button } from '../../components/ui/button';

interface RowState {
  enabled: boolean;
}

function toRowState(item: ResellerCatalogItem): RowState {
  return { enabled: item.enabled };
}

export default function CatalogPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useQuery({ queryKey: ['reseller-catalog'], queryFn: listCatalog });
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!items) return;
    setRowStates((prev) => {
      const next = { ...prev };
      items.forEach((item) => {
        if (!next[item._id]) {
          next[item._id] = toRowState(item);
        }
      });
      return next;
    });
  }, [items]);

  const updateRow = (id: string, patch: Partial<RowState>): void => {
    setRowStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const handleSave = async (item: ResellerCatalogItem): Promise<void> => {
    const state = rowStates[item._id] ?? toRowState(item);
    setRowErrors((prev) => ({ ...prev, [item._id]: '' }));
    try {
      await updateCatalogItem(item._id, { enabled: state.enabled });
      await queryClient.invalidateQueries({ queryKey: ['reseller-catalog'] });
    } catch {
      setRowErrors((prev) => ({ ...prev, [item._id]: 'Could not save changes. Please try again.' }));
    }
  };

  if (isLoading) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <h1>Catalog</h1>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Base price</th>
            <th>Sync mode</th>
            <th>Enabled</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items?.map((item) => {
            const state = rowStates[item._id] ?? toRowState(item);
            return (
              <tr key={item._id}>
                <td>{item.product.name}</td>
                <td>{item.product.type}</td>
                <td>{item.product.basePrice}</td>
                <td>{item.syncMode}</td>
                <td>
                  <input
                    type="checkbox"
                    aria-label="Enabled"
                    checked={state.enabled}
                    disabled={item.syncMode === 'global'}
                    onChange={(e) => updateRow(item._id, { enabled: e.target.checked })}
                  />
                </td>
                <td>
                  <Button onClick={() => handleSave(item)}>Save</Button>
                  {rowErrors[item._id] && <p role="alert">{rowErrors[item._id]}</p>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
