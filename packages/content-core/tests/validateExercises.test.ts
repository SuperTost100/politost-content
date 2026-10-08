import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateExercises } from '../src/validateExercises.ts';

const SAMPLE = `---
type: esercizi
printable: true
---

:::exercise{id="E1.1" chapter="1" difficulty="facile"}
## Domanda
Q?

:::hint
H
:::

:::solution
S
:::
:::`;

describe('validateExercises', () => {
  it('accepts well-formed esercizi.md', () => {
    const r = validateExercises(SAMPLE, 'esercizi');
    assert.equal(r.valid, true);
    assert.equal(r.exerciseCount, 1);
  });

  it('warns about a missing hint in exercises but not in exams', () => {
    const noHint = (type: string) => `---\ntype: ${type}\n---\n\n:::exercise{id="X1" difficulty="medio"}\n## Domanda\nQ?\n\n:::solution\nS\n:::\n:::`;
    assert.deepEqual(validateExercises(noHint('esercizi'), 'esercizi').warnings, ['X1: hint mancante']);
    assert.deepEqual(validateExercises(noHint('esami'), 'esami').warnings, []);
  });

  it('rejects wrong frontmatter type', () => {
    const r = validateExercises(SAMPLE, 'esami');
    assert.equal(r.valid, false);
    assert.match(r.errors[0], /type atteso/);
  });

  it('rejects unbalanced blocks', () => {
    const bad = `---
type: esercizi
---

:::exercise{id="E1"
## Domanda
Q?
`;
    const r = validateExercises(bad, 'esercizi');
    assert.equal(r.valid, false);
  });

  it('rejects a well-formed exercise that never closes', () => {
    const raw = `---
type: esercizi
---

:::exercise{id="E1.1" chapter="1"}
## Domanda
Q?
`;
    const r = validateExercises(raw, 'esercizi');
    assert.equal(r.valid, false);
    assert.match(r.errors.join('\n'), /non bilanciati/);
  });

  it('rejects a difficulty outside facile, medio, difficile', () => {
    const raw = SAMPLE.replace('difficulty="facile"', 'difficulty="impossibile"');
    const r = validateExercises(raw, 'esercizi');
    assert.equal(r.valid, false);
    assert.match(r.errors.join('\n'), /impossibile/);
  });

  it('finds type anywhere in the frontmatter', () => {
    const raw = '---\nprintable: true\ntype: esercizi\n---\n\n:::exercise{id="E1.1"}\nQ\n:::hint\nH\n:::\n:::solution\nS\n:::\n:::\n';
    assert.deepEqual(validateExercises(raw, 'esercizi').errors, []);
  });
});
