export interface SectionConfig {
  enabled: boolean;
  label: string;
}

export interface SmartbookConfig {
  id: string;
  title: string;
  subject: string;
  access?: 'public' | 'licensed';
  /** People credited for the book, in display order. Optional, spec 1.1. */
  authors?: string[];
  /** Version of this book's content, chosen by its authors. Semver recommended. Optional, spec 1.1. */
  version?: string;
  /** Content-format version the book was written for, "MAJOR.MINOR". Missing means "1.0". Optional, spec 1.1. */
  specVersion?: string;
  sections: {
    smartbook: SectionConfig;
    formulario: SectionConfig;
    esercizi: SectionConfig;
    esami: SectionConfig;
    ide: SectionConfig;
    grafici: SectionConfig;
    risposte: SectionConfig;
  };
  chapters: ChapterMeta[];
}

export interface ChapterMeta {
  id: string;
  number: number;
  title: string;
  file: string;
  printable: boolean;
}

export interface FormulaRef {
  id: string;
  chapter: number;
  number: number;
  label: string;
  latex: string;
}

export interface Paragraph {
  id: string;
  title: string;
  content: string;
}

export interface Chapter {
  meta: ChapterMeta;
  paragraphs: Paragraph[];
  formulas: FormulaRef[];
  /** Non-fatal parse issues (e.g. orphan :::formula lines). */
  warnings?: string[];
}

export interface Exercise {
  id: string;
  chapter?: number;
  type: 'esercizio' | 'esame';
  question: string;
  hint?: string;
  solution?: string;
  difficulty?: 'facile' | 'medio' | 'difficile';
}

export interface IdeSnippet {
  id: string;
  title: string;
  language: string;
  code: string;
  description?: string;
}

export interface GraficoConfig {
  id: string;
  title: string;
  type: 'function' | 'plotly';
  config: Record<string, unknown>;
}

export type SectionKey = keyof SmartbookConfig['sections'];
