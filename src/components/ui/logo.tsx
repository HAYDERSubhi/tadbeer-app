
import { cn } from '@/lib/utils';
import React from 'react';

const Logo = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    className={cn('h-9 w-9', className)}
    {...props}
  >
    <defs>
      <linearGradient id="logoBgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0F5B6F" />
        <stop offset="100%" stopColor="#20A4B4" />
      </linearGradient>
    </defs>
    
    {/* Background */}
    <rect width="100" height="100" rx="22" fill="url(#logoBgGradient)" />

    {/* Emblem Shape */}
    <g transform="translate(12, 12) scale(0.76)">
      <path 
        d="M75.5,38.5C75.5,58.6,59.1,75,39,75S2.5,58.6,2.5,38.5C2.5,18.4,18.9,2,39,2S75.5,18.4,75.5,38.5Z" 
        transform="translate(-2.5, -2)"
        fill="#E0E0E0" 
        stroke="#FFFFFF" 
        strokeWidth="3"
      />
      <path 
        d="M71.2,38.5c0,17.2-13.8,31.2-31,31.2S9.3,55.7,9.3,38.5c0-17.2,13.8-31.2,31-31.2S71.2,21.3,71.2,38.5Z"
        transform="translate(-2.5, -2)"
        fill="#BDBDBD" 
      />

      {/* Palm Trees */}
      <g fill="#FFFFFF">
        {/* Center Palm */}
        <path d="M43,30 v25 a4,4 0 0 1 -8,0 V30 a4,4 0 0 1 8,0 Z" />
        <path d="M39,32 C50,32 52,20 52,20 L39,28 L26,20 C26,20 28,32 39,32Z" />
        <circle cx="39" cy="33" r="2.5" />

        {/* Left Palm */}
        <path d="M28,40 v12 a3,3 0 0 1 -6,0 V40 a3,3 0 0 1 6,0 Z" />
        <path d="M25,42 C33,42 35,32 35,32 L25,38 L15,32 C15,32 17,42 25,42Z" />

        {/* Right Palm */}
        <path d="M56,40 v12 a3,3 0 0 1 -6,0 V40 a3,3 0 0 1 6,0 Z" />
        <path d="M53,42 C61,42 63,32 63,32 L53,38 L43,32 C43,32 45,42 53,42Z" />
      </g>
      
      {/* Ground and Shadows */}
      <path d="M10,55 Q39,50 68,55 V70 H10Z" fill="#E0E0E0" />
      <path d="M36,55 L32,65 L46,65 L42,55 Z" fill="#9E9E9E" />
    </g>
  </svg>
);

export default Logo;
