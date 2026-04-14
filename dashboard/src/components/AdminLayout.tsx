import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Film, ListChecks, Settings, Tv, UploadCloud, Waypoints } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { getApiKey } from '../lib/storage'
import type { LucideIcon } from 'lucide-react'

type NavItem = {
  to: string
  label: string
  description: string
  icon: LucideIcon
  title: string
}

const navItems: NavItem[] = [
  {
    to: '/imports',
    label: 'Imports',
    description: 'Launch ingestion jobs',
    icon: UploadCloud,
    title: 'Imports',
  },
  {
    to: '/jobs',
    label: 'Jobs',
    description: 'Monitor queue and failures',
    icon: ListChecks,
    title: 'Jobs',
  },
  {
    to: '/movies',
    label: 'Movies',
    description: 'Maintain movie metadata',
    icon: Film,
    title: 'Movies',
  },
  {
    to: '/shows',
    label: 'Shows',
    description: 'Maintain show metadata',
    icon: Tv,
    title: 'Shows',
  },
  {
    to: '/updates',
    label: 'Updates',
    description: 'Bridge Threads to Bluesky',
    icon: Waypoints,
    title: 'Updates',
  },
  {
    to: '/settings',
    label: 'Settings',
    description: 'Credentials and defaults',
    icon: Settings,
    title: 'Settings',
  },
]

const findCurrentNavItem = (pathname: string) => {
  if (pathname.startsWith('/jobs/')) {
    return navItems[1]
  }

  return navItems.find(item => pathname === item.to || pathname.startsWith(`${item.to}/`)) ?? navItems[0]
}

export const AdminLayout = () => {
  const location = useLocation()
  const [hasApiKey, setHasApiKey] = useState(() => Boolean(getApiKey()))

  useEffect(() => {
    setHasApiKey(Boolean(getApiKey()))
  }, [location.pathname])

  const currentNavItem = useMemo(() => findCurrentNavItem(location.pathname), [location.pathname])

  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Film className="h-4 w-4" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="text-sm font-semibold">JobsAPI</div>
              <div className="text-xs text-muted-foreground">Media Ops</div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workstations</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map(item => {
                  const isActive =
                    item.to === '/jobs'
                      ? location.pathname === '/jobs' || location.pathname.startsWith('/jobs/')
                      : location.pathname === item.to

                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                        <NavLink to={item.to}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-4">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            <div
              className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                hasApiKey ? 'bg-success' : 'bg-warning',
              )}
            />
            <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              {hasApiKey ? 'API key loaded' : 'API key missing'}
            </span>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="flex-1 text-base font-semibold tracking-tight">{currentNavItem.title}</h1>
          <Badge variant="secondary" className="hidden font-mono text-[10px] md:inline-flex">
            jobsapi.ashish.me
          </Badge>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
