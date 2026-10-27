/**
 * Arabic & Multilingual Fuzzy Normalization & Matching Utility
 */

export function normalizeText(text: string): string {
  if (!text) return '';

  let normalized = text.trim().toLowerCase();

  // Remove Arabic diacritics (tashkeel)
  normalized = normalized.replace(/[\u064B-\u065F\u0670]/g, '');

  // Remove Tatweel (Kashida)
  normalized = normalized.replace(/\u0640/g, '');

  // Normalize Alef variations (أ, إ, آ, ٱ -> ا)
  normalized = normalized.replace(/[أإآٱ]/g, 'ا');

  // Normalize Taa Marbuta (ة -> ه)
  normalized = normalized.replace(/ة/g, 'ه');

  // Normalize Yaa variations (ى, ئ -> ي)
  normalized = normalized.replace(/[ىئ]/g, 'ي');

  // Normalize Waw with Hamza (ؤ -> و)
  normalized = normalized.replace(/ؤ/g, 'و');

  // Remove non-alphanumeric except spaces
  normalized = normalized.replace(/[^\w\s\u0600-\u06FF]/gi, ' ');

  // Collapse consecutive whitespaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Normalizes Arabic compound names by removing spaces in standard prefixes & suffixes
 * E.g. "عبد الله" -> "عبدالله", "عبد الرحمن" -> "عبدالرحمن", "سيف الدين" -> "سيفالدين"
 */
export function normalizeArabicCompounds(text: string): string {
  if (!text) return '';
  let res = normalizeText(text);

  // Prefix: عبد + اسم (e.g. عبد الله -> عبدالله, عبد الرحمن -> عبدالرحمن)
  res = res.replace(/\bعبد\s+([ا-ي])/g, 'عبد$1');

  // Prefix: ابو / ام (e.g. ابو بكر -> ابوبكر)
  res = res.replace(/\b(ابو|ام)\s+([ا-ي])/g, '$1$2');

  // Suffix: الدين (e.g. سيف الدين -> سيفالدين, نور الدين -> نورالدين)
  res = res.replace(/\b(سيف|نور|شمس|علاء|بهاء|حسام|ضياء|تقي|محي|محيي|جلال|عماد|صلاح|جمال|بدر|شرف|نجم)\s+الدين\b/g, '$1الدين');

  // Suffix: الله (e.g. هبة الله -> هبةالله, فتح الله -> فتحالله)
  res = res.replace(/\b(هبه|فتح|عطا|فضل|نصر|كرم|رحمة|رحمه|منة|منه)\s+الله\b/g, '$1الله');

  return res.replace(/\s+/g, ' ').trim();
}

/**
 * Robust multi-token and fuzzy student search matching
 * Allows students to find their name even if they type first+last name, omit middle names,
 * or use compound names with/without spaces.
 */
export function matchesStudentSearch(query: string, candidateName: string, candidateCode?: string): boolean {
  if (!query || !query.trim()) return true;

  const rawQ = query.trim();
  if (candidateCode && candidateCode.trim().toLowerCase().includes(rawQ.toLowerCase())) {
    return true;
  }

  const normQ = normalizeText(rawQ);
  const normC = normalizeText(candidateName);

  // 1. Direct normalized substring check
  if (normC.includes(normQ)) return true;

  // 2. Compound-normalized check (handles عبد الله vs عبدالله)
  const compQ = normalizeArabicCompounds(rawQ);
  const compC = normalizeArabicCompounds(candidateName);
  if (compC.includes(compQ) || compQ.includes(compC)) return true;

  // 3. Multi-token search (e.g. "احمد البدوي" matches "احمد محمد علي البدوي")
  const qTokens = compQ.split(' ').filter(Boolean);
  const cTokens = compC.split(' ').filter(Boolean);

  if (qTokens.length === 0) return true;

  const allTokensMatch = qTokens.every((qTok) =>
    cTokens.some((cTok) => {
      if (cTok === qTok) return true;
      if (cTok.startsWith(qTok)) return true;
      // Strip 'ال' prefix if query didn't include it (e.g. "بدوي" matches "البدوي")
      const strippedCTok = cTok.replace(/^ال/, '');
      const strippedQTok = qTok.replace(/^ال/, '');
      if (strippedCTok === strippedQTok || strippedCTok.startsWith(strippedQTok)) return true;

      // Allow 1 character typo if token length >= 3
      if (qTok.length >= 3 && levenshteinDistance(qTok, cTok) <= 1) return true;
      return false;
    })
  );

  return allTokensMatch;
}

/**
 * Calculates Levenshtein Distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const matrix: number[][] = [];

  for (let i = 0; i <= m; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= n; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[m][n];
}

export interface MatchResult<T> {
  item: T;
  score: number; // 0 to 1
  isExact: boolean;
}

/**
 * Calculates a match score between query and target string
 * Returns score between 0 (no match) and 1 (perfect match)
 */
export function calculateSimilarity(query: string, target: string): number {
  const normQuery = normalizeText(query);
  const normTarget = normalizeText(target);

  if (!normQuery || !normTarget) return 0;

  // 1. Exact match
  if (normQuery === normTarget) return 1.0;

  // 1b. Exact compound match (e.g. عبد الله vs عبدالله)
  const compQuery = normalizeArabicCompounds(query);
  const compTarget = normalizeArabicCompounds(target);
  if (compQuery === compTarget) return 0.99;

  // 2. Contains match (target includes query or query includes target)
  if (normTarget.includes(normQuery)) {
    // If target has 3 names and query is 2 names that exactly match
    return Math.min(0.96, 0.75 + (normQuery.length / normTarget.length) * 0.25);
  }
  if (normQuery.includes(normTarget)) {
    return Math.min(0.92, 0.7 + (normTarget.length / normQuery.length) * 0.25);
  }

  // 3. Word token overlap
  const queryTokens = normQuery.split(' ').filter(Boolean);
  const targetTokens = normTarget.split(' ').filter(Boolean);

  let matchedTokens = 0;
  for (const qToken of queryTokens) {
    for (const tToken of targetTokens) {
      if (qToken === tToken) {
        matchedTokens++;
        break;
      } else if (
        qToken.length > 2 &&
        tToken.length > 2 &&
        (tToken.startsWith(qToken) || qToken.startsWith(tToken) || levenshteinDistance(qToken, tToken) <= 1)
      ) {
        matchedTokens += 0.85;
        break;
      }
    }
  }

  if (targetTokens.length > 0) {
    const tokenScore = (matchedTokens / Math.max(queryTokens.length, targetTokens.length));
    if (tokenScore > 0.5) {
      return tokenScore;
    }
  }

  // 4. Overall Levenshtein similarity
  const maxLen = Math.max(normQuery.length, normTarget.length);
  const distance = levenshteinDistance(normQuery, normTarget);
  const levScore = Math.max(0, (maxLen - distance) / maxLen);

  return levScore;
}

/**
 * Finds the best match from a list of candidates
 */
export function findBestMatch<T extends { name: string }>(
  query: string,
  candidates: T[],
  threshold = 0.65
): MatchResult<T> | null {
  if (!query || candidates.length === 0) return null;

  let bestMatch: T | null = null;
  let highestScore = 0;

  for (const candidate of candidates) {
    const score = calculateSimilarity(query, candidate.name);
    if (score > highestScore) {
      highestScore = score;
      bestMatch = candidate;
    }
  }

  if (bestMatch && highestScore >= threshold) {
    return {
      item: bestMatch,
      score: highestScore,
      isExact: highestScore >= 0.95
    };
  }

  return null;
}

/**
 * Filter and sort candidates for autocomplete suggestion
 */
export function filterSuggestions<T extends { name: string }>(
  query: string,
  candidates: T[],
  limit = 8
): { item: T; score: number }[] {
  if (!query.trim()) {
    return candidates.slice(0, limit).map((c) => ({ item: c, score: 1 }));
  }

  const results: { item: T; score: number }[] = [];

  for (const candidate of candidates) {
    const score = calculateSimilarity(query, candidate.name);
    if (score > 0.35) {
      results.push({ item: candidate, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
