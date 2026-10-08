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
12. [Stampa](#12-stampa)

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
  "specVersion": "1.2",
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
| `access` | `public` (default) o `licensed` — vedi [ptsb.md](https://github.com/SuperTost100/politost-smartbook/blob/main/docs/ptsb.md) |
| `authors` | Opzionale. Lista di nomi, nell'ordine in cui vanno mostrati. Se presente non può essere vuota |
| `version` | Opzionale. Versione del contenuto del libro, decisa dagli autori. Consigliato semver (`1.2.0`), altrimenti il validatore dà un avviso |
| `specVersion` | Opzionale. Versione di questo formato per cui il libro è scritto, forma `MAJOR.MINOR`. Se manca vale `1.0`. Un lettore che trova una versione più nuova della sua mostra un avviso e prova comunque ad aprire il libro |
| `chapters[].id` | Slug capitolo: `/capitolo/<id>` |
| `chapters[].number` | Numero per formule `(N.M)` |
| `chapters[].printable` | Abilita versione stampabile |

### Versioni

Questo documento descrive il formato **1.2** (file `VERSION`, costante `CONTENT_FORMAT_VERSION` in content-core).

| Versione | Cambiamenti |
|----------|-------------|
| 1.2 | Il testo dei capitoli è CommonMark (markdown-it): elenchi annidati, grassetto e corsivo negli elenchi, citazioni, blocchi di codice, linee orizzontali. Il markup lasciato dal generatore è un errore. `:::hint` mancante dà un avviso solo in `esercizi.md`. Un libro 1.1 resta valido se non contiene markup del generatore |
| 1.1 | Campi opzionali `authors`, `version`, `specVersion` in `smartbook.json`. Un libro 1.0 resta valido senza modifiche |
| 1.0 | Prima versione stabile |

Il formato del contenuto e il formato del pacchetto sono separati. `specVersion` riguarda i file di questo documento. `formatVersion` in `ptsb.json` riguarda il contenitore `.ptsb` (vedi [ptsb.md](https://github.com/SuperTost100/politost-smartbook/blob/main/docs/ptsb.md)).

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

Il testo dentro un paragrafo è [CommonMark](https://spec.commonmark.org/), letto con markdown-it (content-core 0.3.0 e successivi). Formule, `{{formula:…}}` e link `ref:` vengono tolti dal testo prima del parsing, quindi `*` e `_` dentro una formula non diventano corsivo.

| Sintassi | Resa |
|----------|------|
| `**testo**` | Grassetto |
| `*testo*` o `_testo_` | Corsivo |
| `` `codice` `` | Codice inline |
| `- voce`, `1. voce` | Elenco puntato o numerato. Rientro di due o tre spazi per un elenco annidato. Grassetto, corsivo e formule funzionano dentro le voci |
| `> testo` | Citazione |
| ` ``` ` | Blocco di codice (solo recintato; il codice rientrato è disattivato) |
| `---` su una riga, fra righe vuote | Linea orizzontale |
| `### Titolo`, `#### Titolo` | Sottotitolo dentro il paragrafo. `#` e `##` (senza `pN \|`) diventano `###`; `#####` e `######` diventano `####` |
| `[testo](https://…)` | Link esterno. Ammessi solo `http:`, `https:`, `mailto:` |

Un elenco numerato interrotto da una formula display riprende dal numero indicato (`3.` dopo `2.` e la formula).

Formule:

- Inline: `$E = mc^2$`
- Display: `$$\int_0^1 x\,dx$$`

Lasciare uno spazio prima e dopo `**` quando tocca una parola (`Un **campo** è…`, non `Un**campo**è…`). CommonMark non chiude il grassetto se `**` sta fra punteggiatura e una lettera: `**campo:**è` resta testo con gli asterischi.

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

Spazi prima e dopo `{{formula:X.Y}}`. La formula può stare in un altro capitolo del libro.

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

`:::hint` è facoltativo in entrambi i file. Il validatore avvisa se manca in `esercizi.md`, non in `esami.md`: le prove d'esame si esercitano come il giorno del compito, senza suggerimenti. `:::solution` mancante dà un avviso in entrambi.

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
5. Opzionale: `npm run pack:ptsb` — vedi [ptsb.md](https://github.com/SuperTost100/politost-smartbook/blob/main/docs/ptsb.md)

L’URL usa `id` in `smartbook.json`, non il nome cartella.

---

## 9. Validazione

```bash
cd politost-smartbook
npm run validate:chapter -- \
  --file src/content/esempio/chapters/02-nel-libro.md \
  --chapter-number 2
```

Il validatore è `validateChapter` / `validateBundle` in content-core (`packages/content-core/src/validateChapter.ts`). Tra gli errori:

- paragrafi senza `## pN |`, formule con `id` incoerente, blocchi `:::` non chiusi;
- immagini senza `alt`, fuori da `assets/` o mancanti nel pacchetto;
- capitoli elencati in `smartbook.json` ma assenti, `id` non valido, metadati 1.1 con forma sbagliata;
- **markup del generatore** in un capitolo, in `esercizi.md` o in `esami.md`: tag rimasti dall'output di un modello, come `</markdown>`, `</invoke>`, `<parameter name="…">`, `<function_calls>`, `antml:*`, `tool_use`, `tool_result`. È un errore in tutti i profili (`dev` e `ship`). Chi produce i file deve toglierli prima di esportare.

Danno un avviso, in entrambi i profili: testo prima del primo `## pN |` (il parser lo mette in p1), link `ref:chapter/N#pM` verso un paragrafo che non esiste, `sections` incompleto, e negli esercizi `chapter` sconosciuto, riferimenti senza destinazione e LaTeX non valido. Codice inline e blocchi di codice sono esclusi dai controlli su `**` e LaTeX.

Il profilo `dev` riporta come avvisi molti controlli che `ship` tratta come errori. Il markup del generatore è un errore in entrambi. L'elenco completo è nei test di content-core.

`ptsb-pack validate` e `ptsb-pack pack` rifiutano lo stesso markup del generatore e le immagini mancanti. Il builder invoca il validatore di content-core dopo la generazione.

---

## 10. Convenzioni

- Formule: `id="capitolo.progressivo"` allineato a `chapters[].number`
- Paragrafi: `p1`, `p2`, … senza salti logici
- Esercizi: `E<cap>.<n>`; esami: `X<anno>-<n>`
- Delimitatori `:::` su righe dedicate
- Fine riga LF. CRLF (Windows) è accettato
- Una riga vuota tra paragrafi di testo

---

## 11. Limitazioni

| Area | Limite |
|------|--------|
| Markdown | No tabelle, no HTML (il testo `<…>` resta testo), no codice rientrato. Immagini solo con `:::image` e solo da `assets/` |
| Python | No import numpy/matplotlib preconfigurati negli snippet |
| MATLAB | Sottoinsieme didattico (no `for`, matrici, funzioni utente) |
| i18n contenuti | Nessuna — l’UI viewer è in italiano |

Per limiti del viewer (upload, DRM, stampa): [reader.md](https://github.com/SuperTost100/politost-smartbook/blob/main/docs/reader.md).

---

## 12. Stampa

Il contenuto decide solo **cosa** si può stampare: `chapters[].printable` in `smartbook.json` e `printable: true` nel frontmatter di `esercizi.md` / `esami.md`. Laboratorio e grafici non si stampano.

Come il reader impagina la stampa (foglio A4 unico, intestazioni e numeri di pagina nei margini `@page`, inchiostro su bianco) è un dettaglio del reader, non del formato: vedi [Print.md](https://github.com/SuperTost100/politost-smartbook/blob/main/docs/Print.md). Nella stampa suggerimenti e soluzioni sono sempre visibili e i link interni stampano la destinazione (`§1.6`, `(2.3)`).
