import { createContext, useContext, useState, ReactNode } from "react";
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
  const [guestLanguage, setGuestLanguage] = useState<TargetLanguage>("spanish");

  const currentLanguage: TargetLanguage = user
    ? (profile?.target_language || "spanish") as TargetLanguage
    : guestLanguage;

  const languageConfig = getLanguageConfig(currentLanguage);

  const setLanguage = async (lang: TargetLanguage) => {
    if (user) {
      await updateProfile({ target_language: lang });
    } else {
      setGuestLanguage(lang);
    }
  };

  return (
    <LanguageContext.Provider value={{ currentLanguage, languageConfig, setLanguage }}>
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
