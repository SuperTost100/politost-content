# ptsb-pack

CLI Python per validare, impacchettare e ispezionare file **`.ptsb`**.

Spec: [politost-content-format](https://github.com/SuperTost100/politost-content-format) · Dettaglio binario: [docs/ptsb.md](https://github.com/SuperTost100/politost-smartbook/blob/main/docs/ptsb.md)

## Installazione

```bash
pip install git+https://github.com/SuperTost100/politost-ptsb-pack.git
# oppure
git clone https://github.com/SuperTost100/politost-ptsb-pack.git && cd politost-ptsb-pack && pip install -e .
```

## Comandi

```bash
ptsb-pack validate ./output
ptsb-pack pack ./output --out libro.ptsb
export PTSB_MASTER_SECRET=your-secret-min-32-chars
ptsb-pack pack ./output --out libro.ptsb --encrypt --access licensed
ptsb-pack inspect libro.ptsb
```

## Integrazione

| Componente | Uso |
|------------|-----|
| [politost-smartbook](https://github.com/SuperTost100/politost-smartbook) | `npm run pack:ptsb` |
| [Smart Builder](https://github.com/SuperTost100/politost-smartbook-builder) | Export `.ptsb` dall’app corrente (privata) |
| Platform API | CEK unwrap per `.ptsb` cifrati |
