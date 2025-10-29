

import { GoogleGenAI, Modality, GenerateContentResponse, Type } from "@google/genai";

// Utility to convert file to base64
export const fileToBase64 = (file: File): Promise<{base64: string, mimeType: string}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const mimeType = result.split(';')[0].split(':')[1];
      const base64 = result.split(',')[1];
      resolve({ base64, mimeType });
    };
    reader.onerror = (error) => reject(error);
  });
};

const getEffectiveApiKey = (apiKey?: string): string => {
    const keyToUse = apiKey || process.env.API_KEY;
    if (!keyToUse) {
      throw new Error("מפתח API אינו מוגדר. אנא בחר מפתח או הזן אותו ידנית.");
    }
    return keyToUse;
};

const parseAndThrowApiError = (error: Error, action: string): never => {
    let errorJson;
    try {
        errorJson = JSON.parse(error.message);
    } catch (e) {
        // Not a JSON error message, fallback to string matching
        if (error.message.includes('API key not valid')) {
            throw new Error(`מפתח ה-API שסופק אינו תקין (${action}). אנא בדקו את ההגדרות.`);
        }
        if (error.message.includes('SAFETY')) {
             throw new Error(`${action} נחסם עקב הגדרות בטיחות. אנא נסו הנחיה אחרת.`);
        }
        throw new Error(`${action} נכשל: ${error.message}`);
    }

    // It's a structured JSON error, let's parse it
    const code = errorJson.error?.code;
    const status = errorJson.error?.status;
    const message = errorJson.error?.message || error.message;

    if (code === 401 || status === 'UNAUTHENTICATED' || (typeof message === 'string' && message.toLowerCase().includes('api key not valid'))) {
        throw new Error(`אימות נכשל (סטטוס: ${status || code}). מפתח ה-API אינו תקין או שאין לו הרשאות. אנא בחר מפתח חדש.`);
    }
    if (code === 429 || status === 'RESOURCE_EXHAUSTED') {
        let detailedMessage = `חרגת מהמכסה שלך (סטטוס: ${status || code}).\nאנא בדוק את תוכנית החיובים ופרטי החיוב שלך.`;
        
        const details = errorJson.error?.details;
        const allLinks = new Map<string, string>();

        // Extract links from main message
        if (typeof message === 'string') {
            const urlRegex = /https?:\/\/[^\s,]+/g; // Match URLs
            const rawUrls = message.match(urlRegex);
            if (rawUrls) {
                rawUrls.forEach(url => {
                    const cleanUrl = url.replace(/[.,\s]$/, '');
                    if (cleanUrl.includes('rate-limit')) {
                        allLinks.set(cleanUrl, 'מידע על מכסות');
                    } else if (cleanUrl.includes('usage')) {
                        allLinks.set(cleanUrl, 'מעקב אחר שימוש');
                    } else {
                        allLinks.set(cleanUrl, 'מידע נוסף');
                    }
                });
            }
        }

        if (Array.isArray(details)) {
            const quotaFailure = details.find((d: any) => d['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure');
            if (quotaFailure && Array.isArray(quotaFailure.violations) && quotaFailure.violations.length > 0) {
                const violation = quotaFailure.violations[0];
                let reason = 'סיבה: חריגה ממכסה';
                if (violation.quotaMetric) {
                    reason += ` עבור "${violation.quotaMetric}".`;
                }
                if (violation.quotaValue) {
                    reason += ` (מגבלה: ${violation.quotaValue})`;
                }
                detailedMessage += `\n${reason}.`;
            }

            const help = details.find((d: any) => d['@type'] === 'type.googleapis.com/google.rpc.Help');
            if (help && Array.isArray(help.links)) {
                help.links.forEach((link: {url: string, description: string}) => {
                    if (link.url && link.description) {
                        allLinks.set(link.url, link.description);
                    }
                });
            }
        }
    
        if (allLinks.size > 0) {
            detailedMessage += `\n\nלמידע נוסף, בקר בקישורים הבאים:`;
            for (const [url, desc] of allLinks.entries()) {
                detailedMessage += `\n- ${desc}: ${url}`;
            }
        }
        
        throw new Error(detailedMessage);
    }
    throw new Error(`${action} נכשל: ${message}`);
};


const handleGeminiResponse = (
  response: GenerateContentResponse,
  action: 'עיבוד' | 'יצירה'
): { base64: string; mimeType: string } => {
  const blockReason = response.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`פעולת ה${action} נחסמה. סיבה: ${blockReason}. אנא נסו הנחיה אחרת.`);
  }

  const candidate = response.candidates?.[0];
  if (!candidate) {
    throw new Error(
      `Gemini לא החזיר תמונה. הדבר קורה לעתים קרובות כאשר ההנחיה או התמונה נחסמות על ידי מסנני בטיחות. אנא נסו הנחיה אחרת.`
    );
  }

  const finishReason = candidate.finishReason;
  if (finishReason && finishReason !== 'STOP') {
    if (finishReason === 'SAFETY') {
      throw new Error('התגובה נחסמה עקב הגדרות בטיחות. אנא נסו הנחיה אחרת.');
    }
    throw new Error(`פעולת ה${action} נכשלה. המודל הפסיק לעבוד מהסיבה הבאה: ${finishReason}.`);
  }

  if (!candidate.content || !candidate.content.parts) {
    throw new Error("מבנה תגובה לא תקין מ-Gemini. התוכן חסר בתגובה שהתקבלה.");
  }

  for (const part of candidate.content.parts) {
    if (part.inlineData) {
      const { data, mimeType } = part.inlineData;
      return { base64: data, mimeType };
    }
  }

  const textExplanation = candidate.content.parts
    .map(part => (part as { text?: string }).text)
    .filter(text => text)
    .join(' ');

  if (textExplanation) {
    throw new Error(`Gemini הגיב בטקסט במקום בתמונה: "${textExplanation}"`);
  }

  throw new Error("לא נמצא מידע תמונה בתגובה מ-Gemini. המודל לא החזיר תמונה או סיבה.");
};


