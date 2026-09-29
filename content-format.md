# Formato contenuti Smartbook

Specifica del **contenuto** di uno smartbook: file, sintassi e convenzioni. Vale per:

- libri scritti a mano in `politost-smartbook/src/content/`;
- output della pipeline `smartbook-builder`;
- payload interno di un file `.ptsb`.

Il **reader** interpreta questi file; il **builder** li genera; **ptsb-pack** li impacchetta. Qualsiasi modifica alla sintassi richiede aggiornamento di parser, validatore e prompt del builder.

---

## Indice

1. [Panoramica sezioni](#1-panoramica-sezioni)
2. [Struttura cartella](#2-struttura-cartella)
3. [smartbook.json](#3-smartbookjson)
4. [Capitoli](#4-capitoli)
5. [Esercizi ed esami](#5-esercizi-ed-esami)
6. [Laboratorio (ide.json)](#6-laboratorio-idejson)
7. [Grafici (grafici.json)](#7-grafici-graficijson)
8. [Creare uno smartbook](#8-creare-uno-smartbook)
9. [Validazione](#9-validazione)
10. [Convenzioni](#10-convenzioni)
11. [Limitazioni](#11-limitazioni)

---

## 1. Panoramica sezioni

Ogni smartbook espone fino a sette aree nel viewer. Ogni area può essere attivata e rinominata in `smartbook.json`.

| Chiave `sections` | Scopo tipico |
|-------------------|--------------|
| `smartbook` | Testo principale (capitoli) |
| `formulario` | Formule numerate raccolte automaticamente |
| `esercizi` | Domande con suggerimento e soluzione |
| `esami` | Esercizi tipo compito |
| `ide` | Laboratorio codice (Python / MATLAB) |
| `grafici` | Visualizzazioni interattive |
| `risposte` | Soluzioni in sezione separata (di default disabilitata) |

---

## 2. Struttura cartella

```
<id-smartbook>/
├── smartbook.json
├── chapters/
│   ├── 01-benvenuto.md
│   └── ...
├── esercizi.md          # opzionale
├── esami.md             # opzionale
├── ide.json             # opzionale
├── grafici.json         # opzionale
└── assets/              # opzionale — immagini locali
```

### Esempio reale

Vedi `politost-smartbook/src/content/esempio/` — libro dimostrativo integrato nel viewer.

---

## 3. smartbook.json

```json
{
  "id": "esempio",
  "title": "Guida di esempio",
  "subject": "Esempio",
  "access": "public",
  "authors": ["Ada Rossi", "Luca Bianchi"],
  "version": "1.2.0",
  "specVersion": "1.1",
  "sections": {
    "smartbook":  { "enabled": true, "label": "Capitoli" },
    "formulario": { "enabled": true, "label": "Formulario" },
    "esercizi":   { "enabled": true, "label": "Esercizi" },
    "esami":      { "enabled": true, "label": "Prove d'esame" },
    "ide":        { "enabled": true, "label": "Laboratorio" },
    "grafici":    { "enabled": true, "label": "Grafici & Calcoli" },
    "risposte":   { "enabled": false, "label": "Soluzioni" }
  },
  "chapters": [
    {
      "id": "benvenuto",
      "number": 1,
      "title": "Benvenuto",
      "file": "01-benvenuto.md",
      "printable": true
    }
  ]
}
```

| Campo | Descrizione |
|-------|-------------|
| `id` | Slug URL: `/libro/<id>` |
| `title` | Titolo in header e catalogo |
| `subject` | Badge materia in home |
| `access` | `public` (default) o `licensed` — vedi [ptsb.md](ptsb.md) |
| `authors` | Opzionale. Lista di nomi, nell'ordine in cui vanno mostrati. Se presente non può essere vuota |
| `version` | Opzionale. Versione del contenuto del libro, decisa dagli autori. Consigliato semver (`1.2.0`), altrimenti il validatore dà un avviso |
| `specVersion` | Opzionale. Versione di questo formato per cui il libro è scritto, forma `MAJOR.MINOR`. Se manca vale `1.0`. Un lettore che trova una versione più nuova della sua mostra un avviso e prova comunque ad aprire il libro |
| `chapters[].id` | Slug capitolo: `/capitolo/<id>` |
| `chapters[].number` | Numero per formule `(N.M)` |
| `chapters[].printable` | Abilita versione stampabile |

### Versioni

Questo documento descrive il formato **1.1** (file `CONTENT_FORMAT_VERSION`).

| Versione | Cambiamenti |
|----------|-------------|
| 1.1 | Campi opzionali `authors`, `version`, `specVersion` in `smartbook.json`. Un libro 1.0 resta valido senza modifiche |
| 1.0 | Prima versione stabile |

Il formato del contenuto e il formato del pacchetto sono separati. `specVersion` riguarda i file di questo documento. `formatVersion` in `ptsb.json` riguarda il contenitore `.ptsb` (vedi [ptsb.md](ptsb.md)).

---

## 4. Capitoli

File: `chapters/*.md`. Sintassi **Markdown esteso** con blocchi `:::`. Parser: `parseChapterMarkdown` in `packages/content-core/src/parser.ts`.

Il file può aprire con frontmatter YAML (`chapter`, `title`). Il parser lo toglie e poi legge i paragrafi.

```markdown
---
chapter: 1
title: Benvenuto
---
```

| Campo | Descrizione |
|-------|-------------|
| `chapter` | Numero del capitolo, allineato a `chapters[].number` |
| `title` | Titolo del capitolo |

### Paragrafi (obbligatori)

```markdown
## p1 | Titolo del paragrafo

Testo del paragrafo…
```

- Formato rigido: `## p<N> | <titolo>`
- ID usato nei link `ref:chapter/N#pM`

### Testo e formule inline

- **Grassetto**: `**testo**` — lasciare uno spazio prima e dopo i delimitatori `**` se adiacenti a parole (es. `Un **campo** è…`, non `Un**campo**è…`)
- Inline: `$E = mc^2$`
- Display: `$$\int_0^1 x\,dx$$`

### Formule numerate

```markdown
:::formula{id="2.1" label="Velocità media"}
$$v = \frac{s}{t}$$
:::
```

- `id` = `capitolo.numero` (deve coincidere con `chapters[].number`)
- Compare nel testo come `(2.1)`, nel formulario e nei riferimenti

### Riferimento hover

```markdown
Come nella {{formula:2.1}}, si ottiene…
```

Spazi prima e dopo `{{formula:X.Y}}`.

### Link interni

| Sintassi | Destinazione |
|----------|--------------|
| `[testo](ref:formula/2.1)` | Formulario, formula (2.1) |
| `[testo](ref:chapter/1#p2)` | Capitolo 1, paragrafo p2 |

Lasciare spazi attorno ai link Markdown come per `{{formula:…}}` (es. `… al [capitolo 2](ref:chapter/2#p1) per …`).

### Immagini

Solo file in `assets/`. Niente URL esterni.

```markdown
:::image{src="assets/schema.svg" alt="Descrizione" caption="Fig. 2.1 — Didascalia"}
:::
```

Formati: `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`.

---

## 5. Esercizi ed esami

File: `esercizi.md` e/o `esami.md`.

```markdown
---
type: esercizi
printable: true
---

:::exercise{id="E1.1" chapter="1" difficulty="facile"}
## Domanda
Testo della domanda…

:::hint
Suggerimento (opzionale). Può usare {{formula:1.1}}.
:::

:::solution
Soluzione passo passo.
:::
:::
```

| Attributo exercise | Valori |
|--------------------|--------|
| `id` | Univoco (`E1.1`, `X2024-1`, …) |
| `chapter` | Numero capitolo (badge) |
| `difficulty` | `facile`, `medio`, `difficile` |
| `type` | `esame` in `esami.md` |

`:::hint` e `:::solution` sono annidati dentro `:::exercise`.

---

## 6. Laboratorio (ide.json)

Array di snippet:

```json
[
  {
    "id": "ciao",
    "title": "Primo programma",
    "language": "python",
    "description": "Testo sopra l'editor",
    "code": "print('Ciao')"
  }
]
```

| `language` | Runtime nel viewer |
|------------|-------------------|
| `python` | Pyodide (self-hosted) |
| `matlab`, `octave`, `m` | Interprete didattico (sottoinsieme) |

---

## 7. Grafici (grafici.json)

### Tipo `function`

```json
{
  "id": "sinusoide",
  "title": "Curva di esempio",
  "type": "function",
  "config": {
    "functions": [{ "fn": "sin(x)", "label": "sin(x)" }],
    "xDomain": [0, 6.28],
    "yDomain": [-1.2, 1.2],
    "xLabel": "x",
    "yLabel": "y"
  }
}
```

`fn` usa variabile `x` e `^` per le potenze.

### Tipo `plotly`

Configurazione `data` + `layout` Plotly nativa (barre, scatter, ecc.).

---

## 8. Creare uno smartbook

1. `mkdir -p src/content/mio-libro/chapters`
2. Scrivi `smartbook.json` e almeno un capitolo `.md`
3. Aggiungi file ausiliari (`esercizi.md` vuoto, `ide.json` → `[]`, …) se le sezioni sono abilitate
4. `npm run dev` nel viewer — la cartella viene scoperta automaticamente (`import.meta.glob`)
5. Opzionale: `npm run pack:ptsb` — vedi [ptsb.md](ptsb.md)

L’URL usa `id` in `smartbook.json`, non il nome cartella.

---

## 9. Validazione

```bash
cd politost-smartbook
npm run validate:chapter -- \
  --file src/content/esempio/chapters/02-nel-libro.md \
  --chapter-number 2
```

Controlla: paragrafi `## pN |`, formule con `id` coerente, chiusura blocchi `:::`, immagini con `alt`.

Il builder invoca lo stesso validatore dopo la generazione AI.

---

## 10. Convenzioni

- Formule: `id="capitolo.progressivo"` allineato a `chapters[].number`
- Paragrafi: `p1`, `p2`, … senza salti logici
- Esercizi: `E<cap>.<n>`; esami: `X<anno>-<n>`
- Delimitatori `:::` su righe dedicate
- Una riga vuota tra paragrafi di testo

---

## 11. Limitazioni

| Area | Limite |
|------|--------|
| Markdown | No tabelle; immagini solo in `assets/` |
| Python | No import numpy/matplotlib preconfigurati negli snippet |
| MATLAB | Sottoinsieme didattico (no `for`, matrici, funzioni utente) |
| i18n contenuti | Nessuna — l’UI viewer è in italiano |

Per limiti del viewer (upload, DRM, stampa): [reader.md](reader.md).

---

## 12. Print CSS contract (appendix)

Anteprima stampa (`politost-smartbook/src/print/`) impagina contenuto in un iframe isolato con Paged.js.

### Stylesheet stack (iframe)

In ordine: KaTeX → `document.css` → `paged.css`. `tokens.css` è importato da `document.css`.

| File | Ruolo |
|------|-------|
| `tokens.css` | Variabili tipografia, margini pagina A4, colori inchiostro/carta |
| `document.css` | Layout contenuto: `.print-flow`, paragrafi, formule, esercizi, figure |
| `paged.css` | `@page`, running heads (`string-set` da `.print-meta`), footer Politost, watermark |

### DOM contract

| Classe / attributo | Uso |
|--------------------|-----|
| `.print-root` > `.print-meta` | `data-book-title`, `data-section-title` per running heads |
| `.print-brand-block` | Apertura documento (wordmark + titolo) |
| `.print-flow` | Corpo paginato — unico nodo passato a Paged.js |
| `.print-chunk[data-chunk-id]` | Blocchi per deduplica post-paginazione |
| `.numbered-formula[data-formula-id]` | Formule numerate; id univoci su tutte le pagine |
| `.paragraph-title` | Titoli paragrafo; deduplica su page break |

Dopo la paginazione, `.print-root` e `.print-flow` **non** devono restare nel DOM iframe (solo `.pagedjs_pages`).

### Shell (viewer)

`shell.css` resta nel viewer: toolbar, loading screen, canvas — fuori dall'iframe.

