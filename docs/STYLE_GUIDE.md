# Esus Audit AI - Style Guide

## 🎨 Utility-First Styling with Tailwind CSS

This project uses **Tailwind CSS utility classes** for all styling. This ensures consistency, maintainability, and optimal performance.

## 📋 Core Principles

1. **Utility-First**: Use Tailwind utility classes instead of custom CSS
2. **Component Classes**: Only for reusable patterns (defined in `index.css`)
3. **Consistent Colors**: Use the custom color palette
4. **Responsive Design**: Mobile-first approach with responsive utilities
5. **Accessibility**: Include focus states and ARIA attributes

## 🎨 Color Palette

### Primary Colors
```css
primary-50   #eff6ff    /* Very light blue */
primary-100  #dbeafe    /* Light blue */
primary-500  #3b82f6    /* Main blue */
primary-600  #2563eb    /* Dark blue */
primary-700  #1d4ed8    /* Darker blue */
```

### Semantic Colors
```css
success-50   #f0fdf4    /* Light green backgrounds */
success-500  #22c55e    /* Success states */
success-600  #16a34a    /* Success buttons */

warning-50   #fffbeb    /* Light yellow backgrounds */
warning-500  #f59e0b    /* Warning states */
warning-600  #d97706    /* Warning buttons */

danger-50    #fef2f2    /* Light red backgrounds */
danger-500   #ef4444    /* Error states */
danger-600   #dc2626    /* Error buttons */
```

## 🧩 Component Classes

### Buttons
```jsx
// Primary button
<button className="btn-primary">Save</button>

// Secondary button
<button className="btn-secondary">Cancel</button>

// Outline button
<button className="btn-outline">Edit</button>

// Custom button with utilities
<button className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus-ring">
  Custom Button
</button>
```

### Cards
```jsx
// Basic card
<div className="card">
  <div className="card-header">
    <h3>Title</h3>
  </div>
  <div className="card-body">
    Content
  </div>
</div>

// Interactive card
<div className="card interactive-hover">
  <div className="card-body">
    Hoverable content
  </div>
</div>
```

### Form Elements
```jsx
// Input field
<input className="input" type="text" />

// Error input
<input className="input-error" type="text" />

// Custom input with utilities
<input className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500" />
```

### Badges
```jsx
// Status badges
<span className="badge-success">Active</span>
<span className="badge-warning">Pending</span>
<span className="badge-danger">Error</span>
<span className="badge-primary">Info</span>
```

## 📱 Responsive Design Patterns

### Layout
```jsx
// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Items */}
</div>

// Responsive container
<div className="container-responsive">
  <div className="section-spacing">
    Content
  </div>
</div>

// Responsive text
<h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">
  Responsive Heading
</h1>
```

### Spacing
```jsx
// Responsive padding
<div className="p-4 sm:p-6 lg:p-8">Content</div>

// Responsive margins
<div className="mt-4 sm:mt-6 lg:mt-8">Content</div>

// Section spacing
<section className="section-spacing">Content</section>
```

## 🎭 State Patterns

### Loading States
```jsx
// Loading spinner
<div className="flex items-center justify-center p-8">
  <LoadingSpinner size="lg" />
  <span className="ml-3 text-gray-600">Loading...</span>
</div>

// Skeleton loading
<div className="animate-pulse">
  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
</div>
```

### Error States
```jsx
// Error message
<div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
  <div className="flex items-center">
    <ExclamationTriangleIcon className="h-5 w-5 text-danger-500 mr-2" />
    <p className="text-sm text-danger-800">Error message</p>
  </div>
</div>

// Success message
<div className="bg-success-50 border border-success-200 rounded-lg p-4">
  <div className="flex items-center">
    <CheckCircleIcon className="h-5 w-5 text-success-500 mr-2" />
    <p className="text-sm text-success-800">Success message</p>
  </div>
</div>
```

### Interactive States
```jsx
// Hover effects
<button className="bg-primary-600 hover:bg-primary-700 transition-colors duration-200">
  Hover me
</button>

// Focus states
<input className="focus-ring border border-gray-300 rounded-md" />

// Active states
<button className="bg-primary-600 active:bg-primary-800 transform active:scale-95">
  Click me
</button>
```

## 🎨 Animation Patterns

### Entrance Animations
```jsx
// Fade in
<div className="animate-fade-in">Content</div>

// Slide up
<div className="animate-slide-up">Content</div>

// Custom transition
<div className="transition-all duration-300 ease-in-out">Content</div>
```

### Micro-interactions
```jsx
// Button hover
<button className="transform hover:scale-105 transition-transform duration-200">
  Scale on hover
</button>

// Card hover
<div className="interactive-hover">
  Card with hover effect
</div>
```

## 🔧 Custom Utilities

### Layout Utilities
- `container-responsive`: Responsive container with proper padding
- `section-spacing`: Consistent section spacing
- `interactive-hover`: Standard hover effect for interactive elements

### Focus Utilities
- `focus-ring`: Standard focus ring styling

### Animation Utilities
- `animate-fade-in`: Fade in animation
- `animate-slide-up`: Slide up animation
- `animate-pulse-slow`: Slow pulse animation

## ❌ What NOT to Do

### Avoid Custom CSS
```jsx
// ❌ Don't do this
<div style={{ backgroundColor: '#3b82f6', padding: '16px' }}>
  Content
</div>

// ✅ Do this instead
<div className="bg-primary-500 p-4">
  Content
</div>
```

### Avoid Inline Styles
```jsx
// ❌ Don't do this
<div style={{ display: 'flex', alignItems: 'center' }}>
  Content
</div>

// ✅ Do this instead
<div className="flex items-center">
  Content
</div>
```

### Avoid Hardcoded Colors
```jsx
// ❌ Don't do this
<div className="bg-red-500 text-red-800">
  Error message
</div>

// ✅ Do this instead
<div className="bg-danger-500 text-danger-800">
  Error message
</div>
```

## 🎯 Best Practices

1. **Use semantic color names** (`danger-500` instead of `red-500`)
2. **Group related utilities** (layout, colors, typography)
3. **Use responsive prefixes** (`sm:`, `md:`, `lg:`)
4. **Include focus states** for accessibility
5. **Use component classes** for repeated patterns
6. **Test on different screen sizes**
7. **Maintain consistent spacing** using the spacing scale

## 📚 Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Tailwind CSS Color Palette](https://tailwindcss.com/docs/customizing-colors)
- [Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [Dark Mode](https://tailwindcss.com/docs/dark-mode)

---

**Remember**: Consistency is key! Always use the established patterns and utility classes for a cohesive user experience.
