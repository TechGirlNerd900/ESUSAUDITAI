import * as React from 'react';
import { cn } from '@/lib/utils';

// Context for managing popover state
interface PopoverContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

const PopoverContext = React.createContext<PopoverContextValue | undefined>(undefined);

const usePopoverContext = () => {
  const context = React.useContext(PopoverContext);
  if (!context) {
    throw new Error('Popover components must be used within a Popover provider');
  }
  return context;
};

// Root Popover component
export interface PopoverProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}

const Popover: React.FC<PopoverProps> = ({ children, open, onOpenChange, defaultOpen = false }) => {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const triggerRef = React.useRef<HTMLElement>(null);

  const currentOpen = open !== undefined ? open : internalOpen;
  const handleOpenChange = onOpenChange || setInternalOpen;

  // Close on escape key
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && currentOpen) {
        handleOpenChange(false);
      }
    };

    if (currentOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [currentOpen, handleOpenChange]);

  // Close on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (currentOpen && triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        const popoverContent = document.querySelector('[data-popover-content]');
        if (popoverContent && !popoverContent.contains(event.target as Node)) {
          handleOpenChange(false);
        }
      }
    };

    if (currentOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [currentOpen, handleOpenChange]);

  return (
    <PopoverContext.Provider
      value={{
        open: currentOpen,
        onOpenChange: handleOpenChange,
        triggerRef,
      }}
    >
      {children}
    </PopoverContext.Provider>
  );
};

// Popover Trigger component
export interface PopoverTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
  className?: string;
}

const PopoverTrigger = React.forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  ({ className, children, asChild = false, ...props }, ref) => {
    const { open, onOpenChange, triggerRef } = usePopoverContext();

    const handleClick = () => {
      onOpenChange(!open);
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        handleClick();
      }
    };

    // If asChild, clone the child element with event handlers
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        ref: (node: HTMLElement | null) => {
          // Handle both callback refs and object refs
          if (typeof ref === 'function') ref(node as HTMLButtonElement);
          else if (ref) ref.current = node as HTMLButtonElement;

          triggerRef.current = node;

          // Preserve original ref if it exists
          const originalRef = (children as any).ref;
          if (typeof originalRef === 'function') originalRef(node);
          else if (originalRef) originalRef.current = node;
        },
        onClick: (event: React.MouseEvent) => {
          handleClick();
          // Preserve original onClick if it exists
          const originalOnClick = (children as any).props?.onClick;
          if (originalOnClick) originalOnClick(event);
        },
        onKeyDown: (event: React.KeyboardEvent) => {
          handleKeyDown(event);
          // Preserve original onKeyDown if it exists
          const originalOnKeyDown = (children as any).props?.onKeyDown;
          if (originalOnKeyDown) originalOnKeyDown(event);
        },
        'aria-expanded': open,
        'aria-haspopup': 'dialog',
      });
    }

    return (
      <button
        ref={(node) => {
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
          triggerRef.current = node;
        }}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(className)}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {children}
      </button>
    );
  }
);
PopoverTrigger.displayName = 'PopoverTrigger';

// Popover Content component
export interface PopoverContentProps {
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom' | 'left' | 'right';
  sideOffset?: number;
  alignOffset?: number;
}

const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  (
    {
      className,
      children,
      align = 'center',
      side = 'bottom',
      sideOffset = 4,
      alignOffset = 0,
      ...props
    },
    ref
  ) => {
    const { open, triggerRef } = usePopoverContext();
    const [position, setPosition] = React.useState({ top: 0, left: 0 });

    // Calculate position relative to trigger
    React.useLayoutEffect(() => {
      if (open && triggerRef.current) {
        const triggerRect = triggerRef.current.getBoundingClientRect();

        let top = 0;
        let left = 0;

        // Calculate base position based on side
        switch (side) {
          case 'top':
            top = triggerRect.top - sideOffset;
            break;
          case 'bottom':
            top = triggerRect.bottom + sideOffset;
            break;
          case 'left':
            left = triggerRect.left - sideOffset;
            break;
          case 'right':
            left = triggerRect.right + sideOffset;
            break;
        }

        // Calculate alignment
        if (side === 'top' || side === 'bottom') {
          switch (align) {
            case 'start':
              left = triggerRect.left + alignOffset;
              break;
            case 'center':
              left = triggerRect.left + triggerRect.width / 2 + alignOffset;
              break;
            case 'end':
              left = triggerRect.right + alignOffset;
              break;
          }
        } else {
          switch (align) {
            case 'start':
              top = triggerRect.top + alignOffset;
              break;
            case 'center':
              top = triggerRect.top + triggerRect.height / 2 + alignOffset;
              break;
            case 'end':
              top = triggerRect.bottom + alignOffset;
              break;
          }
        }

        setPosition({ top, left });
      }
    }, [open, side, align, sideOffset, alignOffset, triggerRef]);

    if (!open) {
      return null;
    }

    return (
      <div
        ref={ref}
        data-popover-content
        role="dialog"
        aria-modal="true"
        className={cn(
          'absolute z-50 w-72 rounded-md border border-gray-200 bg-white p-4 text-gray-950 shadow-md outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50',
          className
        )}
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          transform:
            align === 'center'
              ? side === 'top' || side === 'bottom'
                ? 'translateX(-50%)'
                : 'translateY(-50%)'
              : align === 'end'
                ? side === 'top' || side === 'bottom'
                  ? 'translateX(-100%)'
                  : 'translateY(-100%)'
                : undefined,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
PopoverContent.displayName = 'PopoverContent';

export { Popover, PopoverTrigger, PopoverContent };
