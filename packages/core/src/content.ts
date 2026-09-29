import { CONTENT_VERSION, type LanguagePack, type TestConfig, type AttemptInput } from './types';

export const english: LanguagePack = {
  locale: 'en',
  direction: 'ltr',
  contentVersion: CONTENT_VERSION,
  keyboardLayout: 'qwerty',
  words:
    'the light of a new world is waiting just beyond your window take time to find a quiet place and let each little moment become part of something great we travel through space with wonder in our hearts every small step will bring you closer to where you want to be build dream learn grow begin again always keep moving forward as stars shine over fields of gold there are stories hidden inside all things feel the rhythm follow your own path make room for joy look up breathe easy stay curious come home together around before after between under open morning river ocean mountain forest gentle bright simple kind clear warm slow fast small long still only other great good first next last never often away here out down into from about more most can could would should have has had do does did not one two three four five blue green red moon sun earth planet sky air water fire wind world hand mind eyes day night year life work play read write speak listen think know understand help share create change explore discover journey learn practice word flow calm wild free deep far near'.split(
      ' ',
    ),
};

export const lessons = [
  {
    id: 'home',
    title: 'Find your home row',
    subtitle: 'Every journey starts at home.',
    keys: 'asdfjkl;',
    finger:
      'Rest your index fingers on F and J. Feel their little bumps; your other fingers sit alongside them.',
    prompt: 'asdf jkl; asdf jkl; ff jj dd kk ss ll aa ;; fj dk sl a; fj dk sl a;',
    duration: '2 min',
    icon: 'home',
  },
  {
    id: 'left',
    title: 'Meet your left hand',
    subtitle: 'Build a little muscle memory.',
    keys: 'asdfg',
    finger:
      'Use your left pinky for A, ring finger for S, middle finger for D, and index finger for F and G.',
    prompt: 'sad fad gas dad gag sag add as sad gas dad fad sag adds as dad gas sad',
    duration: '2 min',
    icon: 'hand',
  },
  {
    id: 'right',
    title: 'Give your right a turn',
    subtitle: 'Let both hands find their rhythm.',
    keys: 'hjkl;',
    finger:
      'Use your right index finger for H and J, middle finger for K, ring finger for L, and pinky for semicolon.',
    prompt: 'jj kk ll ;; hj jk kl l; hjkl jkl; hj jk kl l; jj kk ll ;; hjkl jkl;',
    duration: '2 min',
    icon: 'hand',
  },
  {
    id: 'upper',
    title: 'Reach a little higher',
    subtitle: 'Explore the upper row.',
    keys: 'qwertyuiop',
    finger: 'Reach up from the home row, then return. Your index fingers cover R, T, Y, and U.',
    prompt:
      'we try to write quiet poetry you type your true story we pour our power into every word',
    duration: '3 min',
    icon: 'up',
  },
  {
    id: 'lower',
    title: 'Down to earth',
    subtitle: 'Get comfortable with the lower row.',
    keys: 'zxcvbnm',
    finger: 'Move down without shifting your whole hand. Your index fingers cover V, B, N, and M.',
    prompt:
      'calm blue waves move beyond a cozy cabin brave minds can bloom even when clouds come back',
    duration: '3 min',
    icon: 'down',
  },
  {
    id: 'capitals',
    title: 'Make a big impression',
    subtitle: 'A gentle introduction to Shift.',
    keys: 'Shift',
    finger:
      'Hold Shift with the opposite hand from the letter you are typing. Release it after each capital.',
    prompt:
      'Hello Earth Welcome Home Find Your Flow Explore Mars Follow The Stars Keep Going You Are Doing Well',
    duration: '3 min',
    icon: 'capital',
  },
  {
    id: 'numbers',
    title: 'Ready for countdown',
    subtitle: 'Make friends with the number row.',
    keys: '1234567890',
    finger:
      'Reach up to the number row and return to home position. Start slowly; accuracy comes before speed.',
    prompt: '10 9 8 7 6 5 4 3 2 1 0 123 456 789 100 250 365 2026 42 73 99',
    duration: '2 min',
    icon: 'number',
  },
  {
    id: 'punctuation',
    title: 'The finishing touches',
    subtitle: 'Bring your sentences to life.',
    keys: '.,;:!?',
    finger:
      'Use your right middle finger for comma, ring finger for period, and pinky for semicolon. Use Shift for ? and !.',
    prompt:
      'Hello, explorer! Take a breath. Ready to begin? Go slowly; find your rhythm. Next stop: the stars.',
    duration: '3 min',
    icon: 'punctuation',
  },
] as const;

const segmenters = new Map<string, Intl.Segmenter>();
export function graphemes(text: string, locale = 'en'): string[] {
  if (!segmenters.has(locale))
    segmenters.set(locale, new Intl.Segmenter(locale, { granularity: 'grapheme' }));
  return [...segmenters.get(locale)!.segment(text.normalize('NFC'))].map((s) => s.segment);
}

export function generatePrompt(config: TestConfig, seed: number): string {
  if (config.mode === 'lesson') return lessons.find((l) => l.id === config.lessonId)!.prompt;
  let state = seed || 1;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
  const count = config.mode === 'words' ? config.limit : 1600;
  const words: string[] = [];
  for (let i = 0; i < count; i++) {
    let word = english.words[Math.floor(random() * english.words.length)];
    if (word === words[i - 1])
      word = english.words[(english.words.indexOf(word) + 1) % english.words.length];
    words.push(word);
  }
  return words.join(' ');
}

export function validateCompletion(attempt: AttemptInput): boolean {
  const length = graphemes(generatePrompt(attempt.config, attempt.seed)).length;
  return attempt.config.mode === 'time'
    ? attempt.characters <= length
    : attempt.characters === length;
}
