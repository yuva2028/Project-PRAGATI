import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      "Overview": "Overview",
      "Crop Classification": "Crop Classification",
      "Moisture Stress": "Moisture Stress",
      "Irrigation Advisory": "Irrigation Advisory",
      "Analytics": "Analytics",
      "Logout": "Logout",
      "Login to PRAGATI": "Login to PRAGATI",
      "Register for PRAGATI": "Register for PRAGATI",
      "Pilot Area": "Pilot Area",
      "Your Location": "Your Location"
    }
  },
  hi: {
    translation: {
      "Overview": "अवलोकन",
      "Crop Classification": "फसल वर्गीकरण",
      "Moisture Stress": "नमी तनाव",
      "Irrigation Advisory": "सिंचाई सलाह",
      "Analytics": "एनालिटिक्स",
      "Logout": "लॉग आउट",
      "Login to PRAGATI": "प्रगति में लॉगिन करें",
      "Register for PRAGATI": "प्रगति के लिए पंजीकरण करें",
      "Pilot Area": "पायलट क्षेत्र",
      "Your Location": "आपका स्थान"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en", // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;
