
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
    validateApiKey
} from './services/geminiService';
import { 
    SpinnerIcon, SparklesIcon, UploadIcon, ArrowPathIcon, TrashIcon, DownloadIcon, MagicWandIcon, 
    AspectRatioSquareIcon, AspectRatioLandscapeIcon, AspectRatioPortraitIcon, AspectRatioFourThreeIcon, 
    AspectRatioThreeFourIcon, PlusIcon, XMarkIcon, ArrowsPointingOutIcon, AdjustmentsHorizontalIcon, 
    CheckIcon, ArrowUturnLeftIcon, BeakerIcon, ClipboardDocumentIcon, KeyIcon,
    ChatBubbleLeftRightIcon
} from './components/Icons';
import { ChatWindow } from './components/ChatWindow';

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
  'ללא': '',
  'פוטוריאליסטי': 'photorealistic, 8k, detailed, professional photography, sharp focus',
  'אנימה': 'anime style, vibrant colors, detailed characters, dynamic scenes, by Studio Ghibli',
  'פנטזיה': 'fantasy art, epic, magical, otherworldly, detailed, by Greg Rutkowski',
  'צבעי מים': 'watercolor painting, soft, blended colors, artistic, light wash',
  'צבע בשמן': 'oil painting, classic, rich textures, visible brushstrokes',
  'מדע בדיוני': 'sci-fi, futuristic, neon lights, cyberpunk aesthetic, high-tech',
  'קריקטורה': 'cartoon style, vibrant, playful, bold lines, cel-shaded',
  'פיקסל ארט': 'pixel art, 8-bit, retro gaming style, blocky, nostalgic',
  'מינימליסטי': 'minimalist, clean lines, simple shapes, limited color palette, uncluttered',
  'אמנות קו': 'line art, single line drawing, minimalist, black and white, elegant',
  'רינדור תלת-ממדי': '3D render, CGI, Octane render, high detail, realistic lighting, trending on ArtStation',
  'אימפרסיוניזם': 'impressionist painting, visible brushstrokes, light and color focus, by Claude Monet',
  'גותי': 'gothic style, dark, moody, intricate details, dramatic lighting, mysterious',
  'וינטג\'': 'vintage photo, retro, sepia tones, old-fashioned, film grain',
  'סטימפאנק': 'steampunk, gears, clockwork, Victorian aesthetic, brass and copper',
  'סוריאליסטי': 'surrealism, dream-like, bizarre, illogical scenes, by Salvador Dalí',
  'פופ ארט': 'pop art, bold colors, Ben-Day dots, comic book style, by Andy Warhol',
  'פלסטלינה': 'claymation style, stop-motion, plasticine, textured, handcrafted look',
  'זכוכית צבעונית': 'stained glass window, vibrant colors, leaded lines, intricate patterns',
  'אוריגמי': 'origami style, folded paper, geometric, clean, intricate folds',
  'חשיפה כפולה': 'double exposure, superimposed images, abstract, blended',
  'גרפיטי': 'graffiti art, street art, spray paint, vibrant, urban, tagging',
  'קולנועי': 'cinematic shot, anamorphic lens, dramatic lighting, shallow depth of field, color graded',
  'איזומטרי': 'isometric 3D, low-poly, clean, stylized, high angle view',
  'גליץ\' ארט': 'glitch art, databending, pixel sorting, digital artifacts, RGB shift',
  'הולוגרפי': 'holographic, neon, iridescent, glowing, futuristic interface',
  'שעת הזהב': 'golden hour photography, warm light, long shadows, soft focus',
  'רישום פחם': 'charcoal drawing, dramatic, rich shadows, textured paper',
  'סקיצה': 'pencil sketch, hand-drawn, authentic, graphite shading',
  'ארט נובו': 'art nouveau, elegant, flowing lines, nature-inspired, organic forms',
  'קוביזם': 'cubism, geometric shapes, multiple viewpoints, fragmented objects',
  'אמנות מופשטת': 'abstract art, non-representational, shapes, colors, emotions',
  'תחריט עץ': 'woodcut print, bold black lines, classic printmaking style, high contrast',
  'סולארפאנק': 'solarpunk, optimistic future, nature and technology in harmony, sustainable',
  'וייפורווייב': 'vaporwave, retro-futuristic aesthetic, 80s and 90s nostalgia, neon grids',
  'דיזלפאנק': 'dieselpunk, art deco, noir atmosphere, diesel-powered machinery',
  'שרטוט טכני': 'blueprint, technical drawing, architectural plan, white on blue',
  'אינפוגרפיקה': 'infographic, clean vector style, diagrams, data visualization',
  'ספר קומיקס': 'comic book style, bold outlines, vibrant flat colors, action lines',
  'ארט דקו': 'art deco style, geometric patterns, sleek lines, glamorous, 1920s',
  'באוהאוס': 'bauhaus style, functionalism, geometric shapes, primary colors, minimalist',
  'אוקיו-אה': 'ukiyo-e style, Japanese woodblock print, flat colors, bold outlines, by Hokusai',
  'רוקוקו': 'rococo painting, ornate, pastel colors, lighthearted, elegant, by Fragonard',
  'בארוק': 'baroque painting, dramatic, chiaroscuro, rich colors, emotional intensity, by Caravaggio',
  'פוינטיליזם': 'pointillism, small dots of color, vibrant, shimmering effect, by Georges Seurat',
  'פסיכדלי': 'psychedelic art, vibrant swirling colors, distorted patterns, 1960s counter-culture',
  'סינת\'ווייב': 'synthwave aesthetic, neon grids, 80s retro futurism, palm trees, sunset',
  'אקספרסיוניזם מופשט': 'abstract expressionism, spontaneous, energetic brushstrokes, non-representational, by Jackson Pollock',
  'אמנות שבטית': 'tribal art, indigenous patterns, symbolic, earthy tones',
  'אמנות קונספטואלית': 'conceptual art, idea-focused, minimalist, thought-provoking',
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
            className="w-full h-2 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-sky-400 disabled:opacity-50"
        />
    </div>
);