export const generateFromImagesAndPrompt = async (
  images: { base64: string; mimeType: string }[],
  prompt: string,
  apiKey?: string
): Promise<{base64: string, mimeType: string}> => {
  if (images.length === 0) {
    throw new Error("נדרשת לפחות תמונה אחת כדי לבצע עריכה או שילוב.");
  }

  const effectiveApiKey = getEffectiveApiKey(apiKey);
  const ai = new GoogleGenAI({ apiKey: effectiveApiKey });

  const imageParts = images.map(image => ({
    inlineData: {
      data: image.base64,
      mimeType: image.mimeType,
    },
  }));

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          ...imageParts,
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    return handleGeminiResponse(response, 'עיבוד');
  } catch (error) {
    console.error("שגיאה בעת עיבוד תמונה עם Gemini:", error);
    if (error instanceof Error) {
        parseAndThrowApiError(error, 'עיבוד תמונה עם Gemini');
    }
    throw new Error("עיבוד התמונה נכשל. אירעה שגיאה לא ידועה בתקשורת עם ה-API.");
  }
};

export const generateImageWithGemini = async (
  prompt: string,
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4',
  apiKey?: string
): Promise<{base64: string, mimeType: string}> => {
  const effectiveApiKey = getEffectiveApiKey(apiKey);
  const ai = new GoogleGenAI({ apiKey: effectiveApiKey });

  try {
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png',
          aspectRatio: aspectRatio,
        },
    });
    
    if (!response.generatedImages || response.generatedImages.length === 0) {
        throw new Error("Imagen לא החזיר תמונה. ייתכן שההנחיה נחסמה עקב הגדרות בטיחות.");
    }

    const image = response.generatedImages[0];
    const base64 = image.image.imageBytes;
    const mimeType = image.image.mimeType || 'image/png';

    if (!base64) {
        throw new Error("לא נמצא מידע תמונה בתגובה מ-Imagen.");
    }
    
    return { base64, mimeType };

  } catch (error) {
    console.error("שגיאה ביצירת תמונה עם Imagen:", error);
    if (error instanceof Error) {
        parseAndThrowApiError(error, 'יצירת תמונה עם Imagen');
    }
    throw new Error("יצירת התמונה נכשל. אירעה שגיאה לא ידועה בתקשורת עם ה-API.");
  }
};


