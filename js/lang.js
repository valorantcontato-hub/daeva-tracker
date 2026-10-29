// Idioma do app: português (padrão) ou inglês. Vale para a interface e para os nomes do jogo
// (itens, skills, classes, títulos...), que vêm traduzidos pelo site oficial da PlayNC.
import { load, save } from './store.js';

export const LANGS = [['pt-BR', 'PT', 'Português'], ['en-US', 'EN', 'English']];

export const getLang = () => (load('lang', 'pt-BR') === 'en-US' ? 'en-US' : 'pt-BR');
export const setLang = lang => save('lang', lang === 'en-US' ? 'en-US' : 'pt-BR');
export const isEn = () => getLang() === 'en-US';
