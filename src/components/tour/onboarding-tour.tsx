
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourStep {
  selector: string;
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface OnboardingTourProps {
  steps: TourStep[];
  tourKey: string;
}

const TooltipArrow = ({ placement }: { placement: TourStep['placement'] }) => {
    const baseClasses = "absolute w-3 h-3 bg-popover border-border transform rotate-45";
    const placementClasses = {
        top: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 border-r border-b',
        bottom: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border-l border-t',
        left: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2 border-t border-r',
        right: 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 border-b border-l',
        center: 'hidden',
    };
    const currentPlacement = placement || 'bottom';
    return <div className={cn(baseClasses, placementClasses[currentPlacement])} />;
};

export default function OnboardingTour({ steps, tourKey }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [currentPlacement, setCurrentPlacement] = useState<TourStep['placement']>('bottom');

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (!isClient) return;

    const hasCompletedTour = localStorage.getItem(tourKey);
    if (hasCompletedTour) return; // Already seen — never show again

    const hasCompletedOnboarding = localStorage.getItem('tadbeer-onboarding-v1');

    if (hasCompletedOnboarding) {
      // Onboarding already done (returning user who hasn't seen tour yet)
      setTimeout(() => setIsOpen(true), 800);
    } else {
      // Wait for onboarding to finish, then show tour
      const handler = () => {
        setTimeout(() => setIsOpen(true), 600);
      };
      window.addEventListener('onboarding-complete', handler);
      return () => window.removeEventListener('onboarding-complete', handler);
    }
  }, [isClient, tourKey]);

  const updatePosition = useCallback(() => {
    const step = steps[currentStep];
    if (!step?.selector) {
      setTargetRect(null);
      setCurrentPlacement('center');
      setPosition({ top: window.innerHeight / 2, left: window.innerWidth / 2 });
      return;
    }

    const targetElement = document.querySelector(step.selector) as HTMLElement;
    if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        
        setTimeout(() => {
            if (!document.body.contains(targetElement)) return;
            
            const rect = targetElement.getBoundingClientRect();
            setTargetRect(rect);

            const PADDING = 16;
            const TOOLTIP_WIDTH = 320;
            const TOOLTIP_HEIGHT = 180; // Approximate height

            let placement = step.placement || 'bottom';
            
            // Auto-placement logic
            if (!step.placement) {
                const spaceBottom = window.innerHeight - rect.bottom - TOOLTIP_HEIGHT;
                const spaceTop = rect.top - TOOLTIP_HEIGHT;

                if (spaceBottom > PADDING) {
                    placement = 'bottom';
                } else if (spaceTop > PADDING) {
                    placement = 'top';
                } else {
                    // Fallback if neither top nor bottom has enough space
                    placement = 'bottom';
                }
            }
            setCurrentPlacement(placement);

            let newPos = { top: 0, left: rect.left + rect.width / 2 };

            switch (placement) {
                case 'top':
                    newPos.top = rect.top - PADDING;
                    break;
                case 'bottom':
                    newPos.top = rect.bottom + PADDING;
                    break;
                case 'left':
                    newPos.top = rect.top + rect.height / 2;
                    newPos.left = rect.left - PADDING;
                    break;
                case 'right':
                    newPos.top = rect.top + rect.height / 2;
                    newPos.left = rect.right + PADDING;
                    break;
            }

            // Adjust for viewport edges
            if (newPos.left - TOOLTIP_WIDTH / 2 < PADDING) {
                newPos.left = TOOLTIP_WIDTH / 2 + PADDING;
            }
            if (newPos.left + TOOLTIP_WIDTH / 2 > window.innerWidth - PADDING) {
                newPos.left = window.innerWidth - TOOLTIP_WIDTH / 2 - PADDING;
            }

            setPosition(newPos);

        }, 300); // Wait for scroll to finish
    } else {
      console.warn(`Tour step ${currentStep}: Element with selector "${step.selector}" not found.`);
      setTargetRect(null);
      setCurrentPlacement('center');
    }
  }, [currentStep, steps]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      return () => window.removeEventListener('resize', updatePosition);
    }
  }, [isOpen, updatePosition]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setIsOpen(false);
    if(isClient) {
        localStorage.setItem(tourKey, 'true');
    }
  };

  if (!isOpen || !isClient) return null;

  const currentStepData = steps[currentStep];
  const isCentered = !currentStepData.selector || !targetRect;

  const getTransformOrigin = () => {
    switch (currentPlacement) {
        case 'top': return 'bottom center';
        case 'bottom': return 'top center';
        case 'left': return 'right center';
        case 'right': return 'left center';
        default: return 'center center';
    }
  };

  const getTransform = () => {
    if (isCentered) return 'translate(-50%, -50%)';
    switch (currentPlacement) {
        case 'top': return 'translate(-50%, -100%)';
        case 'bottom': return 'translateX(-50%)';
        case 'left': return 'translate(-100%, -50%)';
        case 'right': return 'translateY(-50%)';
        default: return 'translateX(-50%)';
    }
  };

  return (
    <div className="fixed inset-0 z-[200]">
        <div 
            className="absolute inset-0 transition-all duration-300"
            style={{
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                clipPath: targetRect 
                    ? `path(evenodd, 'M -1,-1 H 10000 V 10000 H -1 Z M ${targetRect.left - 8},${targetRect.top - 8} h ${targetRect.width + 16} a 8,8 0 0 1 8,8 v ${targetRect.height} a 8,8 0 0 1 -8,8 h -${targetRect.width + 16} a 8,8 0 0 1 -8,-8 v -${targetRect.height} a 8,8 0 0 1 8,-8 z')`
                    : isCentered ? 'none' : 'path(evenodd, "M -1,-1 H 10000 V 10000 H -1 Z")',
            }}
        />

      <div
        className={cn(
            "fixed z-[201] w-[min(90vw,320px)] transition-all duration-300",
            "animate-in fade-in zoom-in-95"
        )}
        style={{
            top: position.top,
            left: position.left,
            transform: getTransform(),
            transformOrigin: getTransformOrigin()
        }}
      >
        {!isCentered && <TooltipArrow placement={currentPlacement} />}
        <div className="relative bg-popover text-popover-foreground p-4 space-y-3 rounded-lg border shadow-lg">
            <div className='flex justify-between items-start'>
                <h3 className="font-semibold text-lg leading-tight pr-8">{currentStepData.title}</h3>
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={handleComplete}>
                    <X className="h-4 w-4" />
                    <span className="sr-only">إغلاق الجولة</span>
                </Button>
            </div>
            
            <p className="text-sm text-popover-foreground/80">{currentStepData.content}</p>

            <div className="mt-4 flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                {currentStep + 1} / {steps.length}
                </span>
                <div className="flex gap-2">
                {currentStep > 0 && <Button variant="ghost" size="sm" onClick={handlePrev}>السابق</Button>}
                <Button size="sm" onClick={handleNext}>
                    {currentStep === steps.length - 1 ? 'إنهاء' : 'التالي'}
                </Button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
