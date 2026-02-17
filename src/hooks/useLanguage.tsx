import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getLanguageConfig } from "@/lib/languages";
import type { TargetLanguage, LanguageConfig } from "@/lib/languages";

interface LanguageContextType {
  currentLanguage: TargetLanguage;
  languageConfig: LanguageConfig;
  setLanguage: (lang: TargetLanguage) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user, profile, updateProfile } = useAuth();
  const [selectedLanguage, setSelectedLanguage] = useState<TargetLanguage>("spanish");

  // Sync from profile when it loads or changes
  useEffect(() => {
    if (user && profile?.target_language) {
      setSelectedLanguage(profile.target_language as TargetLanguage);
    }
  }, [user, profile?.target_language]);

  const languageConfig = getLanguageConfig(selectedLanguage);

  const setLanguage = useCallback(async (lang: TargetLanguage) => {
    // Update local state immediately for instant UI feedback
    setSelectedLanguage(lang);
    if (user) {
      await updateProfile({ target_language: lang });
    }
  }, [user, updateProfile]);

  return (
    <LanguageContext.Provider value={{ currentLanguage: selectedLanguage, languageConfig, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
