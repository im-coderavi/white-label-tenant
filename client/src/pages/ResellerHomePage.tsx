import { useAuth } from '../auth/AuthContext';

export default function ResellerHomePage(): JSX.Element {
  const { user } = useAuth();
  return <div>Welcome, {user?.email} (reseller)</div>;
}
