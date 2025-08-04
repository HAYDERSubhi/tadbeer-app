
// src/components/layout/app-logo.tsx
import React from 'react';

export const AppLogo = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 2L12 22" />
        <path d="M12 2C8.68629 2 6 4.68629 6 8C6 11.3137 8.68629 14 12 14" />
        <path d="M12 2C15.3137 2 18 4.68629 18 8C18 11.3137 15.3137 14 12 14" />
        <path d="M8 8H16" />
        <path d="M7 11H17" />
    </svg>
);
