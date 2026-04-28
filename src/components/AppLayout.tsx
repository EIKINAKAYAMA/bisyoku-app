import { Link, NavLink, Outlet } from 'react-router-dom'
import { Home, Plus, User } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const { profile, signOut } = useAuth()

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="text-lg font-bold">
            美食 App
          </Link>
          <div className="flex items-center gap-2">
            {profile && (
              <Link
                to="/me"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {profile.display_name}
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              ログアウト
            </Button>
          </div>
        </div>
      </header>

      <main className="container flex-1 py-4 pb-24">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-around">
          <BottomLink to="/" icon={<Home className="h-5 w-5" />} label="一覧" end />
          <BottomLink
            to="/restaurants/new"
            icon={<Plus className="h-5 w-5" />}
            label="店を登録"
          />
          <BottomLink to="/me" icon={<User className="h-5 w-5" />} label="プロフィール" />
        </div>
      </nav>
    </div>
  )
}

function BottomLink({
  to,
  icon,
  label,
  end,
}: {
  to: string
  icon: React.ReactNode
  label: string
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center gap-0.5 px-3 py-1 text-xs',
          isActive ? 'text-primary' : 'text-muted-foreground'
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}
