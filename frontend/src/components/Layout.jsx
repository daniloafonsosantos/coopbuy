import { Outlet, NavLink } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard,
  Upload,
  ShoppingBag,
  Store,
  Menu,
  X,
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/upload', icon: Upload, label: 'Registrar Preço' },
  { to: '/products', icon: ShoppingBag, label: 'Produtos' },
  { to: '/markets', icon: Store, label: 'Mercados' },
]

export default function Layout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:flex-col w-60 bg-emerald-700 text-white shrink-0">
        <div className="px-6 py-5 border-b border-emerald-600">
          <h1 className="text-lg font-bold tracking-tight">🛒 CoopProject</h1>
          <p className="text-xs text-emerald-300 mt-0.5">Comparador de Preços</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-emerald-100 hover:bg-emerald-600/60'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-emerald-600 text-xs text-emerald-400">
          API: localhost:8000
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar mobile */}
      <aside
        className={`fixed top-0 left-0 h-full w-60 bg-emerald-700 text-white z-50 flex flex-col transform transition-transform duration-200 md:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-6 py-5 border-b border-emerald-600 flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold tracking-tight">🛒 CoopProject</h1>
            <p className="text-xs text-emerald-300 mt-0.5">Comparador de Preços</p>
          </div>
          <button onClick={() => setOpen(false)} className="text-emerald-200 hover:text-white">
            <X size={22} />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-emerald-100 hover:bg-emerald-600/60'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0">
          <button onClick={() => setOpen(true)} className="text-gray-600">
            <Menu size={22} />
          </button>
          <span className="font-semibold text-gray-800">🛒 CoopProject</span>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
