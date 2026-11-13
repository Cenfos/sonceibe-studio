// Keep the grammar narrow enough to distinguish chords from section labels.
const CHORD_NAME = /^[A-G](?:[#b♯♭])?(?:maj|min|dim|aug|sus|add|m|M|°|ø|[+\-]|\d+)*(?:\/[A-G][#b♯♭]?)?$/;

export function isLyricChord(value: string): boolean {
  return CHORD_NAME.test(value);
}

export function parseLyricChords(source: string, transformText: (text: string) => string) {
  const chords: { name: string; index: number }[] = [];
  let text = '';
  let cursor = 0;

  for (const match of source.matchAll(/\[([^\[\]]+)\]/g)) {
    if (!isLyricChord(match[1])) continue;
    const start = match.index ?? 0;
    text += transformText(source.slice(cursor, start));
    chords.push({ name: match[1], index: text.length });
    cursor = start + match[0].length;
  }
  text += transformText(source.slice(cursor));

  // A marker before whitespace belongs to the next sung character.
  for (const chord of chords) {
    chord.index += text.slice(chord.index).match(/^\s*/)?.[0].length ?? 0;
  }
  return { text, chords };
}
