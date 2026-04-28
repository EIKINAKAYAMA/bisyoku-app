import { Link, NavLink, Outlet } from 'react-router-dom'
import { Home, Plus, User, UtensilsCrossed } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const { profile, signOut } = useAuth()

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur-md">
        <div className="container flex h-14 items-center gap-4 md:h-16">
          <Link
            to="/"
            className="flex items-center gap-2 whitespace-nowrap text-lg font-bold tracking-tight md:text-xl"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-white shadow-sm">
              <UtensilsCrossed className="h-4 w-4" />
            </span>
            <span className="bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-transparent">
              美食 App
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex flex-1 items-center gap-1">
            <DesktopNavLink to="/" end>
              一覧
            </DesktopNavLink>
            <DesktopNavLink to="/restaurants/new">店を登録</DesktopNavLink>
            <DesktopNavLink to="/me">プロフィール</DesktopNavLink>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {profile && (
              <Link
                to="/me"
                className="flex items-center gap-2 rounded-full px-1 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                aria-label="プロフィール"
              >
                <Avatar
                  src={profile.avatar_url}
                  fallback={profile.display_name}
                  alt={profile.display_name}
                  className="h-8 w-8"
                />
                <span className="hidden pr-1 sm:inline">{profile.display_name}</span>
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              ログアウト
            </Button>
          </div>
        </div>
      </header>

      <main className="container flex-1 py-6 pb-28 md:py-10 md:pb-16">
        <Outlet />
      </main>

      {/* Mobile-only bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 backdrop-blur md:hidden">
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

function DesktopNavLink({
  to,
  children,
  end,
}: {
  to: string
  children: React.ReactNode
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
        )
      }
    >
      {children}
    </NavLink>
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
