import type { ReactNode } from 'react';
import { Construction } from 'lucide-react';
import { Card } from '@/components/ui/Card';

/**
 * Placeholder condiviso per le pagine non ancora implementate.
 * Gli agenti feature sovrascriveranno i singoli file pagina mantenendo
 * lo stesso path e lo stesso export default.
 */
export function PagePlaceholder({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
      <Card className="flex items-center gap-3 text-muted-foreground">
        <Construction className="h-5 w-5 text-primary" />
        <div>
          <p className="text-sm">
            {description ?? 'Pagina in costruzione (placeholder della Fondazione).'}
          </p>
        </div>
      </Card>
      {children}
    </section>
  );
}
