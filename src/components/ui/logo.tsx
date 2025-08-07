
import { cn } from '@/lib/utils';
import React from 'react';

const Logo = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 64 64"
    className={cn('h-8 w-8', className)}
    {...props}
  >
    <defs>
      <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: 'hsl(var(--primary-start))' }} />
        <stop offset="100%" style={{ stopColor: 'hsl(var(--primary-end))' }} />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="12" fill="url(#logoGradient)" />
    <g transform="translate(12, 12) scale(1.2)" fill="hsl(var(--primary-foreground))">
      {/* Central Palm */}
      <path d="M20,10 C21.1046,10 22,10.8954 22,12 L22,32 L18,32 L18,12 C18,10.8954 18.8954,10 20,10 Z" />
      <path d="M20,12 C25.5228,12 30,7.52285 30,2 C30,2.92758 29.691,3.79153 29.1339,4.46835 C28.4,2.89543 26.545,2 24.5,2 C21.4624,2 19,4.68629 19,8 C19,5.79086 17.2091,4 15,4 C12.7909,4 11,5.79086 11,8 C11,4.68629 8.53757,2 5.5,2 C3.45499,2 1.60003,2.89543 0.866116,4.46835 C0.309029,3.79153 0,2.92758 0,2 C0,7.52285 4.47715,12 10,12" transform="translate(5, 0)" />
      
      {/* Left Palm */}
      <g transform="translate(-8, 5) scale(0.8)">
        <path d="M20,10 C21.1046,10 22,10.8954 22,12 L22,32 L18,32 L18,12 C18,10.8954 18.8954,10 20,10 Z" />
        <path d="M20,12 C25.5228,12 30,7.52285 30,2 C30,2.92758 29.691,3.79153 29.1339,4.46835 C28.4,2.89543 26.545,2 24.5,2 C21.4624,2 19,4.68629 19,8 C19,5.79086 17.2091,4 15,4 C12.7909,4 11,5.79086 11,8 C11,4.68629 8.53757,2 5.5,2 C3.45499,2 1.60003,2.89543 0.866116,4.46835 C0.309029,3.79153 0,2.92758 0,2 C0,7.52285 4.47715,12 10,12" transform="translate(5, 0)" />
      </g>
      
      {/* Right Palm */}
      <g transform="translate(18, 5) scale(0.8)">
        <path d="M20,10 C21.1046,10 22,10.8954 22,12 L22,32 L18,32 L18,12 C18,10.8954 18.8954,10 20,10 Z" />
        <path d="M20,12 C25.5228,12 30,7.52285 30,2 C30,2.92758 29.691,3.79153 29.1339,4.46835 C28.4,2.89543 26.545,2 24.5,2 C21.4624,2 19,4.68629 19,8 C19,5.79086 17.2091,4 15,4 C12.7909,4 11,5.79086 11,8 C11,4.68629 8.53757,2 5.5,2 C3.45499,2 1.60003,2.89543 0.866116,4.46835 C0.309029,3.79153 0,2.92758 0,2 C0,7.52285 4.47715,12 10,12" transform="translate(5, 0)" />
      </g>
    </g>
  </svg>
);

export default Logo;
