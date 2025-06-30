
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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

export default function OnboardingTour({ steps, tourKey }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (isClient) {
        const hasCompletedTour = localStorage.getItem(tourKey);
        if (!hasCompletedTour) {
            // Start the tour after a short delay to ensure the page is fully rendered
            setTimeout(() => setIsOpen(true), 500);
        }
    }
  }, [isClient, tourKey]);

  const updateTargetRect = useCallback(() => {
    if (!steps[currentStep]?.selector) {
      setTargetRect(null);
      return;
    }
    const targetElement = document.querySelector(steps[currentStep].selector) as HTMLElement;
    if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Give time for scroll to finish
        setTimeout(() => {
            if (document.body.contains(targetElement)) {
              setTargetRect(targetElement.getBoundingClientRect());
            }
        }, 300);
    } else {
      console.warn(`Tour step ${currentStep}: Element with selector "${steps[currentStep].selector}" not found.`);
      setTargetRect(null); // Fallback to centered if element not found
    }
  }, [currentStep, steps]);

  useEffect(() => {
    if (isOpen) {
      updateTargetRect();
      window.addEventListener('resize', updateTargetRect);
      return () => window.removeEventListener('resize', updateTargetRect);
    }
  }, [isOpen, updateTargetRect]);
  
  useEffect(() => {
    if (isOpen) {
      updateTargetRect();
    }
  }, [currentStep, isOpen, updateTargetRect]);

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

  const tooltipPosition: React.CSSProperties = {};
  if (targetRect && currentStepData.selector) {
    const { top, left, width, height } = targetRect;
    const offset = 12; // 12px gap

    switch (currentStepData.placement) {
        case 'top':
            tooltipPosition.top = top - offset;
            tooltipPosition.left = left + width / 2;
            tooltipPosition.transform = 'translate(-50%, -100%)';
            break;
        case 'right':
            tooltipPosition.top = top + height / 2;
            tooltipPosition.left = left + width + offset;
            tooltipPosition.transform = 'translateY(-50%)';
            break;
        case 'left':
            tooltipPosition.top = top + height / 2;
            tooltipPosition.left = left - offset;
            tooltipPosition.transform = 'translate(-100%, -50%)';
            break;
        case 'bottom':
        default:
            tooltipPosition.top = top + height + offset;
            tooltipPosition.left = left + width / 2;
            tooltipPosition.transform = 'translateX(-50%)';
            break;
    }
  } else {
    tooltipPosition.top = '50%';
    tooltipPosition.left = '50%';
    tooltipPosition.transform = 'translate(-50%, -50%)';
  }

  return (
    <div className="fixed inset-0 z-[200]">
        {/* Overlay with hole */}
        <div 
            className="absolute inset-0 transition-all duration-300"
            style={{
                background: isCentered ? 'rgba(0, 0, 0, 0.6)' : 'transparent',
                clipPath: targetRect 
                    ? `path(evenodd, 'M -1,-1 H 10000 V 10000 H -1 Z M ${targetRect.left - 8},${targetRect.top - 8} h ${targetRect.width + 16} a 8,8 0 0 1 8,8 v ${targetRect.height} a 8,8 0 0 1 -8,8 h -${targetRect.width + 16} a 8,8 0 0 1 -8,-8 v -${targetRect.height} a 8,8 0 0 1 8,-8 z')`
                    : 'none',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
            }}
        />

      {/* Tooltip Card */}
      <Card
        className={cn(
            "fixed z-[201] w-[min(90vw,350px)] shadow-2xl transition-all duration-300",
            "animate-in fade-in zoom-in-95"
        )}
        style={tooltipPosition}
      >
        <CardHeader className="relative pb-2">
          <CardTitle>{currentStepData.title}</CardTitle>
          <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={handleComplete}>
            <X className="h-4 w-4" />
            <span className="sr-only">إغلاق الجولة</span>
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{currentStepData.content}</p>
          <div className="mt-4 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {currentStep + 1} / {steps.length}
            </span>
            <div className="flex gap-2">
              {currentStep > 0 && <Button variant="outline" onClick={handlePrev}>السابق</Button>}
              <Button onClick={handleNext}>
                {currentStep === steps.length - 1 ? 'إنهاء' : 'التالي'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
