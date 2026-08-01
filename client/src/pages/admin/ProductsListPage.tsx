import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listProducts } from '../../api/adminProducts';
import { Button } from '../../components/ui/button';

export default function ProductsListPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products', { search, type, status }],
    queryFn: () =>
      listProducts({
        search: search || undefined,
        type: type || undefined,
        status: status || undefined,
      }),
  });

  return (
    <div>
      <h1>Products</h1>
      <Link to="/admin/products/new">
        <Button>New Product</Button>
      </Link>

      <input aria-label="Search products" value={search} onChange={(e) => setSearch(e.target.value)} />
      <select aria-label="Filter by type" value={type} onChange={(e) => setType(e.target.value)}>
        <option value="">All types</option>
        <option value="software">software</option>
        <option value="theme">theme</option>
      </select>
      <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>
        <option value="draft">draft</option>
        <option value="published">published</option>
        <option value="archived">archived</option>
      </select>

      {isLoading && <p>Loading...</p>}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Status</th>
            <th>Price</th>
            <th>Sync mode</th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((product) => (
            <tr key={product._id}>
              <td>
                <Link to={`/admin/products/${product._id}`}>{product.name}</Link>
              </td>
              <td>{product.type}</td>
              <td>{product.status}</td>
              <td>{product.basePrice}</td>
              <td>{product.syncMode}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
