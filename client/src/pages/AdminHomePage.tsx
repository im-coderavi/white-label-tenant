import { useAuth } from '../auth/AuthContext';

export default function AdminHomePage(): JSX.Element {
  const { user } = useAuth();
  return <div>Welcome, {user?.email} (master_admin)</div>;
}
