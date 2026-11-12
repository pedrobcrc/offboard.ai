/** Present only explicitly named retrieved files, or the first retrieved file as a fallback. */
export function answerSources<T extends { filename: string }>(answer: string, sources: T[]): T[] {
  const named = sources.filter((source) => answer.toLowerCase().includes(source.filename.toLowerCase()));
  return named.length ? named : sources.slice(0, 1);
}