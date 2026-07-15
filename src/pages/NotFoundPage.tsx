import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="py-12">
      <EmptyState
        title="Pagina non trovata"
        description="La pagina che cerchi non esiste o è stata spostata."
        action={
          <Link to="/">
            <Button>Torna ai tornei</Button>
          </Link>
        }
      />
    </div>
  );
}
