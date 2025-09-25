'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  FolderOpen, 
  FileText, 
  BarChart3, 
  Settings,
  Users,
  LogOut,
  ChevronLeft,
  Menu,
  Home
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import LogoutButton from './LogoutButton'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Projects', href: '/projects', icon: FolderOpen },
  { name: 'Documents', href: '/documents', icon: FileText },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Admin', href: '/admin', icon: Users, adminOnly: true },
]

interface SidebarProps {
  className?: string
}

export default function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const authenticatedFetch = useAuthenticatedFetch()

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await authenticatedFetch('/api/auth/profile')
        if (response.ok) {
          const data = await response.json()
          setUserRole(data.user.role)
          setUserName(`${data.user.firstName} ${data.user.lastName}`)
        }
      } catch (error) {
        console.error('Failed to fetch user info:', error)
      }
    }
    
    fetchUserInfo()
  }, [])

  const filteredNavigation = navigation.filter(item => 
    !item.adminOnly || userRole === 'admin'
  )

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo/Brand */}
      <div className="flex h-16 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">EA</span>
          </div>
          {!collapsed && (
            <span className="font-semibold text-lg">EsusAuditAI</span>
          )}
        </Link>
        {!collapsed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(true)}
            className="ml-auto lg:hidden"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {filteredNavigation.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center rounded-md px-2 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              )}
              onClick={() => setMobileOpen(false)}
            >
              <item.icon
                className={cn(
                  'mr-3 h-5 w-5 flex-shrink-0',
                  isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                )}
              />
              {!collapsed && item.name}
            </Link>
          )
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="border-t p-4">
        {!collapsed && (
          <div className="mb-3">
            <p className="text-sm font-medium text-gray-900">{userName}</p>
            <p className="text-xs text-gray-500 capitalize">{userRole}</p>
          </div>
        )}
        <LogoutButton className="w-full justify-start" variant="ghost">
          <LogOut className="mr-3 h-4 w-4" />
          {!collapsed && 'Sign Out'}
        </LogoutButton>
      </div>

      {/* Collapse Toggle (Desktop) */}
      {!collapsed && (
        <div className="hidden lg:block border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(true)}
            className="w-full justify-start"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Collapse
          </Button>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div 
            className="fixed inset-0 bg-black bg-opacity-50" 
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className={cn(
        'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:border-r lg:border-gray-200 lg:bg-white',
        collapsed ? 'lg:w-16' : 'lg:w-64',
        className
      )}>
        {sidebarContent}
        
        {/* Expand button when collapsed */}
        {collapsed && (
          <div className="absolute bottom-4 left-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(false)}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
