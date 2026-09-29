import en from './en.json';

// UI messages are separate from the versioned typing content in @ztype/core.
// English source messages are stable translation keys (including intentional spaces).
export type Message = keyof typeof en;
export const uiLocale = 'en';
export const uiDirection = 'ltr';
export function t(message: Message): string {
  return en[message];
}
