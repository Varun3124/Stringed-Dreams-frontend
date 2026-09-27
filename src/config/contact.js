// Creator contact details — the single source of truth for every contact link in the app.
export const WHATSAPP_NUMBER = '919426074868';
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

export const INSTAGRAM_URL = 'https://www.instagram.com/stringed.dreams';
export const INSTAGRAM_HANDLE = '@stringed.dreams';

export const EMAIL = 'lakshmi.shivakumar@gmail.com';
export const EMAIL_URL = `mailto:${EMAIL}`;

// WhatsApp chat link with a prefilled message
export const whatsappLink = (text) => `${WHATSAPP_URL}?text=${encodeURIComponent(text)}`;