export const analyzePromptWithGemini = async (prompt: string, apiKey?: string): Promise<string[]> => {
  if (!prompt.trim()) {
    return [];
  }

  const effectiveApiKey = getEffectiveApiKey(apiKey);
  const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
  const model = 'gemini-2.5-flash';

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `ההנחיה הנוכחית היא: "${prompt}"`,
      config: {
        systemInstruction: `אתה מומחה לכתיבת הנחיות (prompts) למודלי יצירת תמונות. תפקידך הוא לנתח את ההנחיה של המשתמש ולהציע 3-5 הצעות קצרות וקונקרטיות לשיפורה. כל הצעה צריכה להיות תוספת שניתן לשרשר להנחיה המקורית. התמקד בשיפורים כמו הוספת פרטים על תאורה, קומפוזיציה, סגנון אומנותי, או אווירה. החזר את ההצעות כמערך JSON של מחרוזות.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['suggestions'],
        },
      },
    });

    const jsonString = response.text;
    const result = JSON.parse(jsonString);

    if (result && Array.isArray(result.suggestions)) {
      return result.suggestions;
    }

    throw new Error("התגובה מה-API לא הייתה בפורמט הצפוי.");
  } catch (error) {
    console.error("שגיאה בניתוח הנחיה עם Gemini:", error);
    if (error instanceof Error) {
        parseAndThrowApiError(error, 'ניתוח הנחיה');
    }
    throw new Error("ניתוח ההנחיה נכשל. אירעה שגיאה לא ידועה.");
  }
};

export const generateChatResponse = async (
    history: { role: 'user' | 'model', text: string }[],
    isThinkingMode: boolean,
    apiKey?: string
): Promise<string> => {
    const effectiveApiKey = getEffectiveApiKey(apiKey);
    const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
    
    const model = isThinkingMode ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const config = isThinkingMode ? { thinkingConfig: { thinkingBudget: 32768 } } : {};

    const contents = history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
    }));

    try {
        const response = await ai.models.generateContent({
            model,
            contents,
            config,
        });

        if (response.promptFeedback?.blockReason) {
            return `הבקשה נחסמה. סיבה: ${response.promptFeedback.blockReason}.`;
        }

        return response.text;
    } catch (error) {
        console.error(`Error generating chat response with ${model}:`, error);
        if (error instanceof Error) {
            parseAndThrowApiError(error, `קבלת תגובה מ-${model}`);
        }
        throw new Error("קבלת תגובה מהצ'אט נכשלה. אירעה שגיאה לא ידועה.");
    }
};

export const validateApiKey = async (apiKey: string): Promise<boolean> => {
    if (!apiKey) {
        throw new Error("מפתח API ריק אינו חוקי.");
    }
    const ai = new GoogleGenAI({ apiKey });
    try {
        // A simple, low-cost call to check if the key is valid and has permissions.
        await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'hello',
        });
        return true;
    } catch (error) {
        console.error("API Key validation failed:", error);
        if (error instanceof Error) {
            parseAndThrowApiError(error, 'אימות מפתח API');
        }
        throw new Error("אימות מפתח API נכשל.");
    }
};


// --- IndexedDB Service ---

const DB_NAME = 'gemini-studio-db';
const STORE_NAME = 'creations';
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Database error:', request.error);
      reject('Error opening database');
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

const dataURLtoBlob = (dataUrl: string): Blob => {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) throw new Error('Invalid dataURL for blob conversion');
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

export const addCreationToDB = async (creation: any): Promise<void> => {
  const db = await initDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  const imageBlob = dataURLtoBlob(creation.image.dataUrl);
  
  const creationToStore = {
      ...creation,
      image: {
          id: creation.image.id,
          mimeType: creation.image.mimeType,
          blob: imageBlob,
      }
  };
  delete creationToStore.image.dataUrl;
  delete creationToStore.image.base64;

  return new Promise((resolve, reject) => {
    const request = store.put(creationToStore);
    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error('Failed to add creation to DB:', request.error);
      reject(request.error);
    }
  });
};

export const getAllCreationsFromDB = async (): Promise<any[]> => {
    const db = await initDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = async () => {
          try {
              const blobToDataURL = (blob: Blob): Promise<string> => {
                  return new Promise((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve(reader.result as string);
                      reader.onerror = (error) => reject(error);
                      reader.readAsDataURL(blob);
                  });
              };

              const creationsWithDataUrls = await Promise.all(request.result.map(async (c) => {
                  const dataUrl = await blobToDataURL(c.image.blob);
                  const base64 = dataUrl.split(',')[1];
                  return {
                      ...c,
                      image: {
                          id: c.image.id,
                          mimeType: c.image.mimeType,
                          dataUrl: dataUrl,
                          base64: base64,
                      }
                  };
              }));
              resolve(creationsWithDataUrls.reverse());
          } catch (error) {
              console.error('Error converting blobs to data URLs:', error);
              reject(error);
          }
        };
        request.onerror = () => {
            console.error('Failed to get creations from DB:', request.error);
            reject(request.error);
        }
    });
};

export const deleteCreationFromDB = async (id: string): Promise<void> => {
    const db = await initDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => {
            console.error('Failed to delete creation from DB:', request.error);
            reject(request.error);
        }
    });
};