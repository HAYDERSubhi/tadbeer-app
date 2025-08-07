
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
    <g transform="translate(12, 10) scale(1.25)" fill="hsl(var(--primary-foreground))">
        {/* Central Palm Tree */}
        <path d="M22,12 C22,11.4477 21.5523,11 21,11 L19,11 C18.4477,11 18,11.4477 18,12 L18,30 L22,30 L22,12 Z" />
        <path d="M20,11 C24.4183,11 28,7.41828 28,3 C28,4.492 27.155,5.8213 26,6.5 L26,3 C26,1.34315 24.6569,0 23,0 C21.3431,0 20,1.34315 20,3 L20,11 Z" />
        <path d="M20,11 C15.5817,11 12,7.41828 12,3 C12,4.492 12.845,5.8213 14,6.5 L14,3 C14,1.34315 15.3431,0 17,0 C18.6569,0 20,1.34315 20,3 L20,11 Z" />
        
        {/* Left Palm Tree */}
        <path d="M11,19 C11,18.4477 10.5523,18 10,18 L8,18 C7.44772,18 7,18.4477 7,19 L7,32 L11,32 L11,19 Z" />
        <path d="M9,18 C13.4183,18 17,14.4183 17,10 C17,11.492 16.155,12.8213 15,13.5 L15,10 C15,8.34315 13.6569,7 12,7 C10.3431,7 9,8.34315 9,10 L9,18 Z" />
        
        {/* Right Palm Tree */}
        <path d="M33,19 C33,18.4477 32.5523,18 32,18 L30,18 C29.4477,18 29,18.4477 29,19 L29,32 L33,32 L33,19 Z" />
        <path d="M31,18 C35.4183,18 39,14.4183 39,10 C39,11.492 38.155,12.8213 37,13.5 L37,10 C37,8.34315 35.6569,7 34,7 C32.3431,7 31,8.34315 31,10 L31,18 Z" />
    </g>
  </svg>
);

export default Logo;
