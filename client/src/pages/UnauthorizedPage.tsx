import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Brand } from '../components/layout/Brand';

export default function UnauthorizedPage(): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <Brand className="mb-10" />
      <span className="grid size-12 place-items-center rounded-lg bg-warning/10 text-warning">
        <ShieldAlert className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-bold">You are not authorized to view this page.</h1>
      <p className="mt-2 max-w-md text-sm text-muted">
        This area belongs to a different account type. Sign in with an account that has access.
      </p>
      <Button asChild className="mt-6">
        <Link to="/login">Back to login</Link>
      </Button>
    </div>
  );
}
