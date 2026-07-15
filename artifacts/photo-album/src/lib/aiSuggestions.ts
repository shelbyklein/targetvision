const STOPWORDS = new Set([
  "a","an","the","and","or","of","in","on","at","to","for","with","by","is","are",
  "was","were","has","have","this","that","these","those","it","its","as","be",
  "from","not","but","can","also","very","her","his","she","he","they","their",
  "one","two","man","men","woman","women","person","people",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

export function suggestCollections(
  aiDescription: string | null | undefined,
  collections: Array<{ id: number; title: string; description?: string | null }>,
): Set<number> {
  if (!aiDescription || !collections.length) return new Set();
  const descTokens = new Set(tokenize(aiDescription));
  const suggested = new Set<number>();
  for (const col of collections) {
    const colTokens = tokenize(`${col.title} ${col.description ?? ""}`);
    if (colTokens.some((t) => descTokens.has(t))) {
      suggested.add(col.id);
    }
  }
  return suggested;
}

