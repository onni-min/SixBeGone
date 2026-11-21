/**
 * Text normalization shared by the matcher and the rules.
 *
 * Every piece of text (a title, a channel name, a rule phrase) is turned into
 * a canonical token string: lowercase, no accents or invisible characters,
 * punctuation turned into token breaks, and padded with spaces so that
 * phrase matching can use plain `includes(" phrase ")` with whole-word
 * boundaries.
 *
 *   "🔥 #GTA6 Leaks!!"     -> " gta 6 leaks "
 *   "G.T.A. VI"            -> " gta vi "
 *   "GTAVI trailer"        -> " gta vi trailer "
 *   "gta\u200C6" (zero-width) -> " gta 6 "
 */

// Zero-width characters, word joiner, BOM, soft hyphen, variation selectors
// and tag characters (used in emoji flags but also to smuggle text).
const INVISIBLE = /[\u00AD\u200B-\u200F\u2060-\u2064\uFEFF\uFE00-\uFE0F]|\uDB40[\uDC00-\uDC7F]/g;

// Combining marks left over after NFD (accents).
const MARKS = /\p{M}+/gu;

// Anything that isn't a letter or digit separates tokens.
const SEPARATORS = /[^\p{L}\p{N}]+/gu;

// Split "gta6" -> "gta 6" and "6gta" -> "6 gta".
const LETTER_DIGIT = /(\p{L})(\p{N})|(\p{N})(\p{L})/gu;

/**
 * Glued spellings that can't be split by the letter/digit rule. Keys are whole
 * tokens. Kept deliberately small: only forms that are unambiguous on their own.
 */
const TOKEN_ALIASES: Record<string, string> = {
  gtavi: 'gta vi',
  gtasix: 'gta six',
  gtav: 'gta v',
  grandtheftauto: 'grand theft auto',
  grandtheftautovi: 'grand theft auto vi',
};

/** Normalize text to a space-padded, space-separated token string. */
export function normalize(input: string): string {
  if (!input) return ' ';

  let text = input.normalize('NFKC').toLowerCase();
  text = text.replace(INVISIBLE, '');
  text = text.normalize('NFD').replace(MARKS, '').normalize('NFC');
  text = text.replace(SEPARATORS, ' ');

  // Run twice so "a1b" style sequences fully split.
  for (let i = 0; i < 2; i++) {
    text = text.replace(LETTER_DIGIT, (_m, l1, d1, d2, l2) =>
      l1 !== undefined ? `${l1} ${d1}` : `${d2} ${l2}`,
    );
  }

  const tokens = collapseSpelledOut(text.split(' ').filter(Boolean)).flatMap(
    (t) => (TOKEN_ALIASES[t] ?? t).split(' '),
  );

  return tokens.length ? ` ${tokens.join(' ')} ` : ' ';
}

/**
 * Join runs of single letters into one token: "g t a 6" -> "gta 6".
 * People space out letters to dodge keyword filters. Digits are left alone
 * so "gta 6" stays two tokens.
 */
function collapseSpelledOut(tokens: string[]): string[] {
  const out: string[] = [];
  let run = '';
  const flush = () => {
    if (run.length > 1) out.push(run);
    else if (run) out.push(run);
    run = '';
  };
  for (const t of tokens) {
    if (t.length === 1 && /\p{L}/u.test(t)) {
      run += t;
    } else {
      flush();
      out.push(t);
    }
  }
  flush();
  return out;
}
