import React from 'react'
import clsx from 'clsx'

interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  variant?: 'default' | 'primary' | 'white'
  text?: string
}

export default function LoadingSpinner({ 
  size = 'md', 
  className = '', 
  variant = 'default',
  text = '' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  }

  const variantClasses = {
    default: 'border-blue-500',
    primary: 'border-indigo-600',
    white: 'border-white'
  }

  return (
    <div className={clsx('flex justify-center items-center', className)}>
      <div className={clsx(
        'animate-spin rounded-full border-t-2 border-b-2',
        sizeClasses[size],
        variantClasses[variant]
      )}></div>
      {text && (
        <span className="ml-3 text-gray-600 text-sm">{text}</span>
      )}
    </div>
  )
}