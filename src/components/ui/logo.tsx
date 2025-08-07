
import { cn } from '@/lib/utils';
import React from 'react';
import Image from 'next/image';

const Logo = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('relative h-9 w-9', className)}
    {...props}
  >
    <Image 
        src="/logo-main.png" 
        alt="شعار تطبيق تدبير" 
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        priority // The logo is important, so we prioritize its loading
    />
  </div>
);

export default Logo;
