import * as React from 'react';

type ToastProps = {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
};

type ToastActionElement = React.ReactElement;

type ToastContextValue = {
  toast: (props: ToastProps) => void;
};

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);

  const toast = React.useCallback((props: ToastProps) => {
    setToasts((prevToasts) => [...prevToasts, props]);

    // For simplicity, we'll just log the toast to the console
    console.log('Toast:', props);

    // Remove toast after 5 seconds
    setTimeout(() => {
      setToasts((prevToasts) => prevToasts.filter((t) => t !== props));
    }, 5000);
  }, []);

  return <ToastContext.Provider value={{ toast }}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = React.useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
}

export const toast = (props: ToastProps) => {
  // This is a simplified version that just logs to console
  // In a real implementation, this would use a proper toast system
  console.log('Toast:', props);
};
