
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
    <g transform="translate(12, 12) scale(1.1)" fill="hsl(var(--primary-foreground))">
        {/* Central Palm Tree */}
        <path d="M19.5 15C19.5 14.1716 20.1716 13.5 21 13.5H23C23.8284 13.5 24.5 14.1716 24.5 15V38H19.5V15Z" />
        <path d="M22 14C22 11.2386 24.2386 9 27 9C29.7614 9 32 11.2386 32 14C32 15.492 31.155 16.8213 30 17.5V14C30 12.3431 28.6569 11 27 11C25.3431 11 24 12.3431 24 14H22Z" />
        <path d="M22 14C22 11.2386 19.7614 9 17 9C14.2386 9 12 11.2386 12 14C12 15.492 12.845 16.8213 14 17.5V14C14 12.3431 15.3431 11 17 11C18.6569 11 20 12.3431 20 14H22Z" />

        {/* Left Palm Tree */}
        <path d="M7.5 22C7.5 21.1716 8.17157 20.5 9 20.5H11C11.8284 20.5 12.5 21.1716 12.5 22V38H7.5V22Z" />
        <path d="M10 21C10 18.2386 12.2386 16 15 16C17.7614 16 20 18.2386 20 21C20 22.492 19.155 23.8213 18 24.5V21C18 19.3431 16.6569 18 15 18C13.3431 18 12 19.3431 12 21H10Z" />

        {/* Right Palm Tree */}
        <path d="M31.5 22C31.5 21.1716 32.1716 20.5 33 20.5H35C35.8284 20.5 36.5 21.1716 36.5 22V38H31.5V22Z" />
        <path d="M34 21C34 18.2386 36.2386 16 39 16C41.7614 16 44 18.2386 44 21C44 22.492 43.155 23.8213 42 24.5V21C42 19.3431 40.6569 18 39 18C37.3431 18 36 19.3431 36 21H34Z" />
    </g>
  </svg>
);

export default Logo;
