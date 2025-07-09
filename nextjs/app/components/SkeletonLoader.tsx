import React from 'react';

interface SkeletonLoaderProps {
  /**
   * Number of lines/rows to display in the skeleton.
   * @default 1
   */
  lines?: number;
  /**
   * Height of each skeleton line in Tailwind CSS spacing units (e.g., 'h-4', 'h-6').
   * @default 'h-4'
   */
  lineHeight?: string;
  /**
   * Width of the skeleton loader. Can be a Tailwind CSS width class (e.g., 'w-full', 'w-3/4')
   * or a specific pixel value.
   * @default 'w-full'
   */
  width?: string;
  /**
   * Additional Tailwind CSS classes to apply to the container.
   */
  className?: string;
  /**
   * Specifies if the skeleton should be circular. Overrides line-based styling.
   * @default false
   */
  isCircle?: boolean;
  /**
   * Size of the circular skeleton in Tailwind CSS spacing units (e.g., 'w-12 h-12').
   * Only applicable when `isCircle` is true.
   * @default 'w-12 h-12'
   */
  circleSize?: string;
}

/**
 * A versatile Skeleton Loader component for displaying loading states.
 * It provides a visual placeholder for content that is still loading,
 * improving perceived performance and user experience.
 *
 * Features:
 * - Customizable number of lines for text placeholders.
 * - Adjustable line height and overall width.
 * - Option for circular placeholders (e.g., for avatars).
 * - Shimmer effect for a modern loading indication.
 *
 * Usage Examples:
 * - Basic text skeleton: `<SkeletonLoader />`
 * - Multi-line text: `<SkeletonLoader lines={3} />`
 * - Custom width and height: `<SkeletonLoader width="w-3/4" lineHeight="h-6" />`
 * - Circular loader: `<SkeletonLoader isCircle circleSize="w-16 h-16" />`
 * - Combined with other components:
 *   ```jsx
 *   {isLoading ? (
 *     <div className="space-y-2">
 *       <SkeletonLoader width="w-1/2" />
 *       <SkeletonLoader lines={2} />
 *     </div>
 *   ) : (
 *     <p>Your loaded content here.</p>
 *   )}
 *   ```
 */
const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  lines = 1,
  lineHeight = 'h-4',
  width = 'w-full',
  className = '',
  isCircle = false,
  circleSize = 'w-12 h-12',
}) => {
  const baseClasses = 'bg-gray-200 animate-pulse rounded';
  const shimmerEffect =
    'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/50 before:to-transparent';

  if (isCircle) {
    return (
      <div
        className={`${baseClasses} ${circleSize} ${className} ${shimmerEffect} rounded-full`}
        role="status"
        aria-label="Loading content"
      ></div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`} role="status" aria-label="Loading content">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={`${baseClasses} ${lineHeight} ${width} ${shimmerEffect}`}
          style={index === lines - 1 ? { width: '80%' } : {}} // Last line often shorter
        ></div>
      ))}
      {/* Shimmer animation is handled via Tailwind CSS classes */}
    </div>
  );
};

export default SkeletonLoader;
