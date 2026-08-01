import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/button';

export default function CustomerLayout(): JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = (): void => {
    logout();
    navigate('/login');
  };

  return (
    <div>
      <header>
        <span>{user?.email}</span>
        <Button variant="outline" onClick={handleLogout}>
          Log out
        </Button>
      </header>
      <nav>
        <NavLink to="/account/store">Store</NavLink>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
