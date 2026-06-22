export interface SectionConfig {
  enabled: boolean;
  label: string;
}

export interface SmartbookConfig {
  id: string;
  title: string;
  subject: string;
  access?: 'public' | 'licensed';
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
