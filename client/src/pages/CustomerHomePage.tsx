import { useAuth } from '../auth/AuthContext';

export default function CustomerHomePage(): JSX.Element {
  const { user } = useAuth();
  return <div>Welcome, {user?.email} (customer)</div>;
}
