import { normalizeNewlines, parseExercises } from './parser';

export interface ExerciseValidationResult {
  valid: boolean;
  exerciseCount: number;
  errors: string[];
  warnings: string[];
}

const FRONTMATTER = /^---[ \t]*\n([\s\S]*?)\n---/;
const FM_TYPE = /^type:\s*(\S+)/m;
const DIFFICULTY = new Set<string>(['facile', 'medio', 'difficile']);
const FENCE_OPEN = /^:::(exercise|hint|solution)(\{|\s|$)/;

function unbalancedFences(body: string): boolean {
  let depth = 0;
  for (const line of body.split('\n')) {
    if (!line.startsWith(':::')) continue;
    if (FENCE_OPEN.test(line)) {
      depth += 1;
      continue;
    }
    if (line === ':::') {
      depth -= 1;
      if (depth < 0) return true;
    }
  }
  return depth !== 0;
}

/** Structural validation for esercizi.md / esami.md (parse + frontmatter). */
export function validateExercises(
  raw: string,
  expectedType: 'esercizi' | 'esami',
): ExerciseValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  raw = normalizeNewlines(raw);
  const frontmatter = FRONTMATTER.exec(raw);
  const type = frontmatter ? FM_TYPE.exec(frontmatter[1])?.[1] : undefined;
  if (!type) {
    errors.push('frontmatter mancante — atteso --- con type');
  } else if (type !== expectedType) {
    errors.push(`type atteso "${expectedType}", trovato "${type}"`);
  }

  const body = raw.replace(/^---[\s\S]*?---\n*/, '');
  if (unbalancedFences(body)) {
    errors.push('blocchi ::: non bilanciati');
  }
  const openCount = (body.match(/:::exercise\{/g) ?? []).length;
  const defaultKind = expectedType === 'esami' ? 'esame' : 'esercizio';
  const exercises = parseExercises(raw, defaultKind);

  if (openCount > 0 && exercises.length === 0) {
    errors.push('blocchi :::exercise non bilanciati o malformati');
  } else if (openCount !== exercises.length) {
    errors.push(
      `blocchi exercise: ${openCount} aperti, ${exercises.length} parsati`,
    );
  }

  const seen = new Set<string>();
  for (const ex of exercises) {
    if (ex.difficulty && !DIFFICULTY.has(ex.difficulty)) {
      errors.push(
        `${ex.id || 'exercise'}: difficulty "${ex.difficulty}" non valida — atteso facile, medio o difficile`,
      );
    }
    if (!ex.id) {
      errors.push('exercise senza attributo id');
      continue;
    }
    if (seen.has(ex.id)) errors.push(`id duplicato: ${ex.id}`);
    seen.add(ex.id);
    if (!ex.question.trim()) warnings.push(`${ex.id}: domanda vuota`);
    // Exams are practised as on the day: no hint expected.
    if (expectedType === 'esercizi' && !ex.hint?.trim()) warnings.push(`${ex.id}: hint mancante`);
    if (!ex.solution?.trim()) warnings.push(`${ex.id}: solution mancante`);
  }

  return {
    valid: errors.length === 0,
    exerciseCount: exercises.length,
    errors,
    warnings,
  };
}
