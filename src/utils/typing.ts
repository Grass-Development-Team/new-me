const MS_PER_STROKE = 120;

/**
 * Calculate the typing time
 * @param text The text to be type
 * @returns The typing time (ms)
 */
export function calc_typing_delay(text: string): number {
  let total_strokes = 0;

  for (const char of text) {
    if (/\p{Unified_Ideograph}/gu.test(char)) {
      total_strokes += 3;
    } else if (/[a-zA-Z]/.test(char)) {
      total_strokes += 1;
    } else if (/[,.!?;，。！？；]/.test(char)) {
      total_strokes += 4;
    } else if (/\s/.test(char)) {
      total_strokes += 1;
    } else if (/\p{Emoji_Presentation}/gu.test(char)) {
      total_strokes += 3;
    } else {
      total_strokes += 1.5;
    }
  }

  const typing_duration = total_strokes * MS_PER_STROKE;

  const volatility = 0.85 + Math.random() * 0.2;

  return Math.floor(typing_duration * volatility);
}
