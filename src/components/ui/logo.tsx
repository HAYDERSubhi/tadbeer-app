
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
    <g transform="translate(12, 14) scale(1.1)">
      <path
        d="M23.6,28.8c-2.3-0.7-4.5,0.6-5.2,2.8L18,33c-0.7,2.3,0.6,4.5,2.8,5.2l0,0c2.3,0.7,4.5-0.6,5.2-2.8l0.4-1.4
	C26.7,32,25.8,29.5,23.6,28.8z M12.4,28.8c-2.3-0.7-4.5,0.6-5.2,2.8l-0.4,1.4c-0.7,2.3,0.6,4.5,2.8,5.2l0,0c2.3,0.7,4.5-0.6,5.2-2.8
	l0.4-1.4C15.5,32,14.6,29.5,12.4,28.8z M18,22.6c-2.3-0.7-4.5,0.6-5.2,2.8l-0.4,1.4c-0.7,2.3,0.6,4.5,2.8,5.2l0,0
	c2.3,0.7,4.5-0.6,5.2-2.8l0.4-1.4C21.1,25.5,20.2,23,18,22.6z M26.9,13.6c0.5-2.2-0.9-4.4-3.1-4.9l0,0c-2.2-0.5-4.4,0.9-4.9,3.1
	c-0.5,2.2,0.9,4.4,3.1,4.9l0,0C24.2,17.2,26.4,15.8,26.9,13.6z M9.1,13.6c0.5-2.2-0.9-4.4-3.1-4.9l0,0C3.8,8.2,1.6,9.6,1.1,11.8
	c-0.5,2.2,0.9,4.4,3.1,4.9l0,0C6.4,17.2,8.6,15.8,9.1,13.6z M18,6.4c0.5-2.2-0.9-4.4-3.1-4.9l0,0c-2.2-0.5-4.4,0.9-4.9,3.1
	c-0.5,2.2,0.9,4.4,3.1,4.9l0,0C15.2,10,17.4,8.6,18,6.4z"
        fill="hsl(var(--primary-foreground))"
      />
      <path
        d="M18,38V18"
        stroke="hsl(var(--primary-foreground))"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M29,38V20"
        stroke="hsl(var(--primary-foreground))"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7,38V20"
        stroke="hsl(var(--primary-foreground))"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  </svg>
);

export default Logo;
