import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LanguagePreferences {
  send_language: string;
  preferred_language: string;
  auto_translate: boolean;
}

interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
}

interface LanguageDetectionResult {
  languageCode: string;
  languageName: string;
  confidence: string;
}

export const useAutoTranslate = () => {
  const [translating, setTranslating] = useState(false);
  const [preferences, setPreferences] = useState<LanguagePreferences>({
    send_language: 'en',
    preferred_language: 'en',
    auto_translate: false,
  });
  const [translationCache, setTranslationCache] = useState<Map<string, string>>(new Map());
  const [languageCache, setLanguageCache] = useState<Map<string, LanguageDetectionResult>>(new Map());

  const fetchPreferences = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data } = await supabase
        .from('profiles')
        .select('send_language, preferred_language, auto_translate')
        .eq('user_id', userData.user.id)
        .single();

      if (data) {
        setPreferences({
          send_language: data.send_language ?? 'en',
          preferred_language: data.preferred_language ?? 'en',
          auto_translate: data.auto_translate ?? false,
        });
      }
    } catch (error) {
      console.error('Error fetching language preferences:', error);
    }
  }, []);

  const translateText = useCallback(async (
    text: string, 
    targetLanguage: string,
    messageId?: string
  ): Promise<TranslationResult | null> => {
    if (!text.trim()) return null;

    // Check cache first
    const cacheKey = `${text}_${targetLanguage}`;
    const cached = translationCache.get(cacheKey);
    if (cached) {
      return { translatedText: cached, sourceLanguage: 'cached', targetLanguage };
    }

    setTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-message', {
        body: { text, targetLanguage, messageId }
      });

      if (error) throw error;

      if (data?.translatedText) {
        // Cache the translation
        setTranslationCache(prev => new Map(prev).set(cacheKey, data.translatedText));
        return data as TranslationResult;
      }
      return null;
    } catch (error) {
      console.error('Translation error:', error);
      return null;
    } finally {
      setTranslating(false);
    }
  }, [translationCache]);

  const detectLanguage = useCallback(async (
    text: string,
    messageId?: string
  ): Promise<LanguageDetectionResult | null> => {
    if (!text.trim()) return null;

    // Check cache first
    const cacheKey = messageId || text.substring(0, 100);
    const cached = languageCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const { data, error } = await supabase.functions.invoke('detect-language', {
        body: { text }
      });

      if (error) throw error;

      if (data?.languageCode) {
        const result: LanguageDetectionResult = {
          languageCode: data.languageCode,
          languageName: data.languageName || data.languageCode,
          confidence: data.confidence || 'medium'
        };
        
        // Cache the detection result
        setLanguageCache(prev => new Map(prev).set(cacheKey, result));
        return result;
      }
      return null;
    } catch (error) {
      console.error('Language detection error:', error);
      return null;
    }
  }, [languageCache]);

  const autoTranslateIncoming = useCallback(async (
    text: string, 
    messageId?: string
  ): Promise<string | null> => {
    if (!preferences.auto_translate || !text.trim()) return null;

    const result = await translateText(text, preferences.preferred_language, messageId);
    return result?.translatedText || null;
  }, [preferences, translateText]);

  const translateOutgoing = useCallback(async (
    text: string,
    recipientPreferredLanguage?: string
  ): Promise<string> => {
    // Only translate if recipient has a different preferred language
    if (!recipientPreferredLanguage || 
        recipientPreferredLanguage === preferences.send_language) {
      return text;
    }

    const result = await translateText(text, recipientPreferredLanguage);
    return result?.translatedText || text;
  }, [preferences, translateText]);

  return {
    preferences,
    translating,
    fetchPreferences,
    translateText,
    detectLanguage,
    autoTranslateIncoming,
    translateOutgoing,
    translationCache,
    languageCache,
  };
};
