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
      "Satellite Viewer": "Satellite Viewer",
      "Yield Forecast": "Yield Forecast",
      "KisanView": "KisanView",
      "Alert Center": "Alert Center",
      "Methodology": "Methodology",
      "Logout": "Logout",
      "Login to PRAGATI": "Login to PRAGATI",
      "Register for PRAGATI": "Register for PRAGATI",
      "Pilot Area": "Pilot Area",
      "Your Location": "Your Location",
      "FAO-56 CROP WATER REQUIREMENT": "FAO-56 CROP WATER REQUIREMENT",
      "Field-level water deficit estimation · Sorted by urgency · Karnataka": "Field-level water deficit estimation · Sorted by urgency · Karnataka",
      "Field Advisory Map": "Field Advisory Map",
      "Click markers for details": "Click markers for details",
      "Advisory Rules": "Advisory Rules",
      "Water Balance Model": "Water Balance Model",
      "Canal Command Distributary Advisory (PMKSY Planning)": "Canal Command Distributary Advisory (PMKSY Planning)",
      "Canal Gate Controller Strategy": "Canal Gate Controller Strategy",
      "Field Advisory Table": "Field Advisory Table",
      "Export CSV": "Export CSV",
      "Print Report": "Print Report",
      "API Connection Offline": "API Connection Offline: The backend server is unreachable. Ensure the FastAPI server is running on port 8000."
    }
  },
  hi: {
    translation: {
      "Overview": "अवलोकन",
      "Crop Classification": "फसल वर्गीकरण",
      "Moisture Stress": "नमी तनाव",
      "Irrigation Advisory": "सिंचाई सलाह",
      "Analytics": "एनालिटिक्स",
      "Satellite Viewer": "सैटेलाइट व्यूअर",
      "Yield Forecast": "उपज पूर्वानुमान",
      "KisanView": "किसान दृश्य",
      "Alert Center": "अलर्ट केंद्र",
      "Methodology": "पद्धति",
      "Logout": "लॉग आउट",
      "Login to PRAGATI": "प्रगति में लॉगिन करें",
      "Register for PRAGATI": "प्रगति के लिए पंजीकरण करें",
      "Pilot Area": "पायलट क्षेत्र",
      "Your Location": "आपका स्थान",
      "FAO-56 CROP WATER REQUIREMENT": "FAO-56 फसल जल की आवश्यकता",
      "Field-level water deficit estimation · Sorted by urgency · Karnataka": "क्षेत्र-स्तरीय जल कमी का अनुमान · तात्कालिकता के आधार पर वर्गीकृत · कर्नाटक",
      "Field Advisory Map": "क्षेत्र सलाह मानचित्र",
      "Click markers for details": "विवरण के लिए मार्कर पर क्लिक करें",
      "Advisory Rules": "सलाह नियम",
      "Water Balance Model": "जल संतुलन मॉडल",
      "Canal Command Distributary Advisory (PMKSY Planning)": "नहर कमान वितरिका सलाह (PMKSY योजना)",
      "Canal Gate Controller Strategy": "नहर गेट नियंत्रक रणनीति",
      "Field Advisory Table": "क्षेत्र सलाह तालिका",
      "Export CSV": "सीएसवी निर्यात करें",
      "Print Report": "रिपोर्ट प्रिंट करें",
      "API Connection Offline": "एपीआई कनेक्शन ऑफ़लाइन: बैकएंड सर्वर अनुपलब्ध है। सुनिश्चित करें कि FastAPI सर्वर पोर्ट 8000 पर चल रहा है।"
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
