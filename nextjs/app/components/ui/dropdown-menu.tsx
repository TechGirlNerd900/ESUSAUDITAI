import * as React from 'react'
import { cn } from '@/lib/utils'

// Context for managing dropdown state
interface DropdownMenuContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | undefined>(undefined)

const useDropdownMenuContext = () => {
  const context = React.useContext(DropdownMenuContext)
  if (!context) {
    throw new Error('DropdownMenu components must be used within a DropdownMenu provider')
  }
  return context
}

// Root DropdownMenu component
export interface DropdownMenuProps {
  children: React.ReactNode
}

const DropdownMenu = ({ children }: DropdownMenuProps) => {
  const [open, setOpen] = React.useState(false)

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block text-left">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  )
}

// DropdownMenu Trigger component
export interface DropdownMenuTriggerProps {
  asChild?: boolean
  children: React.ReactNode
  className?: string
}

const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  ({ asChild = false, children, className, ...props }, ref) => {
    const { open, setOpen } = useDropdownMenuContext()

    if (asChild) {
      return React.cloneElement(children as React.ReactElement, {
        onClick: () => setOpen(!open),
        'aria-expanded': open,
        'aria-haspopup': true,
        ref
      })
    }

    return (
      <button
        ref={ref}
        type="button"
        className={cn('inline-flex items-center', className)}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup={true}
        {...props}
      >
        {children}
      </button>
    )
  }
)
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger'

// DropdownMenu Content component
export interface DropdownMenuContentProps {
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
}

const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ children, align = 'center', className, ...props }, ref) => {
    const { open, setOpen } = useDropdownMenuContext()
    const contentRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
          setOpen(false)
        }
      }

      if (open) {
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
      }
    }, [open, setOpen])

    if (!open) return null

    const alignmentClasses = {
      start: 'left-0',
      center: 'left-1/2 transform -translate-x-1/2',
      end: 'right-0'
    }

    return (
      <div
        ref={contentRef}
        className={cn(
          'absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-white p-1 text-gray-950 shadow-md animate-in fade-in-0 zoom-in-95',
          'top-full mt-1',
          alignmentClasses[align],
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
DropdownMenuContent.displayName = 'DropdownMenuContent'

// DropdownMenu Item component
export interface DropdownMenuItemProps {
  children: React.ReactNode
  className?: string
  disabled?: boolean
  onClick?: () => void
}

const DropdownMenuItem = React.forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  ({ children, className, disabled = false, onClick, ...props }, ref) => {
    const { setOpen } = useDropdownMenuContext()

    const handleClick = () => {
      if (!disabled && onClick) {
        onClick()
        setOpen(false)
      }
    }

    return (
      <div
        ref={ref}
        className={cn(
          'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
          disabled
            ? 'pointer-events-none opacity-50'
            : 'hover:bg-gray-100 hover:text-gray-900 focus:bg-gray-100 focus:text-gray-900',
          className
        )}
        onClick={handleClick}
        {...props}
      >
        {children}
      </div>
    )
  }
)
DropdownMenuItem.displayName = 'DropdownMenuItem'

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
}