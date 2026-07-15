import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { Avatar } from '@/components/ui/Avatar';

export function Header() {
  const { user, profile } = useSession();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
          <Trophy className="h-5 w-5 text-primary" />
          <span>Tornei Calcetto</span>
        </Link>
        {user && (
          <Link to="/profilo" aria-label="Profilo">
            <Avatar
              src={profile?.avatar_url}
              name={profile?.full_name ?? user.email}
              size="sm"
            />
          </Link>
        )}
      </div>
    </header>
  );
}
