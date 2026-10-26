import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';

// Server-side guard: the admin panel (members, invites, events, library) is admins only.
// Non-admins never receive the admin UI; the API routes behind it also return 403.
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect('/login?mode=signin&next=/admin');
  if (user.role !== 'admin') redirect('/');
  return <>{children}</>;
}
