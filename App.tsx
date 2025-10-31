

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { 
    generateFromImagesAndPrompt, 
    generateImageWithGemini, 
    fileToBase64, 
    analyzePromptWithGemini, 
    getAllCreationsFromDB, 
    addCreationToDB, 
    deleteCreationFromDB,
    generateChatResponse,
    validateApiKey,
    generateInpaintingFromImagesAndPrompt
} from './services/geminiService';
import { 
    SpinnerIcon, SparklesIcon, UploadIcon, ArrowPathIcon, TrashIcon, DownloadIcon, MagicWandIcon, 
    AspectRatioSquareIcon, AspectRatioLandscapeIcon, AspectRatioPortraitIcon, AspectRatioFourThreeIcon, 
    AspectRatioThreeFourIcon, PlusIcon, XMarkIcon, ArrowsPointingOutIcon, AdjustmentsHorizontalIcon, 
    CheckIcon, ArrowUturnLeftIcon, BeakerIcon, ClipboardDocumentIcon, KeyIcon,
    ChatBubbleLeftRightIcon, MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon, ArrowsPointingInIcon,
    PencilIcon, Square2StackIcon, Squares2X2Icon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, PaintBrushIcon
} from './components/Icons';
import { ChatWindow } from './components/ChatWindow';
import { TutorialOverlay } from './components/TutorialOverlay';

type ImageState = {
  id: string;
  dataUrl: string;
  mimeType: string;
  base64: string;
};

type Adjustment = {
  brightness: number;
  contrast: number;
  saturate: number;
  sepia: number;
  grayscale: number;
};

type StyleKey = keyof typeof STYLES;
type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
type Mode = 'create' | 'edit' | 'combine';
type ActiveTool = 'resize' | 'edit' | 'inpaint';

type Creation = {
  id: string;
  image: ImageState;
  prompt: string;
  styles: StyleKey[];
  aspectRatio?: AspectRatio;
  model: 'imagen' | 'gemini-flash';
};

type Toast = {
  id: number;
  message: string;
};


const INITIAL_ADJUSTMENTS: Adjustment = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  sepia: 0,
  grayscale: 0,
};

const FILTERS: Record<string, Adjustment> = {
  'וינטג\'': { brightness: 110, contrast: 90, saturate: 120, sepia: 60, grayscale: 0 },
  'שחור לבן': { grayscale: 100, brightness: 100, contrast: 110, saturate: 0, sepia: 0 },
  'קולנועי': { brightness: 95, contrast: 120, saturate: 110, sepia: 10, grayscale: 0 },
  'קיצי': { brightness: 105, contrast: 105, saturate: 130, sepia: 0, grayscale: 0 },
  'קר': { brightness: 105, contrast: 110, saturate: 90, sepia: 0, grayscale: 0 },
};

const STYLES = {
  // Artistic Movements
  'אימפרסיוניזם': 'impressionist painting, visible brushstrokes, light and color focus, by Claude Monet',
  'סוריאליסטי': 'surrealism, dream-like, bizarre, illogical scenes, by Salvador Dalí',
  'קוביזם': 'cubism, geometric shapes, multiple viewpoints, fragmented objects',
  'פופ ארט': 'pop art, bold colors, Ben-Day dots, comic book style, by Andy Warhol',
  'ארט נובו': 'art nouveau, elegant, flowing lines, nature-inspired, organic forms',
  'בארוק': 'baroque painting, dramatic, chiaroscuro, rich colors, emotional intensity, by Caravaggio',
  'פסיכדלי': 'psychedelic art, vibrant swirling colors, distorted patterns, 1960s counter-culture',
  'אוקיו-אה': 'ukiyo-e style, Japanese woodblock print, flat colors, bold outlines, by Hokusai',
  'ימי הביניים': 'medieval illuminated manuscript, gothic art, rich colors, gold leaf, detailed borders',
  
  // Digital Art & Sci-Fi
  'פוטוריאליסטי': 'photorealistic, 8k, detailed, professional photography, sharp focus',
  'מציאותי ביותר': 'hyperrealistic, ultra-detailed, 16k resolution, cinematic lighting, sharp focus, professional photography, octane render, unreal engine 5',
  'מדע בדיוני': 'sci-fi, futuristic, neon lights, cyberpunk aesthetic, high-tech',
  'פנטזיה': 'fantasy art, epic, magical, otherworldly, detailed, by Greg Rutkowski',
  'רינדור תלת-ממדי': '3D render, CGI, Octane render, high detail, realistic lighting, trending on ArtStation',
  'פיקסל ארט': 'pixel art, 8-bit, retro gaming style, blocky, nostalgic',
  'איזומטרי': 'isometric 3D, low-poly, clean, stylized, high angle view',
  'הולוגרפי': 'holographic, neon, iridescent, glowing, futuristic interface',
  'סטימפאנק': 'steampunk, gears, clockwork, Victorian aesthetic, brass and copper',
  'סולארפאנק': 'solarpunk, optimistic future, nature and technology in harmony, sustainable',

  // Painting & Drawing
  'צבעי מים': 'watercolor painting, soft, blended colors, artistic, light wash',
  'צבע בשמן': 'oil painting, classic, rich textures, visible brushstrokes',
  'אנימה': 'anime style, vibrant colors, detailed characters, dynamic scenes, by Studio Ghibli',
  'סקיצה': 'pencil sketch, hand-drawn, authentic, graphite shading',
  'רישום פחם': 'charcoal drawing, dramatic, rich shadows, textured paper',
  'אמנות קו': 'line art, single line drawing, minimalist, black and white, elegant',

  // Photography & Cinematic
  'קולנועי': 'cinematic shot, anamorphic lens, dramatic lighting, shallow depth of field, color graded',
  'וינטג\'': 'vintage photo, retro, sepia tones, old-fashioned, film grain',
  'חשיפה כפולה': 'double exposure, superimposed images, abstract, blended',
  'שעת הזהב': 'golden hour photography, warm light, long shadows, soft focus',
  'גותי': 'gothic style, dark, moody, intricate details, dramatic lighting, mysterious',
  'מלחמת העולם השנייה': 'World War II photo, black and white, film grain, historical, 1940s style, documentary photography',

  
  // Graphic & Abstract
  'מינימליסטי': 'minimalist, clean lines, simple shapes, limited color palette, uncluttered',
  'גרפיטי': 'graffiti art, street art, spray paint, vibrant, urban, tagging',
  'ספר קומיקס': 'comic book style, bold outlines, vibrant flat colors, action lines',
  'ארט דקו': 'art deco style, geometric patterns, sleek lines, glamorous, 1920s',
  'אמנות מופשטת': 'abstract art, non-representational, shapes, colors, emotions',
};

const STYLE_CATEGORIES: Record<string, StyleKey[]> = {
    'תנועות אמנותיות': ['אימפרסיוניזם', 'סוריאליסטי', 'קוביזם', 'פופ ארט', 'ארט נובו', 'בארוק', 'פסיכדלי', 'אוקיו-אה', 'ימי הביניים'],
    'אמנות דיגיטלית ומד"ב': ['פוטוריאליסטי', 'מציאותי ביותר', 'מדע בדיוני', 'פנטזיה', 'רינדור תלת-ממדי', 'פיקסל ארט', 'איזומטרי', 'הולוגרפי', 'סטימפאנק', 'סולארפאנק'],
    'ציור ורישום': ['צבעי מים', 'צבע בשמן', 'אנימה', 'סקיצה', 'רישום פחם', 'אמנות קו'],
    'צילום וקולנוע': ['קולנועי', 'וינטג\'', 'חשיפה כפולה', 'שעת הזהב', 'גותי', 'מלחמת העולם השנייה'],
    'גרפי ומופשט': ['מינימליסטי', 'גרפיטי', 'ספר קומיקס', 'ארט דקו', 'אמנות מופשטת'],
};

const samplePrompts = [
  'חתול חמוד לובש חליפת חלל ומרחף בחלל',
  'טירה עתיקה על צוק המשקיף על ים סוער',
  'יער קסום בלילה עם פטריות זוהרות',
  'רובוט רטרו מגיש קפה בבית קפה פריזאי',
  'לוויתן עף בין העננים בשקיעה',
  'עיר עתידנית עם מכוניות מעופפות וגורדי שחקים הולוגרפיים',
  'דיוקן של שועל בסגנון ציור שמן של ואן גוך',
  'אי צף בשמיים עם מפל מים שיורד ממנו',
  'ספרייה ענקית ואינסופית, בסגנון של M.C. Escher',
  'דרקון מכני נושף אש העשויה מגלי נתונים דיגיטליים',
];

const generateFilterString = (adj: Adjustment): string => {
    return [
      `brightness(${adj.brightness}%)`,
      `contrast(${adj.contrast}%)`,
      `saturate(${adj.saturate}%)`,
      `sepia(${adj.sepia}%)`,
      `grayscale(${adj.grayscale}%)`,
    ].join(' ');
  };

const AdjustmentSlider: React.FC<{
    label: string;
    name: keyof Adjustment;
    value: number;
    min: number;
    max: number;
    onChange: (name: keyof Adjustment, value: string) => void;
    disabled: boolean;
}> = ({ label, name, value, min, max, onChange, disabled }) => (
    <div>
        <div className="flex justify-between items-center text-xs mb-1">
            <label htmlFor={name} className="font-medium text-slate-300">{label}</label>
            <span className="text-slate-200 font-mono bg-slate-900/50 px-1.5 py-0.5 rounded-md">{value}%</span>
        </div>
        <input
            id={name}
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(name, e.target.value)}
            disabled={disabled}
            className="w-full h-2 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-purple-500 disabled:opacity-50"
        />
    </div>
);

