# ptsb-pack

CLI Python per validare, impacchettare e ispezionare file **`.ptsb`**.

Spec: [`spec/content-format.md`](../../spec/content-format.md) · Dettaglio binario: [docs/ptsb.md](https://github.com/SuperTost100/politost-smartbook/blob/main/docs/ptsb.md)

## Installazione

```bash
pip install "git+https://github.com/SuperTost100/politost-content.git@ptsb-pack-v1.2.0#subdirectory=packages/ptsb-pack"
# oppure, da un clone
pip install -e packages/ptsb-pack
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
| [Smart Builder](https://github.com/SuperTost100/politost-smartbook-builder) | Export `.ptsb` dall’app corrente (pubblica) |
| Platform API | CEK unwrap per `.ptsb` cifrati |
