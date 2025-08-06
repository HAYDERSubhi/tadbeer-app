
import { cn } from '@/lib/utils';
import React from 'react';

const Logo = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className={cn('h-8 w-8', className)}
    {...props}
  >
    <rect width="24" height="24" rx="6" fill="hsl(var(--primary))" />
    <g transform="translate(4, 4) scale(0.66)">
        <path d="M12 2L12 22" stroke="hsl(var(--primary-foreground))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 2C8.68629 2 6 4.68629 6 8C6 11.3137 8.68629 14 12 14" stroke="hsl(var(--primary-foreground))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 2C15.3137 2 18 4.68629 18 8C18 11.3137 15.3137 14 12 14" stroke="hsl(var(--primary-foreground))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 8H16" stroke="hsl(var(--primary-foreground))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 11H17" stroke="hsl(var(--primary-foreground))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
);

export default Logo;
