import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listStorefrontProducts } from '../../api/storefront';
import { createCheckout } from '../../api/customerOrders';
import { Button } from '../../components/ui/button';

export default function StorefrontPage(): JSX.Element {
  const navigate = useNavigate();
  const [buyError, setBuyError] = useState<string | null>(null);
  const { data: items, isLoading } = useQuery({
    queryKey: ['storefront'],
    queryFn: listStorefrontProducts,
  });

  const handleBuy = async (productId: string): Promise<void> => {
    setBuyError(null);
    try {
      const result = await createCheckout(productId);
      navigate(`/account/orders/${result.orderId}`, { state: result });
    } catch {
      setBuyError('Could not start checkout. Please try again.');
    }
  };

  if (isLoading) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <h1>Store</h1>
      {buyError && <p role="alert">{buyError}</p>}
      <ul>
        {items?.map((item) => (
          <li key={item._id}>
            <h2>{item.name}</h2>
            {item.isFeatured && <span>Featured</span>}
            <p>{item.description}</p>
            <p>
              {item.price} {item.currency}
            </p>
            <Button onClick={() => handleBuy(item._id)}>Buy</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