const CanvasDisplay: React.FC<{
  imageState: ImageState | null;
  isLoading?: boolean;
  adjustments: Adjustment;
  zoom: number;
  pan: { x: number; y: number };
  onZoomChange: (zoom: React.SetStateAction<number>) => void;
  onPanChange: (pan: React.SetStateAction<{x: number, y: number}>) => void;
  onResetZoomAndPan: () => void;
  activeTool: ActiveTool;
  brushSize: number;
  imageForInpaintingRef: React.RefObject<HTMLImageElement>;
  maskCanvasRef: React.RefObject<HTMLCanvasElement>;
  onDrawOnMask: () => void;
  onCursorMove: (e: React.MouseEvent) => void;
  onCursorLeave: () => void;
}> = ({
  imageState,
  isLoading = false,
  adjustments,
  zoom,
  pan,
  onZoomChange,
  onPanChange,
  onResetZoomAndPan,
  activeTool,
  brushSize,
  imageForInpaintingRef,
  maskCanvasRef,
  onDrawOnMask,
  onCursorMove,
  onCursorLeave
}) => {
    
  const filterString = useMemo(() => generateFilterString(adjustments), [adjustments]);

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [hoverPan, setHoverPan] = useState({ x: 0, y: 0 });

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(val, max));

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !imageState || isLoading || activeTool === 'inpaint') return;

    const handleWheelEvent = (e: WheelEvent) => {
        e.preventDefault();
        
        const rect = viewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;

        const scaleAmount = 1 - e.deltaY * 0.001;
        
        onZoomChange(prevZoom => {
            const newZoom = clamp(prevZoom * scaleAmount, 0.5, 5);
            onPanChange(prevPan => {
                const newPanX = mouseX - ((mouseX - prevPan.x) / prevZoom) * newZoom;
                const newPanY = mouseY - ((mouseY - prevPan.y) / prevZoom) * newZoom;
                return { x: newPanX, y: newPanY };
            });
            return newZoom;
        });
    };

    viewport.addEventListener('wheel', handleWheelEvent, { passive: false });

    return () => {
        viewport.removeEventListener('wheel', handleWheelEvent);
    };
  }, [imageState, isLoading, onPanChange, onZoomChange, activeTool]);

  useEffect(() => {
    const canvas = maskCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
        ctx.lineWidth = brushSize;
    }
  }, [brushSize, maskCanvasRef]);

  const draw = (e: React.MouseEvent, isSinglePoint = false) => {
    const ctx = maskCanvasRef.current?.getContext('2d');
    if (!ctx) return;

    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    if (isSinglePoint) {
        ctx.beginPath();
        // Adjust arc radius for canvas scaling
        const scaledBrushSize = (brushSize / 2) * (canvas.width / rect.width);
        ctx.arc(x, y, scaledBrushSize, 0, Math.PI * 2);
        ctx.fillStyle = 'white'; // Fill for single point
        ctx.fill();
    } else if (lastPos.current) {
        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(x, y);
        ctx.stroke();
    }
    lastPos.current = { x, y };
    onDrawOnMask();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool === 'inpaint') {
        if (e.button !== 0) return; // Only main click
        setIsDrawing(true);
        draw(e, true); // Draw a single point on mousedown
        e.preventDefault();
        e.stopPropagation();
    } else {
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (activeTool === 'inpaint') {
        if (isDrawing) {
            draw(e, false); // Draw a line on mousemove
        }
    } else if (isPanning) {
        onPanChange({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
    }
  };

  const handleMouseUpOrLeave = () => {
    if (activeTool === 'inpaint') {
        setIsDrawing(false);
        lastPos.current = null;
    } else if (isPanning) {
        setIsPanning(false);
    }
  };

  const handleHoverMove = (e: React.MouseEvent) => {
    if (isLoading || !imageState || isPanning || activeTool === 'inpaint') {
      if (hoverPan.x !== 0 || hoverPan.y !== 0) {
        setHoverPan({ x: 0, y: 0 });
      }
      return;
    }

    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const panX = ((x - centerX) / centerX) * -15; // Max pan 15px
    const panY = ((y - centerY) / centerY) * -15; // Max pan 15px

    setHoverPan({ x: panX, y: panY });
  };

  const handleHoverLeave = () => {
    setHoverPan({ x: 0, y: 0 });
  };

  const handleZoomButtonClick = (direction: 'in' | 'out') => {
    const scaleAmount = direction === 'in' ? 1.2 : 1 / 1.2;
    const newZoom = clamp(zoom * scaleAmount, 0.5, 5);
    
    const newPanX = pan.x * (newZoom / zoom);
    const newPanY = pan.y * (newZoom / zoom);

    onZoomChange(newZoom);
    onPanChange({ x: newPanX, y: newPanY });
  };
  
  const finalPanX = pan.x + hoverPan.x;
  const finalPanY = pan.y + hoverPan.y;

  let viewportCursor = 'default';
  if (activeTool === 'inpaint' && imageState) {
      viewportCursor = 'none';
  } else if (imageState && !isLoading && activeTool !== 'inpaint') {
      viewportCursor = isPanning ? 'grabbing' : 'grab';
  }
  
  const canvasWrapperStyle: React.CSSProperties = {
    transform: `translate(${finalPanX}px, ${finalPanY}px) scale(${zoom})`,
    transition: 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  };

  return (
    <div 
        id="canvas-display"
        ref={viewportRef}
        className="flex-grow w-full h-full flex items-center justify-center rounded-lg overflow-hidden relative group transition-shadow duration-500"
        style={{ cursor: viewportCursor }}
        onMouseDown={imageState && !isLoading ? handleMouseDown : undefined}
        onMouseMove={(e) => {
            if (imageState && !isLoading) handleMouseMove(e);
            onCursorMove(e);
            handleHoverMove(e);
        }}
        onMouseUp={imageState && !isLoading ? handleMouseUpOrLeave : undefined}
        onMouseLeave={(e) => {
            if (imageState && !isLoading) handleMouseUpOrLeave();
            onCursorLeave();
            handleHoverLeave();
        }}
        >
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-300 z-10 bg-slate-950/50 backdrop-blur-sm">
            <SpinnerIcon className="animate-spin h-12 w-12 text-purple-400" />
            <p className="mt-4 text-sm text-slate-400">Gemini חושב...</p>
          </div>
        ) : imageState ? (
          <div style={canvasWrapperStyle}>
            <img
              ref={imageForInpaintingRef}
              src={imageState.dataUrl}
              alt="תוצאה"
              className="max-h-full max-w-full object-contain block"
              style={{ filter: filterString }}
              key={imageState.id} 
              draggable="false"
              onLoad={() => {
                const img = imageForInpaintingRef.current;
                const canvas = maskCanvasRef.current;
                if (img && canvas) {
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.strokeStyle = 'white';
                        ctx.lineWidth = brushSize * (img.naturalWidth / img.clientWidth); // Scale line width
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                    }
                }
              }}
            />
            {activeTool === 'inpaint' && (
                <canvas
                    ref={maskCanvasRef}
                    className="absolute top-0 left-0 pointer-events-none w-full h-full"
                    style={{
                        opacity: 0.5,
                        filter: 'blur(2px) contrast(1.2)'
                    }}
                />
            )}
            <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/60 backdrop-blur-md rounded-full px-3 py-1.5 shadow-lg ring-1 ring-white/10 transition-opacity duration-300 z-20 ${activeTool === 'inpaint' ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
                <button onClick={() => handleZoomButtonClick('out')} className="p-1.5 rounded-full text-slate-300 hover:bg-slate-700/50 hover:text-white" aria-label="הקטן תצוגה"><MagnifyingGlassMinusIcon className="h-5 w-5"/></button>
                <span className="text-sm font-mono text-slate-200 w-12 text-center select-none">{(zoom * 100).toFixed(0)}%</span>
                <button onClick={() => handleZoomButtonClick('in')} className="p-1.5 rounded-full text-slate-300 hover:bg-slate-700/50 hover:text-white" aria-label="הגדל תצוגה"><MagnifyingGlassPlusIcon className="h-5 w-5"/></button>
                <div className="w-px h-5 bg-slate-600 mx-1"></div>
                <button onClick={onResetZoomAndPan} disabled={zoom === 1 && pan.x === 0 && pan.y === 0} className="p-1.5 rounded-full text-slate-300 hover:bg-slate-700/50 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed" aria-label="אפס תצוגה"><ArrowsPointingInIcon className="h-5 w-5"/></button>
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-500 px-6">
            <SparklesIcon className="mx-auto h-12 w-12" />
            <p className="mt-2 text-sm">הקנבס שלך ממתין ליצירה.</p>
          </div>
        )}
      </div>
  );
};

