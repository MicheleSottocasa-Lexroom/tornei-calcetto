import { Link } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';
import { Avatar } from '@/components/ui/Avatar';
import { ThemeToggle } from '@/components/ThemeSelector';

export function Header() {
  const { user, profile } = useSession();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2 font-semibold text-foreground"
        >
          <img src="/icons/icon.svg" alt="" className="h-7 w-7 shrink-0 rounded-md" />
          <span className="truncate">Tornei Calcetto</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
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
      </div>
    </header>
  );
}
