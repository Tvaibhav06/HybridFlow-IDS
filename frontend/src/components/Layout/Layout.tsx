import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard, Crosshair, Upload, Zap,
  BarChart3, Search, ChevronLeft, ChevronRight,
  Shield, Activity, AlertCircle, Trash2
} from 'lucide-react'
import { api } from '@/api/client'
import { useSettingsStore } from '@/store/settings'
import { clsx } from 'clsx'

const NAV_ITEMS = [
  { path: '/dashboard',  label: 'Dashboard',   icon: LayoutDashboard, desc: 'Overview' },
  { path: '/predict',    label: 'Playground',  icon: Crosshair,       desc: 'Live predict' },
  { path: '/batch',      label: 'Batch',       icon: Upload,          desc: 'CSV upload' },
  { path: '/simulator',  label: 'Simulator',   icon: Zap,             desc: 'Attack sim' },
  { path: '/analytics',  label: 'Analytics',   icon: BarChart3,       desc: 'Charts' },
  { path: '/forensics',  label: 'Forensics',   icon: Search,          desc: 'Investigation' },
]

export default function Layout() {
  const { sidebarCollapsed, toggleSidebar, clearPredictions } = useSettingsStore()
  const location = useLocation()
  const queryClient = useQueryClient()

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 30_000,
    retry: 1,
  })

  const isOnline = health?.status === 'ok'

  const handleReset = async () => {
    if (!confirm(
      'Reset all statistics and prediction history?\n\nThis will clear:\n• Local prediction history\n• Live dashboard charts\n• Server database logs\n\nTrained AI models remain unaffected.'
    )) return

    try {
      await api.resetStats()
    } catch (e) {
      console.warn('Backend reset failed:', e)
    }

    clearPredictions()
    queryClient.clear()
    setTimeout(() => {
      queryClient.invalidateQueries()
    }, 300)
  }

  const currentNav = NAV_ITEMS.find(n => location.pathname.startsWith(n.path))

  return (
    <div className="flex h-screen bg-bg-base overflow-hidden text-text-primary">
      {/* Sidebar */}
      <motion.aside
        animate={{ width: sidebarCollapsed ? 64 : 220 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="flex flex-col border-r border-border bg-bg-surface z-20 flex-shrink-0"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 border-b border-border-strong h-16 flex-shrink-0">
          <div className="relative flex-shrink-0 flex items-center justify-center w-7 h-7 border border-border-strong bg-bg-base rounded-[2px]">
            <Shield className="w-4 h-4 text-text-primary" />
            <div className={clsx(
              "absolute -top-1 -right-1 w-1.5 h-1.5 border border-bg-surface",
              isOnline ? "bg-semantic-normal" : "bg-semantic-crit"
            )} />
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="font-serif font-semibold text-text-primary text-base leading-tight whitespace-nowrap tracking-tight">
                  HybridFlow
                </div>
                <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest whitespace-nowrap">
                  {isOnline ? 'Systems nominal' : 'Offline mode'}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {!sidebarCollapsed && (
            <div className="px-3 pb-2 font-mono text-[10px] text-text-muted uppercase tracking-widest">
              Modules
            </div>
          )}
          {NAV_ITEMS.map(({ path, label, icon: Icon, desc }) => {
            const active = location.pathname.startsWith(path)
            return (
              <NavLink
                key={path}
                to={path}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-[2px] border transition-colors duration-150 group relative",
                  active
                    ? "bg-bg-elevated text-text-primary border-border-strong font-medium"
                    : "text-text-secondary border-transparent hover:text-text-primary hover:bg-bg-elevated"
                )}
              >
                <Icon className={clsx("w-4 h-4 flex-shrink-0", active ? "text-text-primary" : "text-text-muted group-hover:text-text-primary")} />
                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="font-mono text-xs uppercase tracking-wider whitespace-nowrap"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {sidebarCollapsed && (
                  <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-bg-surface border border-border-strong
                    rounded-[2px] text-xs font-mono text-text-primary whitespace-nowrap opacity-0
                    group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    <div className="uppercase tracking-wider font-medium">{label}</div>
                    <div className="text-[10px] text-text-muted">{desc}</div>
                  </div>
                )}
                {active && (
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-border-strong" />
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="p-3 border-t border-border">
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center p-2 rounded-[2px] border border-transparent text-text-muted
              hover:text-text-primary hover:bg-bg-elevated hover:border-border transition-colors duration-150"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </motion.aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 border-b border-border-strong bg-bg-base flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Activity className="w-4 h-4 text-text-secondary" />
            <span className="font-serif text-base font-semibold text-text-primary tracking-tight">
              HybridFlow IDS
            </span>
            <span className="text-border font-mono text-xs">/</span>
            <span className="font-mono text-xs text-text-secondary uppercase tracking-widest">
              {currentNav?.label || 'Console'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Reset button */}
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-text-secondary
                bg-bg-surface hover:text-semantic-crit hover:bg-semantic-crit-fill hover:border-semantic-crit
                transition-colors border border-border px-2.5 py-1.5 rounded-[2px]"
              title="Reset prediction history and dashboard stats (models are unaffected)"
            >
              <Trash2 className="w-3 h-3" />
              Reset Stats
            </button>

            {/* Status indicator */}
            {health && (
              <div className="flex items-center gap-2 px-2.5 py-1 border border-border bg-bg-surface rounded-[2px]">
                <div className={clsx(
                  "w-1.5 h-1.5",
                  isOnline ? "bg-semantic-normal" : "bg-semantic-crit"
                )} />
                <span className="font-mono text-[11px] text-text-muted tabular-nums">
                  {isOnline ? `v${health.version}` : 'offline'}
                </span>
              </div>
            )}
            {!isOnline && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 border border-semantic-warn-border bg-semantic-warn-fill text-semantic-warn rounded-[2px]">
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="font-mono text-[11px] uppercase tracking-wider">Offline mode</span>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-bg-base">
          <div className="min-h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="p-6"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  )
}