const SourceImagePreview: React.FC<{
    images: ImageState[];
    currentIndex: number;
    onClose: () => void;
    onNavigate: (newIndex: number) => void;
}> = ({ images, currentIndex, onClose, onNavigate }) => {
    const currentImage = images[currentIndex];
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowRight' && images.length > 1) {
                onNavigate((currentIndex + 1) % images.length);
            } else if (e.key === 'ArrowLeft' && images.length > 1) {
                onNavigate((currentIndex - 1 + images.length) % images.length);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, images.length, onClose, onNavigate]);

    if (!currentImage) return null;

    return (
        <div className="fixed inset-0 z-[1001] animate-fade-in flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" onClick={onClose}></div>
            
            <div className="relative z-10 w-full h-full flex items-center justify-center">
                {/* Image Display */}
                <div className="max-w-[80vw] max-h-[80vh]">
                     <img src={currentImage.dataUrl} alt={`תצוגה מקדימה ${currentIndex + 1}`} className="w-auto h-auto max-w-full max-h-full object-contain rounded-lg shadow-2xl"/>
                </div>

                {/* Close Button */}
                <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-black/30" aria-label="סגור תצוגה מקדימה">
                    <XMarkIcon className="h-8 w-8" />
                </button>

                {/* Navigation */}
                {images.length > 1 && (
                    <>
                        <button 
                            onClick={() => onNavigate((currentIndex - 1 + images.length) % images.length)}
                            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-slate-300 hover:text-white rounded-full bg-black/40 hover:bg-black/60 transition-colors"
                            aria-label="התמונה הקודמת"
                        >
                            <ChevronLeftIcon className="h-8 w-8" />
                        </button>
                        <button 
                            onClick={() => onNavigate((currentIndex + 1) % images.length)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-slate-300 hover:text-white rounded-full bg-black/40 hover:bg-black/60 transition-colors"
                            aria-label="התמונה הבאה"
                        >
                            <ChevronRightIcon className="h-8 w-8" />
                        </button>
                    </>
                )}
                
                {/* Counter */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/50 text-slate-200 text-sm font-mono rounded-full">
                    {currentIndex + 1} / {images.length}
                </div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const [sourceImages, setSourceImages] = useState<ImageState[]>([]);
  const [resultImage, setResultImage] = useState<ImageState | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [selectedStyles, setSelectedStyles] = useState<StyleKey[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New UI State
  const [mode, setMode] = useState<Mode>('create');
  const [isCreationPanelOpen, setCreationPanelOpen] = useState(true);
  
  // UX Features State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [promptSuggestions, setPromptSuggestions] = useState<string[]>([]);
  const [creations, setCreations] = useState<Creation[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);

  // API Key State
  const [hasSelectedApiKey, setHasSelectedApiKey] = useState(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);
  const [apiKeySelectionInProgress, setApiKeySelectionInProgress] = useState(false);
  const [manualApiKeyInput, setManualApiKeyInput] = useState<string>('');
  const [validManualApiKey, setValidManualApiKey] = useState<string | null>(null);
  const [isVerifyingKey, setIsVerifyingKey] = useState<boolean>(false);
  const [isManagingKey, setIsManagingKey] = useState<boolean>(false);

  // Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isThinkingMode, setIsThinkingMode] = useState(false);

  // Editing state
  const [originalImageDimensions, setOriginalImageDimensions] = useState<{width: number, height: number} | null>(null);
  const [resizeWidth, setResizeWidth] = useState<string>('');
  const [resizeHeight, setResizeHeight] = useState<string>('');
  const [keepAspectRatio, setKeepAspectRatio] = useState<boolean>(true);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [adjustments, setAdjustments] = useState<Adjustment>(INITIAL_ADJUSTMENTS);
  const [isApplyingEdits, setIsApplyingEdits] = useState<boolean>(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>('resize');
  const [editHistory, setEditHistory] = useState<ImageState[]>([]);
  
  // Inpainting State
  const [inpaintingPrompt, setInpaintingPrompt] = useState('');
  const [brushSize, setBrushSize] = useState(40);
  const [isApplyingInpainting, setIsApplyingInpainting] = useState(false);
  const imageForInpaintingRef = useRef<HTMLImageElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isMaskDrawn, setIsMaskDrawn] = useState(false);
  const [brushCursor, setBrushCursor] = useState({ visible: false, x: 0, y: 0 });


  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const isEditing = useMemo(() => JSON.stringify(adjustments) !== JSON.stringify(INITIAL_ADJUSTMENTS), [adjustments]);

  const showToast = useCallback((message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  }, []);
  
  // Check for API key on mount
  useEffect(() => {
    const checkApiKey = async () => {
      setIsCheckingApiKey(true);
      const savedKey = localStorage.getItem('gemini-studio-manual-key');
      if (savedKey) {
        setValidManualApiKey(savedKey);
        setHasSelectedApiKey(false);
        setIsCheckingApiKey(false);
        return;
      }
      // @ts-ignore
      if (window.aistudio) {
        try {
          // @ts-ignore
          const hasKey = await window.aistudio.hasSelectedApiKey();
          if (hasKey) {
              showToast("אפשר להתחיל לשוחח עם Gemini! לחצו על הכפתור בפינה.");
          }
          setHasSelectedApiKey(hasKey);
        } catch (e) {
          console.error("Error checking for API key:", e);
          setHasSelectedApiKey(false);
        }
      } else {
        setHasSelectedApiKey(false);
      }
      setIsCheckingApiKey(false);
    };
    checkApiKey();
    const tutorialSeen = localStorage.getItem('gemini-studio-tutorial-seen');
    if (!tutorialSeen) {
        setShowTutorial(true);
    }
  }, [showToast]);

  const handleCloseTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem('gemini-studio-tutorial-seen', 'true');
  };

  useEffect(() => {
    const loadCreations = async () => {
        try {
            const storedCreations = await getAllCreationsFromDB();
            setCreations(storedCreations);
        } catch (error) {
            console.error("Failed to load creations from DB", error);
            showToast("לא ניתן היה לטעון את הגלריה.");
            setCreations([]);
        }
    };
    loadCreations();
  }, [showToast]);

  useEffect(() => {
    if (sourceImages.length > 0 && mode === 'create') {
        setMode('edit');
    } else if (sourceImages.length === 0 && mode !== 'create') {
        setMode('create');
    } else if (sourceImages.length > 1 && mode !== 'combine') {
        setMode('combine');
    } else if (sourceImages.length === 1 && mode === 'combine') {
        setMode('edit');
    }
  }, [sourceImages, mode]);

  const aspectRatios: { value: AspectRatio; label: string; icon: React.FC<{className?: string}> }[] = [
    { value: '1:1', label: 'ריבוע', icon: AspectRatioSquareIcon },
    { value: '16:9', label: 'נוף', icon: AspectRatioLandscapeIcon },
    { value: '9:16', label: 'דיוקן', icon: AspectRatioPortraitIcon },
    { value: '4:3', label: '4:3', icon: AspectRatioFourThreeIcon },
    { value: '3:4', label: '3:4', icon: AspectRatioThreeFourIcon },
  ];
  
  const { buttonText, promptLabel, isSubmittable } = useMemo(() => {
    const hasPrompt = prompt.trim() !== '';
    const hasStyles = selectedStyles.length > 0;
    
    let btnText = "צור";
    let pLabel = "הנחיה ליצירה";

    switch(mode) {
        case 'create':
            btnText = "צור תמונה";
            pLabel = hasStyles ? 'הוסף הנחיה (אופציונלי) לדיוק הסגנון' : 'הנחיה ליצירה';
            break;
        case 'edit':
             btnText = hasPrompt ? 'החל עריכה' : 'החל סגנון';
             pLabel = 'הנחיה לעריכה (לדוגמה: "הוסף משקפי שמש")';
            break;
        case 'combine':
            btnText = "חבר תמונות";
            pLabel = "איך לחבר את התמונות?";
            break;
    }
    
    const submittable = hasPrompt || hasStyles || (mode !== 'create' && sourceImages.length > 0);

    return { buttonText: btnText, promptLabel: pLabel, isSubmittable: submittable };
  }, [prompt, sourceImages.length, selectedStyles, mode]);

  const handleStyleClick = (styleKey: StyleKey) => {
    setSelectedStyles(prev => {
        const isSelected = prev.includes(styleKey);
        if (isSelected) {
            return prev.filter(s => s !== styleKey);
        } else {
            return [...prev, styleKey];
        }
    });
  };

  const handleAddImages = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const imagePromises = Array.from(files)
      .filter(file => file.type.startsWith('image/'))
      .map(async (file) => {
        const { base64, mimeType } = await fileToBase64(file);
        const dataUrl = `data:${mimeType};base64,${base64}`;
        return { id: `${file.name}-${Date.now()}`, dataUrl, mimeType, base64 };
      });
    
    const newImages = await Promise.all(imagePromises);
    setSourceImages(prev => [...prev, ...newImages]);
    setError(null);
  }, []);

  const handleRemoveImage = (id: string) => {
    setSourceImages(prev => prev.filter(img => img.id !== id));
  };
  
  const handleClearMask = () => {
    const canvas = maskCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setIsMaskDrawn(false);
  };

  const resetResultState = () => {
    setResultImage(null);
    setOriginalImageDimensions(null);
    setResizeWidth('');
    setResizeHeight('');
    setAdjustments(INITIAL_ADJUSTMENTS);
    setActiveTool('resize');
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setEditHistory([]);
    setInpaintingPrompt('');
    handleClearMask();
  };

  const handleUseAsSource = () => {
    if (resultImage) {
      if (mode === 'edit' || (mode === 'combine' && sourceImages.length === 1)) {
        setSourceImages([{ ...resultImage, id: `source-${Date.now()}` }]);
        showToast("התמונה המעודכנת הפכה למקור");
      } else {
        setSourceImages(prev => [...prev, { ...resultImage, id: `result-${Date.now()}` }]);
        showToast("התמונה הוספה למקור");
      }
      resetResultState();
    }
  };
  
  const handleDownload = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = resultImage.dataUrl;
    const extension = resultImage.mimeType.split('/')[1] || 'png';
    link.download = `gemini-image-${Date.now()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("התמונה הורדה בהצלחה");
  };

  const handleReset = () => {
    setSourceImages([]);
    setPrompt('');
    setSelectedStyles([]);
    setAspectRatio('1:1');
    setError(null);
    setIsLoading(false);
    resetResultState();
    setIsResizing(false);
    setIsApplyingEdits(false);
    setIsApplyingInpainting(false);
    setPromptSuggestions([]);
  };
  
  const handleSurpriseMe = () => {
    const randomPrompt = samplePrompts[Math.floor(Math.random() * samplePrompts.length)];
    setPrompt(randomPrompt);
  };

  const isKeyConfigured = hasSelectedApiKey || !!validManualApiKey;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || !isSubmittable || !isKeyConfigured) return;

    setIsLoading(true);
    setError(null);
    resetResultState();
    setPromptSuggestions([]);
    
    const styleString = selectedStyles.map(s => STYLES[s]).filter(Boolean).join(', ');
    
    let finalPrompt = prompt.trim();
    if (styleString) {
      if (finalPrompt) {
        finalPrompt = `${finalPrompt}, in the style of ${styleString}`;
      } else {
        if (sourceImages.length > 0) {
          finalPrompt = `Apply the following style(s) to the image: ${styleString}`;
        } else {
          finalPrompt = `An image in the style of: ${styleString}`;
        }
      }
    }

    try {
      let result: { base64: string; mimeType: string; };

      if (mode === 'edit' || mode === 'combine') {
        const imagePayload = sourceImages.map(img => ({ base64: img.base64, mimeType: img.mimeType }));
        result = await generateFromImagesAndPrompt(imagePayload, finalPrompt, validManualApiKey ?? undefined);
      } else { // 'create' mode
        result = await generateImageWithGemini(finalPrompt, aspectRatio, validManualApiKey ?? undefined);
      }
      
      const { base64, mimeType } = result;
      const dataUrl = `data:${mimeType};base64,${base64}`;

      const newImageState = await new Promise<ImageState>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
              setOriginalImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
              setResizeWidth(img.naturalWidth.toString());
              setResizeHeight(img.naturalHeight.toString());
              resolve({ id: `result-${Date.now()}`, dataUrl, mimeType, base64 });
          };
          img.onerror = () => reject(new Error("שגיאה בטעינת התמונה שנוצרה."));
          img.src = dataUrl;
      });

      setResultImage(newImageState);
      // setPrompt(''); // Keep prompt after generation

      const newCreation: Creation = {
        id: `creation-${Date.now()}`,
        image: newImageState,
        prompt: prompt.trim(),
        styles: selectedStyles,
        model: mode !== 'create' ? 'gemini-flash' : 'imagen',
        aspectRatio: mode === 'create' ? aspectRatio : undefined,
      };
      
      try {
        await addCreationToDB(newCreation);
        setCreations(prev => [newCreation, ...prev]);
      } catch (dbError) {
        console.error("Failed to save creation to DB", dbError);
        showToast("השמירה בגלריה נכשלה.");
        setCreations(prev => [newCreation, ...prev]);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "אירעה שגיאה לא ידועה.";
      if (errorMessage.includes('אימות נכשל') || errorMessage.includes('API key not valid')) {
        setHasSelectedApiKey(false);
        setValidManualApiKey(null);
        localStorage.removeItem('gemini-studio-manual-key');
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const dragCounter = useRef(0);
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleAddImages(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  }, [handleAddImages]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleAddImages(e.target.files);
    if (e.target) {
        e.target.value = '';
    }
  };

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newWidth = e.target.value;
    setResizeWidth(newWidth);
    if (keepAspectRatio && originalImageDimensions) {
      const numWidth = parseInt(newWidth, 10);
      if (!isNaN(numWidth) && numWidth > 0) {
        const ratio = originalImageDimensions.height / originalImageDimensions.width;
        const newHeight = Math.round(numWidth * ratio);
        setResizeHeight(newHeight.toString());
      }
    }
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHeight = e.target.value;
    setResizeHeight(newHeight);
    if (keepAspectRatio && originalImageDimensions) {
      const numHeight = parseInt(newHeight, 10);
      if (!isNaN(numHeight) && numHeight > 0) {
        const ratio = originalImageDimensions.width / originalImageDimensions.height;
        const newWidth = Math.round(numHeight * ratio);
        setResizeWidth(newWidth.toString());
      }
    }
  };
  
  const handleKeepAspectRatioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    setKeepAspectRatio(isChecked);
    if (isChecked && originalImageDimensions) {
        const numWidth = parseInt(resizeWidth, 10);
        if (!isNaN(numWidth) && numWidth > 0) {
            const ratio = originalImageDimensions.height / originalImageDimensions.width;
            const newHeight = Math.round(numWidth * ratio);
            setResizeHeight(newHeight.toString());
        }
    }
  };

  const applyCanvasChange = async (getCanvas: () => Promise<HTMLCanvasElement>) => {
    if (!resultImage) return;

    if(resultImage) setEditHistory(prev => [...prev, resultImage]);

    try {
        const canvas = await getCanvas();
        const editedDataUrl = canvas.toDataURL(resultImage.mimeType);
        const editedBase64 = editedDataUrl.split(',')[1];
        const newImageState = { ...resultImage, dataUrl: editedDataUrl, base64: editedBase64 };

        const img = new Image();
        img.onload = () => {
            setResultImage(newImageState);
            setOriginalImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            setResizeWidth(img.naturalWidth.toString());
            setResizeHeight(img.naturalHeight.toString());
        }
        img.src = editedDataUrl;
    } catch (err) {
        setError(err instanceof Error ? err.message : "אירעה שגיאה בעת החלת העריכות.");
        setEditHistory(prev => prev.slice(0, -1)); // Revert history on error
    }
  };

  const handleResize = async () => {
    const width = parseInt(resizeWidth, 10);
    const height = parseInt(resizeHeight, 10);

    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      setError("רוחב וגובה חייבים להיות מספרים חיוביים.");
      return;
    }

    setIsResizing(true);
    setError(null);
    await applyCanvasChange(() => new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject("לא ניתן היה לקבל את קונטקסט הציור של הקנבס.");
        
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas);
        };
        img.onerror = reject;
        img.src = resultImage!.dataUrl;
    }));
    setIsResizing(false);
  };
  
  const handleAdjustmentChange = (name: keyof Adjustment, value: string) => {
    setAdjustments(prev => ({...prev, [name]: parseInt(value, 10) }));
  };
  
  const handleResetEdits = () => {
    setAdjustments(INITIAL_ADJUSTMENTS);
  };
  
  const handleApplyEdits = async () => {
    setIsApplyingEdits(true);
    setError(null);
    await applyCanvasChange(() => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject("לא ניתן היה לקבל את קונטקסט הציור של הקנבס.");
            
            ctx.filter = generateFilterString(adjustments);
            ctx.drawImage(img, 0, 0);
            resolve(canvas);
        };
        img.onerror = reject;
        img.crossOrigin = 'anonymous';
        img.src = resultImage!.dataUrl;
    }));
    setAdjustments(INITIAL_ADJUSTMENTS);
    setIsApplyingEdits(false);
  };

  const handleApplyInpainting = async () => {
    if (!resultImage || !inpaintingPrompt.trim()) return;
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    // Check if mask is empty
    const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    if (!imageData.data.some(channel => channel !== 0)) {
        showToast("אנא ציירו מסכה על האזור לעריכה.");
        return;
    }

    setIsApplyingInpainting(true);
    setError(null);

    // Create a new canvas for the final mask (black background, white drawing)
    const finalMaskCanvas = document.createElement('canvas');
    finalMaskCanvas.width = maskCanvas.width;
    finalMaskCanvas.height = maskCanvas.height;
    const finalMaskCtx = finalMaskCanvas.getContext('2d');
    if (!finalMaskCtx) {
        setError("לא ניתן היה ליצור קנבס למסכה.");
        setIsApplyingInpainting(false);
        return;
    }

    finalMaskCtx.fillStyle = 'black';
    finalMaskCtx.fillRect(0, 0, finalMaskCanvas.width, finalMaskCanvas.height);
    finalMaskCtx.drawImage(maskCanvas, 0, 0);

    const maskDataUrl = finalMaskCanvas.toDataURL('image/png');
    const maskBase64 = maskDataUrl.split(',')[1];
    const maskImage = { base64: maskBase64, mimeType: 'image/png' };

    if(resultImage) setEditHistory(prev => [...prev, resultImage]);

    try {
        const result = await generateInpaintingFromImagesAndPrompt(
            resultImage,
            maskImage,
            inpaintingPrompt,
            validManualApiKey ?? undefined
        );
        
        const { base64, mimeType } = result;
        const dataUrl = `data:${mimeType};base64,${base64}`;

        const newImageState = await new Promise<ImageState>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                setOriginalImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                setResizeWidth(img.naturalWidth.toString());
                setResizeHeight(img.naturalHeight.toString());
                resolve({ id: `result-${Date.now()}`, dataUrl, mimeType, base64 });
            };
            img.onerror = () => reject(new Error("שגיאה בטעינת התמונה הערוכה."));
            img.src = dataUrl;
        });

        setResultImage(newImageState);
        handleClearMask();
        setInpaintingPrompt('');

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "אירעה שגיאה לא ידועה.";
        setError(errorMessage);
        setEditHistory(prev => prev.slice(0, -1)); // Revert history on error
    } finally {
        setIsApplyingInpainting(false);
    }
  };

  const handleUndo = () => {
      if(editHistory.length === 0) return;
      const lastState = editHistory[editHistory.length-1];
      setResultImage(lastState);
      setEditHistory(prev => prev.slice(0, -1));
      
      const img = new Image();
      img.onload = () => {
        setOriginalImageDimensions({width: img.naturalWidth, height: img.naturalHeight});
        setResizeWidth(img.naturalWidth.toString());
        setResizeHeight(img.naturalHeight.toString());
      }
      img.src = lastState.dataUrl;

      showToast("הפעולה האחרונה בוטלה");
  };

  const handleSetResolution = (width: number, height: number) => {
    setResizeWidth(width.toString());
    setResizeHeight(height.toString());
    setKeepAspectRatio(false);
    showToast(`הרזולוציה הוגדרה ל-${width}x${height}`);
  };

  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    const files = event.clipboardData?.files;
    if (files && files.length > 0) {
      const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
      if(imageFiles.length > 0) {
        event.preventDefault();
        await handleAddImages(event.clipboardData.files);
      }
    }
  }, [handleAddImages]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => {
        window.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);
  
  const handleAnalyzePrompt = async () => {
    if (!prompt.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    setPromptSuggestions([]);
    setError(null);
    try {
        const suggestions = await analyzePromptWithGemini(prompt, validManualApiKey ?? undefined);
        setPromptSuggestions(suggestions);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "ניתוח ההנחיה נכשל.";
        if (errorMessage.includes('אימות נכשל') || errorMessage.includes('API key not valid')) {
            setHasSelectedApiKey(false);
            setValidManualApiKey(null);
            localStorage.removeItem('gemini-studio-manual-key');
        }
        setError(errorMessage);
        showToast("ניתוח ההנחיה נכשל");
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleUseGalleryImageAsSource = (creation: Creation) => {
    setSourceImages(prev => [...prev, creation.image]);
    setIsGalleryOpen(false);
    showToast("התמונה מהגלריה הוספה למקור");
  };

  const handleDownloadGalleryImage = (creation: Creation) => {
    const link = document.createElement('a');
    link.href = creation.image.dataUrl;
    const extension = creation.image.mimeType.split('/')[1] || 'png';
    link.download = `gemini-creation-${creation.id}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("התמונה הורדה מהגלריה");
  };

  const handleCopyPrompt = (creation: Creation) => {
    const fullPrompt = `${creation.prompt} ${creation.styles.map(s => STYLES[s]).join(', ')}`.trim();
    navigator.clipboard.writeText(fullPrompt);
    showToast("ההנחיה הועתקה ללוח");
  };

  const handleDeleteCreation = async (id: string) => {
    try {
        await deleteCreationFromDB(id);
        setCreations(prev => prev.filter(c => c.id !== id));
        showToast("היצירה נמחקה מהגלריה");
    } catch (error) {
        console.error("Failed to delete creation from DB", error);
        showToast("מחיקת היצירה נכשלה.");
    }
  };

  const handleClearManualKey = useCallback(() => {
    setValidManualApiKey(null);
    setManualApiKeyInput('');
    localStorage.removeItem('gemini-studio-manual-key');
    setError(null);
    showToast("המפתח הידני נמחק.");
  }, [showToast]);

  const handleSelectKey = async () => {
    setApiKeySelectionInProgress(true);
    setError(null);
    try {
      // @ts-ignore
      await window.aistudio.openSelectKey();
       // @ts-ignore
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setHasSelectedApiKey(hasKey);
      if (hasKey) {
          handleClearManualKey();
          setIsManagingKey(false);
      }
    } catch (e) {
      console.error("Error during API key selection:", e);
      setError("אירעה שגיאה בתהליך בחירת מפתח ה-API.");
      setHasSelectedApiKey(false);
    } finally {
      setApiKeySelectionInProgress(false);
    }
  };

  const handleVerifyAndSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualApiKeyInput.trim()) {
        setError("אנא הכנס מפתח API.");
        return;
    }
    setIsVerifyingKey(true);
    setError(null);
    try {
        await validateApiKey(manualApiKeyInput);
        setValidManualApiKey(manualApiKeyInput);
        localStorage.setItem('gemini-studio-manual-key', manualApiKeyInput);
        showToast("מפתח ה-API נשמר ואומת בהצלחה!");
        setHasSelectedApiKey(false);
        setIsManagingKey(false);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "אירעה שגיאה לא ידועה באימות המפתח.";
        setError(errorMessage);
        setValidManualApiKey(null);
        localStorage.removeItem('gemini-studio-manual-key');
    } finally {
        setIsVerifyingKey(false);
    }
  };


  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = { role: 'user' as const, text: chatInput };
    const newHistory = [...chatHistory, userMessage];
    setChatHistory(newHistory);
    setChatInput('');
    setIsChatLoading(true);

    try {
        const responseText = await generateChatResponse(newHistory, isThinkingMode, validManualApiKey ?? undefined);
        const modelMessage = { role: 'model' as const, text: responseText };
        setChatHistory(prev => [...prev, modelMessage]);
    } catch (err) {
        console.error("Chat error:", err);
        const errorMessage = err instanceof Error ? err.message : "אירעה שגיאה בצ'אט.";
        if (errorMessage.includes('אימות נכשל') || errorMessage.includes('API key not valid')) {
            setHasSelectedApiKey(false);
            setValidManualApiKey(null);
            localStorage.removeItem('gemini-studio-manual-key');
        }
        const errorResponseMessage = { role: 'model' as const, text: `שגיאה: ${errorMessage}`};
        setChatHistory(prev => [...prev, errorResponseMessage]);
        showToast("התגובה מהצ'אט נכשלה.");
    } finally {
        setIsChatLoading(false);
    }
  };

  const handleResetZoomAndPan = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  
  const handleDrawOnMask = () => {
    if (!isMaskDrawn) {
        setIsMaskDrawn(true);
    }
  };

  const handleCursorMove = (e: React.MouseEvent) => {
      if (activeTool === 'inpaint' && resultImage) {
        setBrushCursor({ visible: true, x: e.clientX, y: e.clientY });
      } else {
        handleCursorLeave();
      }
  };

  const handleCursorLeave = () => {
    setBrushCursor({ visible: false, x: 0, y: 0 });
  };



  const sourceCount = sourceImages.length;
  const isBusy = isLoading || isResizing || isApplyingEdits || isAnalyzing || isApplyingInpainting;
  
  if (isCheckingApiKey) {
      return (
        <div className="flex items-center justify-center min-h-screen">
            <SpinnerIcon className="h-12 w-12 text-purple-400 animate-spin" />
        </div>
      );
  }

  if (!isKeyConfigured || isManagingKey) {
    return (
        <div className="bg-transparent text-slate-200 min-h-screen flex items-center justify-center p-4">
             <main className="container mx-auto max-w-4xl px-4 py-8">
                 <div className="text-center bg-slate-900/50 backdrop-blur-xl p-8 sm:p-12 rounded-2xl shadow-2xl shadow-black ring-1 ring-slate-400/20">
                     <KeyIcon className="mx-auto h-12 w-12 text-slate-500 mb-4" />
                     <h1 className="text-3xl font-bold text-slate-200 bg-clip-text text-transparent bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500">נדרש מפתח API של Gemini</h1>
                     <p className="mt-2 text-slate-400 max-w-2xl mx-auto">
                         כדי ליצור ולערוך תמונות, יש לספק מפתח API מפרויקט Google Cloud עם חיובים פעילים.
                         <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline mx-1">למידע נוסף על חיובים</a>.
                     </p>
                     
                     <div className="grid md:grid-cols-2 gap-6 items-start mt-8 text-left">
                         {/* Option 1: aistudio */}
                         <div className="bg-slate-800/50 p-6 rounded-xl ring-1 ring-slate-700 h-full flex flex-col">
                             <h3 className="text-lg font-semibold text-cyan-400">אפשרות 1: בחר מפתח (מומלץ)</h3>
                             <p className="text-sm text-slate-400 mt-2 mb-4 flex-grow">השתמש בדיאלוג המובנה כדי לבחור מפתח קיים מהפרויקט שלך. זו הדרך המהירה והקלה ביותר.</p>
                             <button
                                 onClick={handleSelectKey}
                                 disabled={apiKeySelectionInProgress}
                                 className="w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-semibold rounded-md shadow-lg text-white bg-gradient-to-br from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 focus:ring-offset-slate-900 disabled:opacity-50"
                             >
                                 {apiKeySelectionInProgress ? <SpinnerIcon className="h-5 w-5 mr-2 animate-spin" /> : <KeyIcon className="h-5 w-5 mr-2" />}
                                 {apiKeySelectionInProgress ? 'ממתין לבחירה...' : 'בחר מפתח API'}
                             </button>
                         </div>
 
                         {/* Option 2: Manual entry */}
                         <div className="bg-slate-800/50 p-6 rounded-xl ring-1 ring-slate-700 h-full flex flex-col">
                             <h3 className="text-lg font-semibold text-purple-400">אפשרות 2: הזן מפתח ידנית</h3>
                             <p className="text-sm text-slate-400 mt-2 mb-4 flex-grow">הדבק מפתח API שנוצר ב-Google AI Studio. המפתח יישמר בדפדפן שלך.</p>
                             {validManualApiKey ? (
                                <div className="space-y-3">
                                    <p className="text-sm text-green-400 flex items-center"><CheckIcon className="h-4 w-4 mr-2"/>מפתח API ידני שמור ופעיל.</p>
                                    <button onClick={handleClearManualKey}
                                     className="w-full inline-flex justify-center items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-300 bg-slate-700/50 hover:bg-slate-600/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-slate-900">
                                        <TrashIcon className="h-4 w-4 mr-2"/> מחק מפתח שמור
                                     </button>
                                </div>
                             ) : (
                                <form onSubmit={handleVerifyAndSaveKey} className="flex items-center gap-2">
                                     <input
                                         type="password"
                                         value={manualApiKeyInput}
                                         onChange={(e) => setManualApiKeyInput(e.target.value)}
                                         placeholder="הדבק את מפתח ה-API כאן"
                                         className="flex-grow bg-slate-900/50 border-slate-700 rounded-md shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm text-slate-200 placeholder-slate-500"
                                         disabled={isVerifyingKey}
                                     />
                                     <button
                                         type="submit"
                                         disabled={isVerifyingKey}
                                         className="inline-flex justify-center items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-200 bg-slate-700/50 hover:bg-slate-600/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 focus:ring-offset-slate-900 disabled:opacity-50"
                                     >
                                         {isVerifyingKey ? <SpinnerIcon className="h-4 w-4 animate-spin"/> : <CheckIcon className="h-4 w-4"/>}
                                     </button>
                                 </form>
                             )}
                         </div>
                     </div>
 
                     {error && (
                         <div className="mt-6 text-sm text-red-400 bg-red-900/30 px-3 py-2 rounded-md ring-1 ring-red-700/50 whitespace-pre-wrap">{error}</div>
                     )}
                     
                     {isKeyConfigured && (
                        <button onClick={() => setIsManagingKey(false)} className="mt-8 inline-flex items-center text-sm text-slate-400 hover:text-slate-200">
                            <ArrowUturnLeftIcon className="h-4 w-4 mr-2" />
                            חזור לאפליקציה
                        </button>
                     )}
                 </div>
             </main>
        </div>
    );
 }

  return (
    <div className={`h-screen w-screen flex flex-col text-slate-200 ${isLoading ? 'is-loading' : ''}`} onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {/* Custom Brush Cursor */}
      {brushCursor.visible && (
        <div
            className="fixed pointer-events-none rounded-full border-2 border-white bg-black/30 -translate-x-1/2 -translate-y-1/2 z-[1002] transition-all duration-75"
            style={{
                left: brushCursor.x,
                top: brushCursor.y,
                width: brushSize,
                height: brushSize,
            }}
        />
      )}
      
      {/* Header */}
      <header className="flex-shrink-0 h-[64px] flex items-center justify-between px-6 bg-slate-950/50 backdrop-blur-lg border-b border-slate-400/20 z-[60] shadow-2xl shadow-black/50">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500">
            סטודיו התמונות של Gemini
          </h1>
        </div>

        {/* Mode Switcher */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 rounded-lg bg-black/20 p-1 ring-1 ring-slate-700">
            {(
                [
                    {key: 'create', label: 'צור', icon: SparklesIcon},
                    {key: 'edit', label: 'ערוך', icon: PencilIcon},
                    {key: 'combine', label: 'חבר', icon: Square2StackIcon},
                ] as const
            ).map(({key, label, icon: Icon}) => (
                <button
                    key={key}
                    onClick={() => setMode(key)}
                    disabled={isBusy}
                    className={`flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 disabled:opacity-50 ${
                        mode === key ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                </button>
            ))}
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => setIsGalleryOpen(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md text-slate-300 bg-slate-800/50 hover:bg-slate-700/50 ring-1 ring-slate-700 transition-colors">
            <Squares2X2Icon className="h-5 w-5"/>
            <span>גלריה ({creations.length})</span>
          </button>
          <button onClick={() => setIsManagingKey(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md text-slate-300 bg-slate-800/50 hover:bg-slate-700/50 ring-1 ring-slate-700 transition-colors" aria-label="נהל מפתח API">
              <KeyIcon className="h-5 w-5" />
          </button>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-grow relative overflow-hidden">
        <div className="absolute inset-0 p-8 pt-0 flex items-center justify-center">
             <CanvasDisplay 
                imageState={resultImage} 
                isLoading={isLoading || isApplyingInpainting} 
                adjustments={adjustments}
                zoom={zoom}
                pan={pan}
                onZoomChange={setZoom}
                onPanChange={setPan}
                onResetZoomAndPan={handleResetZoomAndPan}
                activeTool={activeTool}
                brushSize={brushSize}
                imageForInpaintingRef={imageForInpaintingRef}
                maskCanvasRef={maskCanvasRef}
                onDrawOnMask={handleDrawOnMask}
                onCursorMove={handleCursorMove}
                onCursorLeave={handleCursorLeave}
            />
        </div>
      </main>

      {/* Creation Panel (Right) */}
      <div id="creation-panel" className={`floating-panel left ${isCreationPanelOpen ? '' : 'hidden'}`}>
        <div className="floating-panel-content">
            <div className="flex-shrink-0 p-4 border-b border-white/10">
                <h2 className="text-xl font-semibold text-slate-200">יצירה ועריכה</h2>
            </div>
            <div className="flex-grow p-4 panel-scroll-content">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {mode !== 'create' && (
                        <div id="source-images-panel" className="relative">
                             {isDragging && (
                                <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center text-center p-4 z-10 border-2 border-dashed border-purple-500">
                                    <UploadIcon className="w-10 h-10 text-purple-400 mb-2 animate-bounce" />
                                    <p className="text-md font-semibold text-slate-200">שחררו את הקבצים כאן</p>
                                </div>
                            )}
                            <h3 className="text-sm font-semibold text-slate-300 mb-1">תמונות מקור ({sourceCount})</h3>
                            <p className="text-xs text-slate-500 mb-3">גררו קבצים, לחצו על '+' או הדביקו תמונה (Ctrl+V).</p>
                            <div className="grid grid-cols-4 gap-3 p-3 rounded-lg bg-black/20 transition-all duration-300 min-h-[90px]">
                                {sourceImages.map((image, index) => (
                                    <div key={image.id} className="aspect-square rounded-md overflow-hidden relative group shadow-md cursor-pointer" onClick={() => setPreviewImageIndex(index)}>
                                        <img src={image.dataUrl} alt="תמונת מקור" className="w-full h-full object-cover"/>
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <ArrowsPointingOutIcon className="h-6 w-6 text-white pointer-events-none" />
                                            <button onClick={(e) => { e.stopPropagation(); handleRemoveImage(image.id); }} className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white hover:bg-red-500 transition-colors z-10" aria-label="הסר תמונה">
                                                <XMarkIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/webp" disabled={isBusy} multiple/>
                                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isBusy} className="aspect-square rounded-md border-2 border-dashed border-slate-700 text-slate-500 flex flex-col items-center justify-center hover:bg-slate-800/50 hover:border-purple-500 hover:text-purple-400 transition-all duration-200 disabled:opacity-50" aria-label="הוספת תמונות">
                                    <PlusIcon className="h-6 w-6"/>
                                </button>
                            </div>
                        </div>
                    )}
                    
                    <div id="style-selector">
                        <label className="block text-sm font-semibold text-slate-300 mb-2">סגנון</label>
                         <div className="space-y-2">
                             {Object.entries(STYLE_CATEGORIES).map(([category, styles]) => (
                                 <details key={category} className="bg-black/20 rounded-lg" open={category === 'תנועות אמנותיות'}>
                                     <summary className="px-3 py-2 text-xs font-semibold text-slate-300 cursor-pointer flex justify-between items-center ring-1 ring-slate-700 rounded-lg">
                                         {category}
                                         <ChevronDownIcon className="h-4 w-4 transition-transform accordion-icon" />
                                     </summary>
                                     <div className="p-3 flex flex-wrap gap-2">
                                         {styles.map(styleKey => (
                                            <button key={styleKey} type="button" onClick={() => handleStyleClick(styleKey)} disabled={isBusy} className={`px-3 py-1 text-sm font-medium rounded-full transition-all duration-200 disabled:opacity-50 ${selectedStyles.includes(styleKey) ? 'text-white shadow-md ring-2 ring-purple-500 bg-gradient-to-r from-purple-600 to-pink-600' : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700/70 ring-1 ring-slate-700'}`}>
                                                {styleKey}
                                            </button>
                                         ))}
                                     </div>
                                 </details>
                             ))}
                         </div>
                    </div>

                    {mode === 'create' && (
                        <div>
                            <label className="block text-sm font-semibold text-slate-300 mb-2">יחס גובה-רוחב</label>
                            <div className="flex items-center gap-2 rounded-lg bg-black/20 p-1 ring-1 ring-slate-700">
                                {aspectRatios.map(({ value, label, icon: Icon }) => (
                                    <button key={value} type="button" onClick={() => setAspectRatio(value)} disabled={isBusy} aria-label={label} className={`flex-1 flex flex-col items-center justify-center p-2 text-xs font-semibold rounded-md transition-all duration-200 disabled:opacity-50 ${aspectRatio === value ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}>
                                        <Icon className="h-6 w-6 mb-1" />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label htmlFor="prompt" className="block text-sm font-semibold text-slate-300">{promptLabel}</label>
                            <button type="button" onClick={handleSurpriseMe} disabled={isBusy} className="flex items-center gap-1 text-sm text-pink-400 hover:text-pink-300 disabled:opacity-50 transition-colors" aria-label="הצע הנחיה אקראית">
                                <MagicWandIcon className="h-4 w-4" />
                                הפתיעו אותי
                            </button>
                        </div>
                        <textarea
                            id="prompt-textarea" name="prompt" rows={3}
                            className="mt-1 block w-full bg-slate-900/50 border-slate-700 rounded-md shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm text-slate-200 placeholder-slate-500"
                            placeholder={mode === 'create' ? "לדוגמה: 'אריה מלכותי עונד כתר'" : mode === 'edit' ? "לדוגמה: 'הוסף אפקט גרעיניות של סרט רטרו'" : "לדוגמה: 'הצב את האדם מהתמונה הראשונה ברקע של התמונה השנייה'"}
                            value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={isBusy}/>
                        <button id="prompt-analyzer-button" type="button" onClick={handleAnalyzePrompt} disabled={isBusy || !prompt.trim()} className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 disabled:opacity-50 transition-colors mt-2" aria-label="נתח הנחיה">
                            {isAnalyzing ? <SpinnerIcon className="h-4 w-4 animate-spin"/> : <BeakerIcon className="h-4 w-4" />}
                            {isAnalyzing ? 'מנתח...' : 'נתח וחדד הנחיה'}
                        </button>

                        {promptSuggestions.length > 0 && (
                            <div className="space-y-2 mt-2">
                                <div className="flex flex-wrap gap-2">
                                    {promptSuggestions.map((suggestion, index) => (
                                        <button key={index} type="button" onClick={() => setPrompt(prev => `${prev}, ${suggestion}`)} className="px-2.5 py-1 text-xs bg-slate-800/70 text-slate-300 rounded-full hover:bg-slate-700/70 ring-1 ring-slate-700">
                                            + {suggestion}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </form>
            </div>
            <div className="flex-shrink-0 p-4 border-t border-white/10 mt-auto">
                 {error && (
                    <div className="mb-4 bg-red-900/30 backdrop-blur-md border border-red-700/50 text-red-300 px-4 py-3 rounded-xl text-sm" role="alert">
                        <div className="whitespace-pre-wrap"><span className="font-bold">שגיאה:</span> {error}</div>
                    </div>
                )}
                <div className="flex items-center gap-4">
                    <button id="generate-button" type="submit" onClick={handleSubmit} disabled={isBusy || !isSubmittable} className="flex-grow inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-semibold rounded-md shadow-lg text-white bg-gradient-to-br from-cyan-500 via-purple-600 to-pink-600 hover:shadow-purple-500/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 focus:ring-offset-slate-900 disabled:bg-slate-600 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed transition-all duration-200 disabled:shadow-none">
                        {isLoading ? <><SpinnerIcon className="animate-spin -mr-1 ml-3 h-5 w-5" />מעבד...</> : <><SparklesIcon className="-mr-1 ml-2 h-5 w-5" />{buttonText}</>}
                    </button>
                    <button type="button" onClick={handleReset} disabled={isBusy} aria-label="איפוס" className="p-3 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-300 bg-slate-700/50 hover:bg-slate-600/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-slate-900 disabled:opacity-50 transition-colors">
                        <TrashIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* Editing Panel (Left) */}
       <div id="result-panel" className={`floating-panel right ${resultImage && !isLoading ? '' : 'hidden'}`}>
            <div className="floating-panel-content">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h2 className="text-xl font-semibold text-slate-200">כלים</h2>
                    <button onClick={handleUndo} disabled={editHistory.length === 0 || isBusy} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-slate-700/50 hover:bg-slate-600/50 ring-1 ring-slate-600 disabled:opacity-50">
                        <ArrowUturnLeftIcon className="h-4 w-4" />
                        <span>בטל</span>
                    </button>
                </div>
                <div className="flex-grow p-4 panel-scroll-content">
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={handleDownload} disabled={isBusy} className="inline-flex justify-center items-center px-4 py-2.5 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-200 bg-slate-700/50 hover:bg-slate-600/50 disabled:opacity-50 transition-colors">
                            <DownloadIcon className="h-5 w-5 mr-2" />
                            <span>הורדה</span>
                        </button>
                        <button onClick={handleUseAsSource} disabled={isBusy} className="inline-flex justify-center items-center px-4 py-2.5 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-200 bg-slate-700/50 hover:bg-slate-600/50 disabled:opacity-50 transition-colors">
                            <ArrowPathIcon className="h-5 w-5 mr-2" />
                            <span>השתמש כמקור</span>
                        </button>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/10">
                         <div className="flex border-b border-slate-700 mb-4">
                            <button onClick={() => setActiveTool('resize')} className={`flex-1 text-sm font-semibold py-2 transition-all duration-200 rounded-t-md border-b-2 flex items-center justify-center gap-2 ${activeTool === 'resize' ? 'text-purple-300 border-purple-400 bg-purple-500/10' : 'text-slate-400 border-transparent hover:text-slate-100 hover:bg-slate-800/50'}`}>
                                <ArrowsPointingOutIcon className="h-4 w-4" />
                                <span>שינוי גודל</span>
                            </button>
                             <button onClick={() => setActiveTool('edit')} className={`flex-1 text-sm font-semibold py-2 transition-all duration-200 rounded-t-md border-b-2 flex items-center justify-center gap-2 ${activeTool === 'edit' ? 'text-purple-300 border-purple-400 bg-purple-500/10' : 'text-slate-400 border-transparent hover:text-slate-100 hover:bg-slate-800/50'}`}>
                                <AdjustmentsHorizontalIcon className="h-4 w-4" />
                                <span>עריכה</span>
                            </button>
                            <button onClick={() => setActiveTool('inpaint')} className={`flex-1 text-sm font-semibold py-2 transition-all duration-200 rounded-t-md border-b-2 flex items-center justify-center gap-2 ${activeTool === 'inpaint' ? 'text-purple-300 border-purple-400 bg-purple-500/10' : 'text-slate-400 border-transparent hover:text-slate-100 hover:bg-slate-800/50'}`}>
                                <PaintBrushIcon className="h-4 w-4" />
                                <span>עריכת קסם</span>
                            </button>
                        </div>
                        {activeTool === 'resize' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label htmlFor="resize-width" className="block text-xs font-medium text-slate-400 mb-1 text-center">רוחב (px)</label>
                                        <input id="resize-width" type="number" value={resizeWidth} onChange={handleWidthChange} className="w-full bg-slate-900/50 border-white/10 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm text-slate-200 placeholder-slate-500 text-center" aria-label="רוחב" min="1" disabled={isResizing} />
                                    </div>
                                    <div>
                                        <label htmlFor="resize-height" className="block text-xs font-medium text-slate-400 mb-1 text-center">גובה (px)</label>
                                        <input id="resize-height" type="number" value={resizeHeight} onChange={handleHeightChange} className="w-full bg-slate-900/50 border-white/10 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm text-slate-200 placeholder-slate-500 text-center" aria-label="גובה" min="1" disabled={isResizing} />
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mt-3 mb-2">קביעות מוגדרות מראש (16:9)</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button type="button" onClick={() => handleSetResolution(1280, 720)} disabled={isResizing} className="px-2 py-1.5 text-sm font-semibold rounded-md bg-slate-800/70 text-slate-300 hover:bg-slate-700/70 ring-1 ring-slate-700 disabled:opacity-50">
                                            720p
                                        </button>
                                        <button type="button" onClick={() => handleSetResolution(1920, 1080)} disabled={isResizing} className="px-2 py-1.5 text-sm font-semibold rounded-md bg-slate-800/70 text-slate-300 hover:bg-slate-700/70 ring-1 ring-slate-700 disabled:opacity-50">
                                            1080p
                                        </button>
                                        <button type="button" onClick={() => handleSetResolution(3840, 2160)} disabled={isResizing} className="px-2 py-1.5 text-sm font-semibold rounded-md bg-slate-800/70 text-slate-300 hover:bg-slate-700/70 ring-1 ring-slate-700 disabled:opacity-50">
                                            4K
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center pt-2">
                                    <input id="keep-aspect-ratio" type="checkbox" checked={keepAspectRatio} onChange={handleKeepAspectRatioChange} className="h-4 w-4 rounded border-slate-600 bg-slate-800/50 text-purple-500 focus:ring-purple-500" disabled={isResizing}/>
                                    <label htmlFor="keep-aspect-ratio" className="mr-2 text-sm text-slate-400">שמור על יחס גובה-רוחב</label>
                                </div>
                                <button onClick={handleResize} disabled={isResizing} className="w-full inline-flex justify-center items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-200 bg-slate-700/50 hover:bg-slate-600/50 disabled:opacity-50 transition-colors">
                                    {isResizing ? ( <><SpinnerIcon className="animate-spin -ml-1 mr-2 h-4 w-4" />משנה גודל...</> ) : 'שנה גודל'}
                                </button>
                            </div>
                        )}
                        {activeTool === 'edit' && (
                             <div className="space-y-4">
                                <h3 className="text-sm font-medium text-slate-300">פילטרים</h3>
                                <div className="grid grid-cols-5 gap-2">
                                    {Object.entries(FILTERS).map(([name, adj]) => (
                                        <button key={name} onClick={() => setAdjustments(adj)} disabled={isApplyingEdits} className="text-center group disabled:opacity-50">
                                            <div className={`w-full aspect-square rounded-md bg-slate-700 overflow-hidden ring-2 transition-all ${JSON.stringify(adj) === JSON.stringify(adjustments) ? 'ring-purple-400' : 'ring-slate-600 group-hover:ring-purple-500'}`}>
                                                 {resultImage && <img src={resultImage.dataUrl} alt={name} className="w-full h-full object-cover" style={{filter: generateFilterString(adj)}} />}
                                            </div>
                                            <span className="text-xs mt-1.5 block text-slate-400 group-hover:text-slate-200">{name}</span>
                                        </button>
                                    ))}
                                </div>
                                <h3 className="text-sm font-medium text-slate-300 pt-2">התאמות</h3>
                                <div className="space-y-3">
                                    <AdjustmentSlider label="בהירות" name="brightness" value={adjustments.brightness} min={0} max={200} onChange={handleAdjustmentChange} disabled={isApplyingEdits} />
                                    <AdjustmentSlider label="ניגודיות" name="contrast" value={adjustments.contrast} min={0} max={200} onChange={handleAdjustmentChange} disabled={isApplyingEdits} />
                                    <AdjustmentSlider label="רוויה" name="saturate" value={adjustments.saturate} min={0} max={200} onChange={handleAdjustmentChange} disabled={isApplyingEdits} />
                                    <AdjustmentSlider label="ספיה" name="sepia" value={adjustments.sepia} min={0} max={100} onChange={handleAdjustmentChange} disabled={isApplyingEdits} />
                                    <AdjustmentSlider label="שחור-לבן" name="grayscale" value={adjustments.grayscale} min={0} max={100} onChange={handleAdjustmentChange} disabled={isApplyingEdits} />
                                </div>

                                {isEditing && (
                                    <div className="flex gap-3 pt-2">
                                        <button onClick={handleApplyEdits} disabled={isApplyingEdits} className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition-colors">
                                            {isApplyingEdits ? <><SpinnerIcon className="animate-spin -ml-1 mr-2 h-4 w-4" />מחיל שינויים...</> : <><CheckIcon className="-ml-1 mr-2 h-4 w-4" />החל שינויים</>}
                                        </button>
                                         <button onClick={handleResetEdits} disabled={isApplyingEdits} className="w-full inline-flex justify-center items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-300 bg-slate-700/50 hover:bg-slate-600/50 disabled:opacity-50 transition-colors">
                                            <ArrowUturnLeftIcon className="-ml-1 mr-2 h-4 w-4" />
                                            אפס עריכות
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        {activeTool === 'inpaint' && (
                            <div className="space-y-4">
                                <p className="text-sm text-slate-400">ציירו על האזור בתמונה שברצונכם לשנות, ולאחר מכן תארו את השינוי.</p>
                                <div>
                                    <div className="flex justify-between items-center text-xs mb-1">
                                        <label htmlFor="brushSize" className="font-medium text-slate-300">גודל מברשת</label>
                                        <span className="text-slate-200 font-mono bg-slate-900/50 px-1.5 py-0.5 rounded-md">{brushSize}</span>
                                    </div>
                                    <input
                                        id="brushSize"
                                        type="range"
                                        min="10"
                                        max="100"
                                        value={brushSize}
                                        onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                        disabled={isApplyingInpainting}
                                        className="w-full h-2 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="inpainting-prompt" className="block text-sm font-semibold text-slate-300">הנחיה לעריכה</label>
                                    <textarea
                                        id="inpainting-prompt"
                                        rows={2}
                                        className="mt-1 block w-full bg-slate-900/50 border-slate-700 rounded-md shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm text-slate-200 placeholder-slate-500"
                                        placeholder="לדוגמה: 'הוסף ציפורים עפות'"
                                        value={inpaintingPrompt}
                                        onChange={(e) => setInpaintingPrompt(e.target.value)}
                                        disabled={isApplyingInpainting}
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                        <button onClick={handleApplyInpainting} disabled={isApplyingInpainting || !inpaintingPrompt.trim() || !isMaskDrawn} className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition-colors">
                                            {isApplyingInpainting ? <><SpinnerIcon className="animate-spin -ml-1 mr-2 h-4 w-4" />מעבד...</> : <><MagicWandIcon className="-ml-1 mr-2 h-4 w-4" />החל שינוי</>}
                                        </button>
                                         <button onClick={handleClearMask} disabled={isApplyingInpainting} className="w-full inline-flex justify-center items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-300 bg-slate-700/50 hover:bg-slate-600/50 disabled:opacity-50 transition-colors">
                                            <TrashIcon className="-ml-1 mr-2 h-4 w-4" />
                                            נקה מסכה
                                        </button>
                                    </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
       </div>

      {/* Gallery */}
       {isGalleryOpen && (
        <div className="fixed inset-0 z-[100] animate-fade-in" id="creations-gallery">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" onClick={() => setIsGalleryOpen(false)}></div>
            <div className="relative z-10 container mx-auto p-8 h-full flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold text-slate-200">גלריית יצירות ({creations.length})</h2>
                    <button onClick={() => setIsGalleryOpen(false)} className="p-2 text-slate-400 hover:text-white rounded-full bg-black/30">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>
                <div className="flex-grow overflow-y-auto pr-2 -mr-4">
                    {creations.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                            {creations.map(creation => (
                                <div key={creation.id} className="aspect-square rounded-xl overflow-hidden relative group shadow-lg transition-all duration-300 hover:ring-2 hover:ring-purple-500 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/30">
                                    <img src={creation.image.dataUrl} alt={`Creation ${creation.id}`} className="w-full h-full object-cover"/>
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 text-xs flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                        <p className="text-slate-200 font-semibold line-clamp-3 overflow-hidden mb-2">{creation.prompt || creation.styles.join(', ')}</p>
                                        <div className="flex justify-around items-center bg-slate-900/50 backdrop-blur-sm p-1 rounded-full">
                                            <button onClick={() => handleUseGalleryImageAsSource(creation)} className="p-1.5 text-slate-300 hover:text-cyan-400" title="השתמש כמקור"><ArrowPathIcon className="h-5 w-5"/></button>
                                            <button onClick={() => handleDownloadGalleryImage(creation)} className="p-1.5 text-slate-300 hover:text-green-400" title="הורדה"><DownloadIcon className="h-5 w-5"/></button>
                                            <button onClick={() => handleCopyPrompt(creation)} className="p-1.5 text-slate-300 hover:text-amber-400" title="העתק הנחיה"><ClipboardDocumentIcon className="h-5 w-5"/></button>
                                            <button onClick={() => handleDeleteCreation(creation.id)} className="p-1.5 text-slate-300 hover:text-red-400" title="מחק"><TrashIcon className="h-5 w-5"/></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                           <Squares2X2Icon className="w-16 h-16 mb-4"/>
                           <p>הגלריה שלך ריקה.</p>
                           <p className="text-sm">כל יצירה שלך תישמר כאן אוטומטית.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {showTutorial && <TutorialOverlay onClose={handleCloseTutorial} />}

      {previewImageIndex !== null && (
        <SourceImagePreview
            images={sourceImages}
            currentIndex={previewImageIndex}
            onClose={() => setPreviewImageIndex(null)}
            onNavigate={setPreviewImageIndex}
        />
      )}

      <div aria-live="polite" aria-atomic="true" className="fixed bottom-5 right-5 z-[200] flex flex-col items-end gap-2">
        {toasts.map(toast => (
          <div key={toast.id} className="bg-slate-800/80 backdrop-blur-md text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow-lg ring-1 ring-white/10 animate-fade-in-out">
            {toast.message}
          </div>
        ))}
        <style>{`
          @keyframes fade-in-out {
            0%, 100% { opacity: 0; transform: translateY(10px); }
            10%, 90% { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-out {
            animation: fade-in-out 3s ease-in-out forwards;
          }
          @keyframes welcome-pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.7); } /* purple-500 */
            70% { transform: scale(1.1); box-shadow: 0 0 0 20px rgba(168, 85, 247, 0); }
            100% { transform: scale(1); }
          }
          .animate-welcome-pulse {
            animation: welcome-pulse 2.5s ease-out 2;
          }
        `}</style>
      </div>
      
      {isKeyConfigured && !isChatOpen && (
        <button
            onClick={() => setIsChatOpen(true)}
            className="fixed bottom-5 right-5 z-[90] p-4 bg-gradient-to-br from-cyan-500 via-purple-600 to-pink-600 text-white rounded-full shadow-2xl hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 focus:ring-offset-slate-900 transition-transform animate-welcome-pulse"
            aria-label="פתח צ'אט"
        >
            <ChatBubbleLeftRightIcon className="h-8 w-8" />
        </button>
      )}

      {isKeyConfigured && (
        <ChatWindow
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            history={chatHistory}
            input={chatInput}
            onInputChange={(e) => setChatInput(e.target.value)}
            onSend={handleSendChatMessage}
            isLoading={isChatLoading}
            isThinkingMode={isThinkingMode}
            onThinkingModeChange={setIsThinkingMode}
        />
      )}

    </div>
  );
};

export default App;