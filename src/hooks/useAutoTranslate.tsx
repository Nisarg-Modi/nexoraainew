import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LanguagePreferences {
  send_language: string;
  preferred_language: string;
  auto_translate: boolean;
}

interface ContactLanguagePreferences extends LanguagePreferences {
  contact_user_id?: string;
  conversation_id?: string;
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
  const [contactPreferences, setContactPreferences] = useState<ContactLanguagePreferences | null>(null);
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

  const fetchContactPreferences = useCallback(async (contactUserId: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;

      const { data, error } = await supabase
        .from('contact_language_preferences')
        .select('*')
        .eq('user_id', userData.user.id)
        .eq('contact_user_id', contactUserId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const prefs: ContactLanguagePreferences = {
          send_language: data.send_language ?? 'en',
          preferred_language: data.preferred_language ?? 'en',
          auto_translate: data.auto_translate ?? false,
          contact_user_id: data.contact_user_id,
          conversation_id: data.conversation_id ?? undefined,
        };
        setContactPreferences(prefs);
        return prefs;
      }
      
      // No contact preferences, clear and return null
      setContactPreferences(null);
      return null;
    } catch (error) {
      console.error('Error fetching contact language preferences:', error);
      setContactPreferences(null);
      return null;
    }
  }, []);

  // Get effective preferences (contact preferences override global)
  const getEffectivePreferences = useCallback((): LanguagePreferences => {
    if (contactPreferences) {
      return {
        send_language: contactPreferences.send_language,
        preferred_language: contactPreferences.preferred_language,
        auto_translate: contactPreferences.auto_translate,
      };
    }
    return preferences;
  }, [contactPreferences, preferences]);

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
    const effectivePrefs = getEffectivePreferences();
    if (!effectivePrefs.auto_translate || !text.trim()) return null;

    const result = await translateText(text, effectivePrefs.preferred_language, messageId);
    return result?.translatedText || null;
  }, [getEffectivePreferences, translateText]);

  const translateOutgoing = useCallback(async (
    text: string,
    recipientPreferredLanguage?: string
  ): Promise<string> => {
    const effectivePrefs = getEffectivePreferences();
    
    // Only translate if recipient has a different preferred language
    if (!recipientPreferredLanguage || 
        recipientPreferredLanguage === effectivePrefs.send_language) {
      return text;
    }

    const result = await translateText(text, recipientPreferredLanguage);
    return result?.translatedText || text;
  }, [getEffectivePreferences, translateText]);

  // Check if auto-translate is enabled (considering contact preferences)
  const isAutoTranslateEnabled = useCallback((): boolean => {
    return getEffectivePreferences().auto_translate;
  }, [getEffectivePreferences]);

  return {
    preferences,
    contactPreferences,
    translating,
    fetchPreferences,
    fetchContactPreferences,
    getEffectivePreferences,
    isAutoTranslateEnabled,
    translateText,
    detectLanguage,
    autoTranslateIncoming,
    translateOutgoing,
    translationCache,
    languageCache,
  };
};