const ResultDisplay: React.FC<{
  imageState: ImageState | null;
  isLoading?: boolean;
  onDownload?: () => void;
  onUseAsSource?: () => void;
  isResizing: boolean;
  resizeWidth: string;
  resizeHeight: string;
  onWidthChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onHeightChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  keepAspectRatio: boolean;
  onKeepAspectRatioChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResize: () => void;
  adjustments: Adjustment;
  onAdjustmentChange: (adjustment: keyof Adjustment, value: string) => void;
  onSetAdjustments: (adjustments: Adjustment) => void;
  onApplyEdits: () => void;
  onResetEdits: () => void;
  isEditing: boolean;
  isApplyingEdits: boolean;
  activeTab: 'resize' | 'edit';
  onTabChange: (tab: 'resize' | 'edit') => void;
}> = ({
  imageState,
  isLoading = false,
  onDownload,
  onUseAsSource,
  isResizing,
  resizeWidth,
  resizeHeight,
  onWidthChange,
  onHeightChange,
  keepAspectRatio,
  onKeepAspectRatioChange,
  onResize,
  adjustments,
  onAdjustmentChange,
  onSetAdjustments,
  onApplyEdits,
  onResetEdits,
  isEditing,
  isApplyingEdits,
  activeTab,
  onTabChange
}) => {
    
  const filterString = useMemo(() => generateFilterString(adjustments), [adjustments]);
  const isBusy = isLoading || isResizing || isApplyingEdits;

  return (
    <div id="result-panel" className="bg-slate-900/50 backdrop-blur-xl p-4 rounded-2xl shadow-2xl flex flex-col h-full ring-1 ring-white/10">
      <h2 className="text-xl font-semibold text-slate-200 mb-4 pl-1">תוצאה</h2>
      <div className="flex-grow flex items-center justify-center bg-black/20 rounded-lg overflow-hidden aspect-square relative group transition-all duration-300">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-300 z-10">
            <SpinnerIcon className="animate-spin h-12 w-12 text-sky-400" />
            <p className="mt-4 text-sm text-slate-400">Gemini חושב...</p>
          </div>
        ) : imageState ? (
          <img
            src={imageState.dataUrl}
            alt="תוצאה"
            className="max-h-full max-w-full object-contain opacity-100 transition-opacity duration-500"
            style={{ filter: filterString }}
            key={imageState.dataUrl} // Force re-render on dataUrl change
          />
        ) : (
          <div className="text-center text-slate-500 px-6">
            <SparklesIcon className="mx-auto h-12 w-12" />
            <p className="mt-2 text-sm">התוצאה שלכם תופיע כאן.</p>
          </div>
        )}
      </div>

      {imageState && !isLoading && (
        <div className="grid grid-cols-2 gap-3 mt-4">
            <button
                onClick={onDownload}
                aria-label="הורדת תמונה"
                disabled={isBusy}
                className="inline-flex justify-center items-center px-4 py-2.5 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-200 bg-slate-700/50 hover:bg-slate-600/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <DownloadIcon className="h-5 w-5 mr-2" />
                <span>הורדה</span>
            </button>
            <button
                onClick={onUseAsSource}
                aria-label="השתמש כמקור"
                disabled={isBusy}
                className="inline-flex justify-center items-center px-4 py-2.5 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-200 bg-slate-700/50 hover:bg-slate-600/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <ArrowPathIcon className="h-5 w-5 mr-2" />
                <span>השתמש כמקור</span>
            </button>
        </div>
      )}

      {imageState && !isLoading && (
        <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex border-b border-white/10 mb-4">
                <button 
                    onClick={() => onTabChange('resize')}
                    className={`flex-1 text-sm font-medium py-2.5 transition-colors duration-200 ${activeTab === 'resize' ? 'text-sky-400 border-b-2 border-sky-400' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <ArrowsPointingOutIcon className="inline-block -mt-1 mr-2 h-4 w-4" />
                    שינוי גודל
                </button>
                 <button 
                    onClick={() => onTabChange('edit')}
                    className={`flex-1 text-sm font-medium py-2.5 transition-colors duration-200 ${activeTab === 'edit' ? 'text-sky-400 border-b-2 border-sky-400' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <AdjustmentsHorizontalIcon className="inline-block -mt-1 mr-2 h-4 w-4" />
                    עריכה
                </button>
            </div>

            {activeTab === 'resize' ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 items-center">
                        <input
                            type="number" value={resizeWidth} onChange={onWidthChange}
                            className="w-full bg-slate-900/50 border-white/10 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-slate-200 placeholder-slate-500 text-center"
                            aria-label="רוחב" min="1" disabled={isResizing} />
                        <input
                            type="number" value={resizeHeight} onChange={onHeightChange}
                            className="w-full bg-slate-900/50 border-white/10 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-slate-200 placeholder-slate-500 text-center"
                            aria-label="גובה" min="1" disabled={isResizing} />
                    </div>
                    <div className="flex items-center">
                        <input
                            id="keep-aspect-ratio" type="checkbox" checked={keepAspectRatio} onChange={onKeepAspectRatioChange}
                            className="h-4 w-4 rounded border-slate-600 bg-slate-800/50 text-sky-500 focus:ring-sky-500" disabled={isResizing}/>
                        <label htmlFor="keep-aspect-ratio" className="mr-2 text-sm text-slate-400">שמור על יחס גובה-רוחב</label>
                    </div>
                    <button onClick={onResize} disabled={isResizing}
                        className="w-full inline-flex justify-center items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-200 bg-slate-700/50 hover:bg-slate-600/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                        {isResizing ? ( <><SpinnerIcon className="animate-spin -ml-1 mr-2 h-4 w-4" />משנה גודל...</> ) : 'שנה גודל'}
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-slate-300">פילטרים</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {Object.entries(FILTERS).map(([name, adj]) => (
                            <button key={name} onClick={() => onSetAdjustments(adj)} disabled={isApplyingEdits}
                                className="text-center group disabled:opacity-50">
                                <div className={`w-full aspect-square rounded-md bg-slate-700 overflow-hidden ring-2 transition-all ${JSON.stringify(adj) === JSON.stringify(adjustments) ? 'ring-sky-400' : 'ring-slate-600 group-hover:ring-sky-500'}`}>
                                     <img src={imageState.dataUrl} alt={name} className="w-full h-full object-cover" style={{filter: generateFilterString(adj)}} />
                                </div>
                                <span className="text-xs mt-1.5 block text-slate-400 group-hover:text-slate-200">{name}</span>
                            </button>
                        ))}
                    </div>
                    
                    <h3 className="text-sm font-medium text-slate-300 pt-2">התאמות</h3>
                    <div className="space-y-3">
                        <AdjustmentSlider label="בהירות" name="brightness" value={adjustments.brightness} min={0} max={200} onChange={onAdjustmentChange} disabled={isApplyingEdits} />
                        <AdjustmentSlider label="ניגודיות" name="contrast" value={adjustments.contrast} min={0} max={200} onChange={onAdjustmentChange} disabled={isApplyingEdits} />
                        <AdjustmentSlider label="רוויה" name="saturate" value={adjustments.saturate} min={0} max={200} onChange={onAdjustmentChange} disabled={isApplyingEdits} />
                        <AdjustmentSlider label="ספיה" name="sepia" value={adjustments.sepia} min={0} max={100} onChange={onAdjustmentChange} disabled={isApplyingEdits} />
                        <AdjustmentSlider label="שחור-לבן" name="grayscale" value={adjustments.grayscale} min={0} max={100} onChange={onAdjustmentChange} disabled={isApplyingEdits} />
                    </div>

                    {isEditing && (
                        <div className="flex gap-3 pt-2">
                            <button onClick={onApplyEdits} disabled={isApplyingEdits}
                                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-500 hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                {isApplyingEdits ? <><SpinnerIcon className="animate-spin -ml-1 mr-2 h-4 w-4" />מחיל שינויים...</> : <><CheckIcon className="-ml-1 mr-2 h-4 w-4" />החל שינויים</>}
                            </button>
                             <button onClick={onResetEdits} disabled={isApplyingEdits}
                                className="w-full inline-flex justify-center items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-300 bg-slate-700/50 hover:bg-slate-600/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                <ArrowUturnLeftIcon className="-ml-1 mr-2 h-4 w-4" />
                                אפס עריכות
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
      )}
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

  // UX Features State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [promptSuggestions, setPromptSuggestions] = useState<string[]>([]);
  const [creations, setCreations] = useState<Creation[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(true);

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


  // Resize state
  const [originalImageDimensions, setOriginalImageDimensions] = useState<{width: number, height: number} | null>(null);
  const [resizeWidth, setResizeWidth] = useState<string>('');
  const [resizeHeight, setResizeHeight] = useState<string>('');
  const [keepAspectRatio, setKeepAspectRatio] = useState<boolean>(true);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  // Editing state
  const [adjustments, setAdjustments] = useState<Adjustment>(INITIAL_ADJUSTMENTS);
  const [isApplyingEdits, setIsApplyingEdits] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'resize' | 'edit'>('resize');
  
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
      // Check for manual key first
      const savedKey = localStorage.getItem('gemini-studio-manual-key');
      if (savedKey) {
        setValidManualApiKey(savedKey);
        setHasSelectedApiKey(false);
        setIsCheckingApiKey(false);
        return;
      }

      // Then check for aistudio key
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
          setHasSelectedApiKey(false); // Assume no key on error
        }
      } else {
        setHasSelectedApiKey(false);
      }
      setIsCheckingApiKey(false);
    };
    checkApiKey();
  }, [showToast]);

  // Load creations from IndexedDB on mount
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


  const aspectRatios: { value: AspectRatio; label: string; icon: React.FC<{className?: string}> }[] = [
    { value: '1:1', label: 'ריבוע', icon: AspectRatioSquareIcon },
    { value: '16:9', label: 'נוף', icon: AspectRatioLandscapeIcon },
    { value: '9:16', label: 'דיוקן', icon: AspectRatioPortraitIcon },
    { value: '4:3', label: '4:3', icon: AspectRatioFourThreeIcon },
    { value: '3:4', label: '3:4', icon: AspectRatioThreeFourIcon },
  ];
  
  const { buttonText, promptLabel, isSubmittable } = useMemo(() => {
    const sourceCount = sourceImages.length;
    const hasPrompt = prompt.trim() !== '';
    const hasStyles = selectedStyles.length > 0;

    let btnText, pLabel;
    
    if (sourceCount === 0) {
      if (hasStyles) {
        btnText = 'צור עם סגנון';
        pLabel = 'הוסף הנחיה (אופציונלי) לדיוק הסגנון';
      } else {
        btnText = 'צור תמונה';
        pLabel = 'הנחיה ליצירה';
      }
    } else {
      if (hasStyles && !hasPrompt) {
        btnText = 'החל סגנון';
        pLabel = 'הוסף הנחיה (אופציונלי) לדיוק הסגנון';
      } else {
        btnText = sourceCount === 1 ? 'החל עריכה' : 'חבר תמונות';
        pLabel = sourceCount === 1 ? 'הנחיה לעריכה' : 'איך לחבר את התמונות?';
      }
    }
    
    const submittable = hasPrompt || hasStyles;

    return { buttonText: btnText, promptLabel: pLabel, isSubmittable: submittable };
  }, [prompt, sourceImages.length, selectedStyles]);

  const handleStyleClick = (styleKey: StyleKey) => {
    if (styleKey === 'ללא') {
        setSelectedStyles([]);
        return;
    }
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
    setResultImage(null);
    setError(null);
  }, []);

  const handleRemoveImage = (id: string) => {
    setSourceImages(prev => prev.filter(img => img.id !== id));
  };
  
  const resetResultState = () => {
    setResultImage(null);
    setOriginalImageDimensions(null);
    setResizeWidth('');
    setResizeHeight('');
    setAdjustments(INITIAL_ADJUSTMENTS);
    setActiveTab('resize');
  };

  const handleUseAsSource = () => {
    if (resultImage) {
      setSourceImages(prev => [...prev, {...resultImage, id: `result-${Date.now()}`}]);
      resetResultState();
      showToast("התמונה הוספה למקור");
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

      if (sourceImages.length > 0) {
        const imagePayload = sourceImages.map(img => ({ base64: img.base64, mimeType: img.mimeType }));
        result = await generateFromImagesAndPrompt(imagePayload, finalPrompt, validManualApiKey ?? undefined);
      } else {
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

      const newCreation: Creation = {
        id: `creation-${Date.now()}`,
        image: newImageState,
        prompt: prompt.trim(),
        styles: selectedStyles,
        model: sourceImages.length > 0 ? 'gemini-flash' : 'imagen',
        aspectRatio: sourceImages.length === 0 ? aspectRatio : undefined,
      };
      
      try {
        await addCreationToDB(newCreation);
        setCreations(prev => [newCreation, ...prev]);
      } catch (dbError) {
        console.error("Failed to save creation to DB", dbError);
        showToast("השמירה בגלריה נכשלה.");
        setCreations(prev => [newCreation, ...prev]); // Optimistically update UI anyway
      }

      setPrompt('');

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

  const handleResize = async () => {
    if (!resultImage) return;

    const width = parseInt(resizeWidth, 10);
    const height = parseInt(resizeHeight, 10);

    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      setError("רוחב וגובה חייבים להיות מספרים חיוביים.");
      return;
    }

    setIsResizing(true);
    setError(null);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error("לא ניתן היה לקבל את קונטקסט הציור של הקנבס.");
      }
      ctx.imageSmoothingQuality = 'high';

      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height);
          const resizedDataUrl = canvas.toDataURL(resultImage.mimeType);
          const resizedBase64 = resizedDataUrl.split(',')[1];
          
          setResultImage(prev => prev ? { ...prev, dataUrl: resizedDataUrl, base64: resizedBase64 } : null);
          setOriginalImageDimensions({ width, height });
          resolve();
        };
        img.onerror = () => reject(new Error("שגיאה בטעינת התמונה המקורית לצורך שינוי גודל."));
        img.src = resultImage.dataUrl;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "אירעה שגיאה בשינוי גודל התמונה.");
    } finally {
      setIsResizing(false);
    }
  };
  
  const handleAdjustmentChange = (name: keyof Adjustment, value: string) => {
    setAdjustments(prev => ({...prev, [name]: parseInt(value, 10) }));
  };
  
  const handleResetEdits = () => {
    setAdjustments(INITIAL_ADJUSTMENTS);
  };
  
  const handleApplyEdits = async () => {
    if (!resultImage) return;

    setIsApplyingEdits(true);
    setError(null);

    try {
      const canvas = document.createElement('canvas');
      const img = new Image();
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error("לא ניתן היה לקבל את קונטקסט הציור של הקנבס."));
          }
          
          ctx.filter = generateFilterString(adjustments);
          ctx.drawImage(img, 0, 0);

          const editedDataUrl = canvas.toDataURL(resultImage.mimeType);
          const editedBase64 = editedDataUrl.split(',')[1];
          
          setResultImage(prev => prev ? { ...prev, dataUrl: editedDataUrl, base64: editedBase64 } : null);
          setAdjustments(INITIAL_ADJUSTMENTS);
          resolve();
        };
        img.onerror = () => reject(new Error("שגיאה בטעינת התמונה לצורך עריכה."));
        img.crossOrigin = 'anonymous';
        img.src = resultImage.dataUrl;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "אירעה שגיאה בעת החלת העריכות.");
    } finally {
      setIsApplyingEdits(false);
    }
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
          handleClearManualKey(); // Prioritize aistudio key if selected
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
        setHasSelectedApiKey(false); // Unset aistudio key preference
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


  const sourceCount = sourceImages.length;
  const isBusy = isLoading || isResizing || isApplyingEdits || isAnalyzing;
  
  if (isCheckingApiKey) {
      return (
        <div className="flex items-center justify-center min-h-screen">
            <SpinnerIcon className="h-12 w-12 text-sky-400 animate-spin" />
        </div>
      );
  }

  if (!isKeyConfigured || isManagingKey) {
    return (
        <div className="bg-transparent text-slate-200 min-h-screen flex items-center justify-center p-4">
             <main className="container mx-auto max-w-4xl px-4 py-8">
                 <div className="text-center bg-slate-900/50 backdrop-blur-xl p-8 sm:p-12 rounded-2xl shadow-2xl ring-1 ring-white/10">
                     <KeyIcon className="mx-auto h-12 w-12 text-slate-500 mb-4" />
                     <h1 className="text-3xl font-bold text-slate-200">נדרש מפתח API של Gemini</h1>
                     <p className="mt-2 text-slate-400 max-w-2xl mx-auto">
                         כדי ליצור ולערוך תמונות, יש לספק מפתח API מפרויקט Google Cloud עם חיובים פעילים.
                         <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline mx-1">למידע נוסף על חיובים</a>.
                     </p>
                     
                     <div className="grid md:grid-cols-2 gap-6 items-start mt-8 text-left">
                         {/* Option 1: aistudio */}
                         <div className="bg-slate-800/50 p-6 rounded-xl ring-1 ring-slate-700 h-full flex flex-col">
                             <h3 className="text-lg font-semibold text-sky-400">אפשרות 1: בחר מפתח (מומלץ)</h3>
                             <p className="text-sm text-slate-400 mt-2 mb-4 flex-grow">השתמש בדיאלוג המובנה כדי לבחור מפתח קיים מהפרויקט שלך. זו הדרך המהירה והקלה ביותר.</p>
                             <button
                                 onClick={handleSelectKey}
                                 disabled={apiKeySelectionInProgress}
                                 className="w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-semibold rounded-md shadow-lg text-white bg-gradient-to-br from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-slate-900 disabled:opacity-50"
                             >
                                 {apiKeySelectionInProgress ? <SpinnerIcon className="h-5 w-5 mr-2 animate-spin" /> : <KeyIcon className="h-5 w-5 mr-2" />}
                                 {apiKeySelectionInProgress ? 'ממתין לבחירה...' : 'בחר מפתח API'}
                             </button>
                         </div>
 
                         {/* Option 2: Manual entry */}
                         <div className="bg-slate-800/50 p-6 rounded-xl ring-1 ring-slate-700 h-full flex flex-col">
                             <h3 className="text-lg font-semibold text-violet-400">אפשרות 2: הזן מפתח ידנית</h3>
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
                                         className="flex-grow bg-slate-900/50 border-slate-700 rounded-md shadow-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 sm:text-sm text-slate-200 placeholder-slate-500"
                                         disabled={isVerifyingKey}
                                     />
                                     <button
                                         type="submit"
                                         disabled={isVerifyingKey}
                                         className="inline-flex justify-center items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-200 bg-slate-700/50 hover:bg-slate-600/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 focus:ring-offset-slate-900 disabled:opacity-50"
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
    <div className="bg-transparent text-slate-200 min-h-screen" onDragEnter={handleDragEnter}>
      <main className="container mx-auto max-w-7xl px-4 py-8 md:py-12">
        <header className="flex justify-between items-center mb-10">
          <div className="text-left">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-400">
              סטודיו התמונות של Gemini
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-slate-400">
              צרו תמונות חדשות, ערכו קיימות, או חברו מספר תמונות יחד בעזרת הנחיות טקסט.
            </p>
          </div>
          <button
              onClick={() => setIsManagingKey(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md text-slate-300 bg-slate-800/50 hover:bg-slate-700/50 ring-1 ring-slate-700 transition-colors"
              aria-label="נהל מפתח API"
          >
              <KeyIcon className="h-5 w-5" />
              <span>נהל מפתח API</span>
          </button>
        </header>

        <>
            <div className="grid lg:grid-cols-2 gap-8 items-start">
                <div className="flex flex-col gap-8">
                    <div id="source-images-panel" className="relative bg-slate-900/50 backdrop-blur-xl p-4 rounded-2xl shadow-2xl ring-1 ring-white/10"
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    >
                        {isDragging && (
                            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center text-center p-4 z-10 border-2 border-dashed border-sky-500 transition-all duration-300">
                                <UploadIcon className="w-12 h-12 text-sky-400 mb-4 animate-bounce" />
                                <p className="text-lg font-semibold text-slate-200">שחררו את הקבצים כאן</p>
                                <p className="text-sm text-slate-400">ניתן להוסיף קבצי PNG, JPG, או WEBP</p>
                            </div>
                        )}
                        <h2 className="text-xl font-semibold text-slate-200 mb-1 pl-1">תמונות מקור ({sourceCount})</h2>
                        <p className="text-xs text-slate-500 mb-3 pl-1">גררו קבצים, לחצו על '+' או הדביקו תמונה (Ctrl+V).</p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4 rounded-lg bg-black/20 transition-all duration-300 min-h-[120px]">
                            {sourceImages.map(image => (
                                <div key={image.id} className="aspect-square rounded-md overflow-hidden relative group shadow-md">
                                    <img src={image.dataUrl} alt="Source thumbnail" className="w-full h-full object-cover"/>
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button onClick={() => handleRemoveImage(image.id)} className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white hover:bg-red-500 transition-colors">
                                            <XMarkIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            accept="image/png, image/jpeg, image/webp"
                            disabled={isBusy}
                            multiple
                            />
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isBusy}
                                className="aspect-square rounded-md border-2 border-dashed border-slate-700 text-slate-500 flex flex-col items-center justify-center hover:bg-slate-800/50 hover:border-sky-500 hover:text-sky-400 transition-all duration-200 disabled:opacity-50"
                                aria-label="הוספת תמונות"
                            >
                                <PlusIcon className="h-8 w-8"/>
                                <span className="text-xs mt-1">הוסף</span>
                            </button>
                        </div>
                    </div>
                    
                    <div className="lg:hidden">
                        <ResultDisplay 
                        imageState={resultImage} 
                        isLoading={isLoading} 
                        onDownload={handleDownload} 
                        onUseAsSource={handleUseAsSource}
                        isResizing={isResizing}
                        resizeWidth={resizeWidth}
                        resizeHeight={resizeHeight}
                        onWidthChange={handleWidthChange}
                        onHeightChange={handleHeightChange}
                        keepAspectRatio={keepAspectRatio}
                        onKeepAspectRatioChange={handleKeepAspectRatioChange}
                        onResize={handleResize}
                        adjustments={adjustments}
                        onAdjustmentChange={handleAdjustmentChange}
                        onSetAdjustments={setAdjustments}
                        onApplyEdits={handleApplyEdits}
                        onResetEdits={handleResetEdits}
                        isEditing={isEditing}
                        isApplyingEdits={isApplyingEdits}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        />
                    </div>

                    <div className="w-full">
                    <form onSubmit={handleSubmit} className="space-y-6 bg-slate-900/50 backdrop-blur-xl p-6 rounded-2xl shadow-2xl ring-1 ring-white/10">
                        <div id="style-selector">
                        <label className="block text-sm font-semibold text-slate-300 mb-2">סגנון</label>
                        <div className="flex flex-wrap gap-2">
                            {Object.keys(STYLES).map((styleKey) => {
                            const isSelected = styleKey === 'ללא'
                                ? selectedStyles.length === 0
                                : selectedStyles.includes(styleKey as StyleKey);
                            
                            return (
                                <button
                                key={styleKey}
                                type="button"
                                onClick={() => handleStyleClick(styleKey as StyleKey)}
                                disabled={isBusy}
                                className={`px-3 py-1 text-sm font-medium rounded-full transition-all duration-200 disabled:opacity-50 ${
                                    isSelected
                                    ? 'bg-sky-500 text-white shadow-md ring-2 ring-sky-400'
                                    : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700/70 ring-1 ring-slate-700'
                                }`}
                                >
                                {styleKey}
                                </button>
                            );
                            })}
                        </div>
                        </div>

                        {sourceCount === 0 && (
                        <div>
                            <label className="block text-sm font-semibold text-slate-300 mb-2">יחס גובה-רוחב</label>
                            <div className="flex items-center gap-2 rounded-lg bg-black/20 p-1 ring-1 ring-slate-700">
                            {aspectRatios.map(({ value, label, icon: Icon }) => (
                                <button
                                key={value}
                                type="button"
                                onClick={() => setAspectRatio(value)}
                                disabled={isBusy}
                                aria-label={label}
                                className={`flex-1 flex flex-col items-center justify-center p-2 text-xs font-semibold rounded-md transition-all duration-200 disabled:opacity-50 ${
                                    aspectRatio === value
                                    ? 'bg-sky-600 text-white shadow-lg'
                                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                                }`}
                                >
                                <Icon className="h-6 w-6 mb-1" />
                                {label}
                                </button>
                            ))}
                            </div>
                        </div>
                        )}

                        <div>
                        <div className="flex justify-between items-center mb-1">
                            <label htmlFor="prompt" className="block text-sm font-semibold text-slate-300">
                            {promptLabel}
                            </label>
                            <div className="flex items-center gap-4">
                            <button
                                id="prompt-analyzer-button"
                                type="button"
                                onClick={handleAnalyzePrompt}
                                disabled={isBusy || !prompt.trim()}
                                className="flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300 disabled:opacity-50 transition-colors"
                                aria-label="נתח הנחיה"
                            >
                                {isAnalyzing ? <SpinnerIcon className="h-4 w-4 animate-spin"/> : <BeakerIcon className="h-4 w-4" />}
                                {isAnalyzing ? 'מנתח...' : 'נתח הנחיה'}
                            </button>
                            <button 
                                type="button"
                                onClick={handleSurpriseMe}
                                disabled={isBusy}
                                className="flex items-center gap-1 text-sm text-sky-400 hover:text-sky-300 disabled:opacity-50 transition-colors"
                                aria-label="הצע הנחיה אקראית"
                            >
                                <MagicWandIcon className="h-4 w-4" />
                                הפתיעו אותי
                            </button>
                            </div>
                        </div>
                        <textarea
                            id="prompt-textarea"
                            name="prompt"
                            rows={3}
                            className="mt-1 block w-full bg-slate-900/50 border-slate-700 rounded-md shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-slate-200 placeholder-slate-500"
                            placeholder={
                                sourceCount === 0 ? "לדוגמה: 'אריה מלכותי עונד כתר'" :
                                sourceCount === 1 ? "לדוגמה: 'הוסף אפקט גרעיניות של סרט רטרו'" :
                                "לדוגמה: 'הצב את האדם מהתמונה הראשונה ברקע של התמונה השנייה'"
                            }
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            disabled={isBusy}
                        />
                        </div>
                        {promptSuggestions.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-slate-400">הצעות לשיפור:</p>
                                <div className="flex flex-wrap gap-2">
                                    {promptSuggestions.map((suggestion, index) => (
                                        <button
                                            key={index}
                                            type="button"
                                            onClick={() => setPrompt(prev => `${prev}, ${suggestion}`)}
                                            className="px-2.5 py-1 text-xs bg-slate-800/70 text-slate-300 rounded-full hover:bg-slate-700/70 ring-1 ring-slate-700"
                                        >
                                            + {suggestion}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-4">
                        <button
                            id="generate-button"
                            type="submit"
                            disabled={isBusy || !isSubmittable}
                            className="flex-grow inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-semibold rounded-md shadow-lg text-white bg-gradient-to-br from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-slate-900 disabled:bg-slate-600 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed transition-all duration-200 disabled:shadow-none hover:shadow-sky-500/50 animate-pulse-slow disabled:animate-none"
                        >
                            {isLoading ? (
                            <>
                                <SpinnerIcon className="animate-spin -mr-1 ml-3 h-5 w-5" />
                                מעבד...
                            </>
                            ) : (
                            <>
                                <SparklesIcon className="-mr-1 ml-2 h-5 w-5" />
                                {buttonText}
                            </>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={handleReset}
                            disabled={isBusy}
                            aria-label="איפוס"
                            className="p-3 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-300 bg-slate-700/50 hover:bg-slate-600/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-slate-900 disabled:opacity-50 transition-colors"
                        >
                            <TrashIcon className="h-5 w-5" />
                        </button>
                        </div>
                    </form>
                    {error && (
                        <div className="mt-4 bg-red-900/30 backdrop-blur-md border border-red-700/50 text-red-300 px-4 py-3 rounded-xl text-sm transition-all duration-300 opacity-100" role="alert">
                            <div className="whitespace-pre-wrap"><span className="font-bold">שגיאה:</span> {error}</div>
                        </div>
                    )}
                    </div>

                </div>
                <div className="hidden lg:block lg:sticky lg:top-8">
                <ResultDisplay 
                    imageState={resultImage} 
                    isLoading={isLoading} 
                    onDownload={handleDownload} 
                    onUseAsSource={handleUseAsSource}
                    isResizing={isResizing}
                    resizeWidth={resizeWidth}
                    resizeHeight={resizeHeight}
                    onWidthChange={handleWidthChange}
                    onHeightChange={handleHeightChange}
                    keepAspectRatio={keepAspectRatio}
                    onKeepAspectRatioChange={handleKeepAspectRatioChange}
                    onResize={handleResize}
                    adjustments={adjustments}
                    onAdjustmentChange={handleAdjustmentChange}
                    onSetAdjustments={setAdjustments}
                    onApplyEdits={handleApplyEdits}
                    onResetEdits={handleResetEdits}
                    isEditing={isEditing}
                    isApplyingEdits={isApplyingEdits}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
                </div>
            </div>
            
            <div id="creations-gallery" className="mt-12 bg-slate-900/50 backdrop-blur-xl p-4 rounded-2xl shadow-2xl ring-1 ring-white/10">
                <button 
                className="text-xl font-semibold text-slate-200 mb-4 pl-1 w-full text-right flex justify-between items-center"
                onClick={() => setIsGalleryOpen(prev => !prev)}
                >
                <span>גלריית יצירות ({creations.length})</span>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-300 ${isGalleryOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                </button>
                {isGalleryOpen && creations.length > 0 && (
                <div className="flex gap-4 overflow-x-auto p-4 rounded-lg bg-black/20 -mx-4 -mb-4">
                    {creations.map(creation => (
                        <div key={creation.id} className="flex-shrink-0 w-40 h-40 rounded-md overflow-hidden relative group shadow-md">
                        <img src={creation.image.dataUrl} alt={`Creation ${creation.id}`} className="w-full h-full object-cover"/>
                        <div className="absolute inset-0 bg-black/70 p-2 text-xs flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity flex">
                            <p className="text-slate-300 line-clamp-2 overflow-hidden mb-auto">{creation.prompt || creation.styles.join(', ')}</p>
                            <div className="flex justify-around items-center">
                                <button onClick={() => handleUseGalleryImageAsSource(creation)} className="p-1.5 text-slate-300 hover:text-sky-400" title="השתמש כמקור"><ArrowPathIcon className="h-5 w-5"/></button>
                                <button onClick={() => handleDownloadGalleryImage(creation)} className="p-1.5 text-slate-300 hover:text-green-400" title="הורדה"><DownloadIcon className="h-5 w-5"/></button>
                                <button onClick={() => handleCopyPrompt(creation)} className="p-1.5 text-slate-300 hover:text-amber-400" title="העתק הנחיה"><ClipboardDocumentIcon className="h-5 w-5"/></button>
                                <button onClick={() => handleDeleteCreation(creation.id)} className="p-1.5 text-slate-300 hover:text-red-400" title="מחק"><TrashIcon className="h-5 w-5"/></button>
                            </div>
                        </div>
                        </div>
                    ))}
                </div>
                )}
            </div>
          </>
      </main>

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
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.7); } /* sky-400 */
            70% { transform: scale(1.1); box-shadow: 0 0 0 20px rgba(56, 189, 248, 0); }
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
            className="fixed bottom-5 right-5 z-[90] p-4 bg-gradient-to-br from-sky-500 to-indigo-600 text-white rounded-full shadow-2xl hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-slate-900 transition-transform animate-welcome-pulse"
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
