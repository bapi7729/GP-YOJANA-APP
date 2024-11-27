'use client';
import { useEffect, useState } from 'react';
import { parseCookies, setCookie } from 'nookies';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { styled } from '@mui/material/styles';

const COOKIE_NAME = 'googtrans';

interface LanguageDescriptor {
    name: string;
    title: string;
}

interface GoogleTranslationConfig {
    languages: LanguageDescriptor[];
    defaultLanguage: string;
}

// Declare the config as a property of the global object
declare global {
    interface Window {
        __GOOGLE_TRANSLATION_CONFIG__?: GoogleTranslationConfig;
    }
}

const LanguageToggle = styled(ToggleButtonGroup)({
    margin: '0 16px',
    '& .MuiToggleButton-root': {
        color: '#1a365d',
        borderColor: '#1a365d',
        '&.Mui-selected': {
            backgroundColor: '#1a365d',
            color: 'white',
            '&:hover': {
                backgroundColor: '#142844',
            },
        },
    },
});

// Use a state variable instead of a global variable
let currentLanguage = 'en';

export function switchLanguage(lang: string): void {
    currentLanguage = lang;
}

export function getCurrentLanguage(): string {
    return currentLanguage;
}

const LanguageSwitcher: React.FC = () => {
    const [languageConfig, setLanguageConfig] = useState<GoogleTranslationConfig | null>(null);

    useEffect(() => {
        const cookies = parseCookies();
        const existingLanguageCookieValue = cookies[COOKIE_NAME];

        let languageValue: string | undefined;
        if (existingLanguageCookieValue) {
            const sp = existingLanguageCookieValue.split('/');
            if (sp.length > 2) {
                languageValue = sp[2];
            }
        }
        if (window.__GOOGLE_TRANSLATION_CONFIG__ && !languageValue) {
            languageValue = window.__GOOGLE_TRANSLATION_CONFIG__.defaultLanguage;
        }
        if (languageValue) {
            switchLanguage(languageValue);
        }
        if (window.__GOOGLE_TRANSLATION_CONFIG__) {
            setLanguageConfig(window.__GOOGLE_TRANSLATION_CONFIG__);
        }
    }, []);

    if (!getCurrentLanguage() || !languageConfig) {
        return null;
    }

    const handleLanguageChange = (event: React.MouseEvent<HTMLElement>, newLanguage: string | null) => {
        if (newLanguage !== null) {
            // Save form data to localStorage before changing language
            const currentPath = window.location.pathname;
            if (currentPath === '/data-collection') {
                const formData = document.querySelectorAll('input[type="number"]');
                const savedData: Record<string, string> = {};
                formData.forEach((input: Element) => {
                    if (input instanceof HTMLInputElement) {
                        savedData[input.name] = input.value;
                    }
                });
                localStorage.setItem('tempFormData', JSON.stringify(savedData));
            }
            
            setCookie(null, COOKIE_NAME, '/auto/' + newLanguage);
            switchLanguage(newLanguage);
            window.location.reload();
        }
    };

    return (
        <LanguageToggle
            value={getCurrentLanguage()}
            exclusive
            onChange={handleLanguageChange}
            aria-label="language"
            size="small"
        >
            {languageConfig.languages.map((lang: LanguageDescriptor) => (
                <ToggleButton key={lang.name} value={lang.name}>
                    {lang.name === 'en' ? 'ENG' : 'Oriya'}
                </ToggleButton>
            ))}
        </LanguageToggle>
    );
};

export default LanguageSwitcher;
