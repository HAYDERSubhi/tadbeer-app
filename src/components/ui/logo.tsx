
import { cn } from '@/lib/utils';
import React from 'react';
import Image from 'next/image';

const Logo = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('relative h-9 w-9', className)}
    {...props}
  >
    <Image 
        src="/logo.png" 
        alt="شعار تطبيق تدبير" 
        width={36}
        height={36}
        priority 
    />
  </div>
);

export default Logo;
