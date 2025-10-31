
import React, { useState, useEffect, useMemo } from 'react';
import { XMarkIcon } from './Icons';

type TutorialStep = {
  target: string;
  title: string;
  description: string;
  position?: 'bottom' | 'top' | 'left' | 'right';
};

const tutorialSteps: TutorialStep[] = [
  {
    target: '#source-images-panel',
    title: '1. התחילו עם תמונה (אופציונלי)',
    description: 'גררו לכאן תמונות, הדביקו אותן, או לחצו על + כדי להתחיל לערוך או לשלב תמונות קיימות.',
    position: 'right',
  },
  {
    target: '#style-selector',
    title: '2. בחרו סגנון',
    description: 'שלבו סגנונות אמנותיים שונים כדי לתת ליצירה שלכם מראה ייחודי. אפשר לבחור יותר מאחד!',
    position: 'bottom',
  },
  {
    target: '#prompt-textarea',
    title: '3. כתבו הנחיה',
    description: 'תארו מה תרצו ליצור. ככל שתהיו מפורטים יותר, כך התוצאה תהיה טובה יותר. נסו את כפתור "נתח הנחיה" לקבלת רעיונות.',
    position: 'top',
  },
   {
    target: '#generate-button',
    title: '4. צאו לדרך!',
    description: 'לחצו כאן כדי להפעיל את הקסם של Gemini. התכוננו להיות מופתעים.',
    position: 'top',
  },
  {
    target: '#result-panel',
    title: '5. התוצאה שלכם',
    description: 'כאן תופיע התמונה שנוצרה. תוכלו להוריד אותה, לערוך אותה, או להשתמש בה כמקור ליצירה חדשה.',
    position: 'left',
  },
  {
    target: '#creations-gallery',
    title: '6. גלריית היצירות',
    description: 'כל יצירה שלכם נשמרת כאן אוטומטית. תוכלו לחזור אליהן, להוריד אותן או להמשיך לעבוד עליהן.',
    position: 'top',
  },
];

export const TutorialOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const currentStep = tutorialSteps[step];

  useEffect(() => {
    const updateRect = () => {
      const element = document.querySelector(currentStep.target);
      if (element) {
        setTargetRect(element.getBoundingClientRect());
      } else {
        setTargetRect(null); // Explicitly hide if target is not visible
      }
    };
    
    updateRect();
    const intervalId = setInterval(updateRect, 200); // Periodically check for layout shifts
    window.addEventListener('resize', updateRect);

    return () => {
        clearInterval(intervalId);
        window.removeEventListener('resize', updateRect);
    };
  }, [step, currentStep.target]);

  const spotlightStyle = useMemo(() => {
    if (!targetRect) return { display: 'none' };
    return {
      width: `${targetRect.width + 20}px`,
      height: `${targetRect.height + 20}px`,
      top: `${targetRect.top - 10}px`,
      left: `${targetRect.left - 10}px`,
    };
  }, [targetRect]);

  const popoverStyle = useMemo(() => {
    if (!targetRect) return { display: 'none' };

    const styles: React.CSSProperties = {};
    const position = currentStep.position || 'bottom';

    switch (position) {
        case 'bottom':
            styles.top = `${targetRect.bottom + 15}px`;
            styles.left = `${targetRect.left + targetRect.width / 2}px`;
            styles.transform = 'translateX(-50%)';
            break;
        case 'top':
            styles.bottom = `${window.innerHeight - targetRect.top + 15}px`;
            styles.left = `${targetRect.left + targetRect.width / 2}px`;
            styles.transform = 'translateX(-50%)';
            break;
        case 'left':
            styles.top = `${targetRect.top + targetRect.height / 2}px`;
            styles.right = `${window.innerWidth - targetRect.left + 15}px`;
            styles.transform = 'translateY(-50%)';
            break;
        case 'right':
            styles.top = `${targetRect.top + targetRect.height / 2}px`;
            styles.left = `${targetRect.right + 15}px`;
            styles.transform = 'translateY(-50%)';
            break;
    }
    return styles;
  }, [targetRect, currentStep.position]);
  
  const handleNext = () => {
    if (step < tutorialSteps.length - 1) {
      setStep(s => s + 1);
    } else {
      onClose();
    }
  };
  
  const handlePrev = () => {
      if (step > 0) {
          setStep(s => s-1);
      }
  };

  return (
    <div className="fixed inset-0 z-[1000] animate-fade-in">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
        {targetRect && (
            <>
                <div 
                    className="absolute rounded-lg border-2 border-dashed border-purple-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.8)] transition-all duration-500 ease-in-out"
                    style={spotlightStyle}
                ></div>

                <div 
                    className="absolute z-[1001] w-72 bg-slate-800 p-4 rounded-lg shadow-2xl ring-1 ring-white/10 animate-fade-in"
                    style={popoverStyle}
                >
                    <h4 className="font-bold text-lg text-purple-400 mb-2">{currentStep.title}</h4>
                    <p className="text-sm text-slate-300">{currentStep.description}</p>
                    <div className="flex justify-between items-center mt-4">
                        <div className="text-xs text-slate-500">{step + 1} / {tutorialSteps.length}</div>
                        <div className="flex gap-2">
                             {step > 0 && <button onClick={handlePrev} className="px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-700/50 rounded-md hover:bg-slate-600/50">הקודם</button>}
                             <button onClick={handleNext} className="px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700">
                                {step === tutorialSteps.length - 1 ? 'סיום' : 'הבא'}
                            </button>
                        </div>
                    </div>
                </div>
            </>
        )}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-black/30">
            <XMarkIcon className="h-6 w-6" />
        </button>
    </div>
  );
};
