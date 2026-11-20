---
chapter: 1
title: Lo spazio ℝⁿ e le funzioni di più variabili
---

## p3 | Cenni di topologia di ℝⁿ

### Intorni e classificazione dei punti

Per descrivere dove una funzione di più variabili è definita, continua o derivabile serve un linguaggio che dica «vicino a un punto» e «ai bordi di un insieme». Lo fornisce l'intorno sferico.

:::definition{id="1.1" title="palla"}
Siano $\mathbf{x}_0\in\mathbb{R}^n$ e $r>0$. La **palla aperta** di centro $\mathbf{x}_0$ e raggio $r$ è

$$
B_r(\mathbf{x}_0)=\{\mathbf{x}\in\mathbb{R}^n:\ \|\mathbf{x}-\mathbf{x}_0\|<r\},
$$

mentre la **palla chiusa** è $\overline{B}_r(\mathbf{x}_0)=\{\mathbf{x}:\ \|\mathbf{x}-\mathbf{x}_0\|\le r\}$. Per $n=1$ è un intervallo, per $n=2$ un cerchio, per $n=3$ una sfera. La norma $\|\cdot\|$ è quella richiamata in {{formula:1.1}}.
:::

Due palle con lo stesso centro sono una dentro l'altra al crescere del raggio. Due punti distinti si separano sempre con due palle disgiunte, di raggio abbastanza piccolo.

:::definition{id="1.2" title="punti interni, esterni, di frontiera"}
Sia $X\subseteq\mathbb{R}^n$ e sia $\mathbf{x}_0\in\mathbb{R}^n$.

- $\mathbf{x}_0$ è **interno** a $X$ se esiste $r>0$ con $B_r(\mathbf{x}_0)\subseteq X$.
- $\mathbf{x}_0$ è **esterno** a $X$ se esiste $r>0$ con $B_r(\mathbf{x}_0)\subseteq X^c$.
- $\mathbf{x}_0$ è **di frontiera** per $X$ se ogni palla $B_r(\mathbf{x}_0)$ contiene sia punti di $X$ sia punti di $X^c$.
:::

Un punto di frontiera può appartenere a $X$ oppure no. I punti di frontiera di $X$ e di $X^c$ coincidono.

L'insieme dei punti interni è l'**interno** $\mathring{X}$, quello dei punti di frontiera è la **frontiera** $\partial X$, quello dei punti esterni è l'**esterno**. La **chiusura** è $\overline{X}=X\cup\partial X$. Altri testi scrivono $\operatorname{int}X$ per l'interno e $\operatorname{Fr}X$ o «bordo» per la frontiera.

Ogni punto di $\mathbb{R}^n$ è esattamente di uno dei tre tipi: interno, esterno o di frontiera. Si ha sempre $\mathring{X}\subseteq X\subseteq\overline{X}$.

:::image{src="assets/2b933f2b-punti-interni-esterni-frontiera.svg" alt="Insieme X nel piano con tre punti e le loro palle: interno, esterno, di frontiera" caption="Fig. 1.1 — Classificazione dei punti rispetto a un insieme X del piano: un punto interno, uno esterno e uno di frontiera, con le rispettive palle."}
:::

Un punto $\mathbf{x}_0\in X$ è **isolato** se esiste $r>0$ con $X\cap B_r(\mathbf{x}_0)=\{\mathbf{x}_0\}$. Un punto isolato è necessariamente di frontiera.

### Insiemi aperti, chiusi, limitati, compatti

:::definition{id="1.3"}
Un insieme $X\subseteq\mathbb{R}^n$ è **aperto** se ogni suo punto è interno, cioè $X=\mathring{X}$. È **chiuso** se $X^c$ è aperto.
:::

Dalla definizione seguono due criteri pratici:

- $X$ è aperto se e solo se $X\cap\partial X=\emptyset$, cioè non contiene alcun punto della propria frontiera;
- $X$ è chiuso se e solo se $\partial X\subseteq X$, cioè contiene tutta la propria frontiera.

Quindi $X$ è chiuso se e solo se $X=\overline{X}$. Gli insiemi $\mathbb{R}^n$ e $\emptyset$ sono insieme aperti e chiusi, hanno frontiera vuota e sono gli unici con questa proprietà.

Un insieme può non essere né aperto né chiuso, e la maggior parte degli insiemi lo è. «Non aperto» non significa «chiuso».

:::definition{title="limitato, compatto" id="1.4"}
$X$ è **limitato** se esiste $R>0$ tale che $\|\mathbf{x}\|\le R$ per ogni $\mathbf{x}\in X$, cioè se $X\subseteq\overline{B}_R(\mathbf{0})$. È **compatto** se è chiuso e limitato.
:::

Esempi: il quadrato $\lbrack 0,1\rbrack ^2$ è chiuso perché contiene la sua frontiera ed è limitato perché $\|\mathbf{x}\|\le\sqrt2$, quindi è compatto. Lo stesso vale per il cubo $\lbrack 0,1\rbrack ^n$. Poligoni, cerchi, ellissi, tetraedri, prismi, coni e sfere (pieni, con il bordo) sono compatti. La chiusura di ogni insieme limitato è compatta.

### Convessità e connessione

Dati $\mathbf{a}\neq\mathbf{b}$ in $\mathbb{R}^n$, il segmento che li congiunge è

:::formula{id="1.4" label="Segmento di estremi a e b"}
$$S\lbrack \mathbf{a},\mathbf{b}\rbrack =\{\mathbf{x}=\mathbf{a}+t(\mathbf{b}-\mathbf{a}):\ 0\le t\le 1\}=\{(1-t)\mathbf{a}+t\mathbf{b}:\ 0\le t\le 1\}$$
:::

**Definizione 1.5** (convesso). $X$ è **convesso** se, per ogni coppia di punti di $X$, il segmento che li unisce è contenuto in $X$.

Una **poligonale** di vertici $\mathbf{a}_0,\dots,\mathbf{a}_r$ è l'unione dei segmenti consecutivi $S\lbrack \mathbf{a}_{i-1},\mathbf{a}_i\rbrack $, $1\le i\le r$.

**Definizione 1.6** (connesso per archi). Un insieme **aperto** $A\subseteq\mathbb{R}^n$ è **connesso** se, presi comunque $\mathbf{x},\mathbf{y}\in A$, esiste una poligonale contenuta in $A$ che li congiunge.

Ogni aperto convesso è connesso, ma non viceversa. Una corona circolare $\{r_1<\|\mathbf{x}-\mathbf{x}_0\|<r_2\}$ è connessa e non convessa. L'insieme aperto $\{xy>1\}$ non è connesso: è formato da due pezzi, uno con $x>0$ e uno con $x<0$, detti **componenti connesse**.

:::image{src="assets/2b933f2b-insiemi-convesso-connesso.svg" alt="Corona circolare con segmento che esce dall'insieme e iperbole xy>1 con due rami" caption="Fig. 1.2 — Corona circolare: connessa ma non convessa, il segmento tra due punti esce dall'insieme. Insieme {xy>1}: due componenti connesse."}
:::

Una **regione** è l'unione di un aperto connesso non vuoto $A$ e di una parte della sua frontiera. La sua frontiera è contenuta in quella di $A$, cioè $\partial R\subseteq\partial A$.

Nel seguito useremo queste nozioni per gli insiemi di definizione delle funzioni (vedi [Funzioni scalari e campi vettoriali](ref:chapter/1#p4)) e per i teoremi di Weierstrass e degli zeri (vedi [Limiti e continuità](ref:chapter/1#p5)).

### Metodo per classificare un insieme del piano

Dato un insieme $X\subseteq\mathbb{R}^2$ descritto da disuguaglianze:

1. Disegnare $X$, distinguendo i bordi inclusi dai bordi esclusi.
2. Individuare i punti candidati alla frontiera, come quelli sulle curve in cui una disuguaglianza diventa uguaglianza, e verificarli con la definizione: ogni palla centrata in un punto di frontiera deve incontrare sia $X$ sia il suo complementare. Considerare anche gli eventuali punti isolati o esclusi.
3. L'interno è $X$ meno i punti di frontiera che gli appartengono. La chiusura è $X$ più i punti di frontiera che non gli appartengono.
4. Confrontare: $X$ è aperto se $X\cap\partial X=\emptyset$, chiuso se $\partial X\subseteq X$.
5. Limitato: stimare $\|\mathbf{x}\|$ su $X$. Compatto: chiuso e limitato.
6. Convesso: cercare due punti il cui segmento esce da $X$. Connesso: cercare una poligonale per ogni coppia di punti, o riconoscere i pezzi separati.

:::example{id="1.3"}
Sia $A=\{(x,y)\in\mathbb{R}^2:\ 0\le x\le1,\ 0<y<1\}$.

- Il disegno è un quadrato con i lati verticali $x=0$ e $x=1$ inclusi e i lati orizzontali $y=0$ e $y=1$ esclusi.
- Frontiera: l'unione dei quattro lati del quadrato. Contiene punti di $A$ (i lati verticali, tranne gli estremi) e punti non di $A$ (i lati orizzontali).
- Interno: togliendo da $A$ i lati verticali resta il quadrato aperto $\mathring{A}=(0,1)^2$.
- Chiusura: aggiungendo i lati orizzontali si ha $\overline{A}=\lbrack 0,1\rbrack ^2$.
- $A$ non è aperto, perché contiene punti di frontiera. Non è chiuso, perché non contiene tutta la frontiera. È limitato, convesso e quindi connesso.
:::

**Esempio 1.4.** Sia $C=\{(x,y)\in\mathbb{R}^2:\ |y|>2\}$, cioè l'unione dei semipiani $y>2$ e $y<-2$.

- Interno: $\mathring{C}=C$, perché intorno a ogni punto si può prendere una palla di raggio $|y|-2$ contenuta in $C$.
- Frontiera: le due rette $y=2$ e $y=-2$, nessuna delle quali appartiene a $C$. La chiusura è $\{|y|\ge2\}$.
- $C$ è aperto. Non è limitato. Non è convesso: il segmento da $(0,3)$ a $(0,-3)$ passa per l'origine, che non è in $C$. Non è connesso: ogni poligonale tra i due semipiani deve attraversare la striscia $|y|\le2$.

**Esempio 1.5** (un punto isolato). Sia $D=\{x^2+y^2<4\}\setminus(\lbrack -1,1\rbrack \times\{0\})$, un cerchio aperto privato di un segmento.

- $D$ è aperto, perché si toglie un insieme chiuso da un aperto.
- La frontiera è la circonferenza $x^2+y^2=4$ unita al segmento $\lbrack -1,1\rbrack \times\{0\}$. La chiusura è il cerchio chiuso $\{x^2+y^2\le4\}$.
- $D$ è limitato e connesso, perché si può aggirare il segmento con una poligonale. Non è convesso: il segmento da $(0,1)$ a $(0,-1)$ attraversa il taglio.

Se invece si aggiunge a un insieme un punto lontano dal resto, quel punto è isolato e quindi di frontiera. Ne è un esempio $(0,1)$ nell'insieme $\{y^2\le x^2,\ x\neq0\}\cup\{(0,1)\}$.

:::mistake{id="1.3"}
Concludere che un insieme è chiuso perché «non è aperto». Un insieme come $A$ dell'esempio precedente non è né aperto né chiuso. Per decidere si controlla sempre se $X$ contiene tutta la frontiera (chiuso) o nessun punto di essa (aperto).
:::

**Errore tipico 1.4.** Dimenticare i punti esclusi o isolati quando si cerca la frontiera. Un punto tolto al dominio, come l'origine nel quoziente $y^2/x^2$, o un punto aggiunto da una disuguaglianza degenere, come $x^2+(y-1)^2\le0$, è un punto di frontiera.

**Errore tipico 1.5.** Dedurre «connesso» da «limitato» o «convesso» da «connesso». La corona circolare è connessa ma non convessa. La connessione richiede una poligonale tra ogni coppia di punti, e il segmento che li unisce può uscire dall'insieme.

## p5 | Limiti e continuità

### Definizioni e proprietà

Sia $\boldsymbol{f} : \operatorname{dom}\boldsymbol{f} \subseteq \mathbb{R}^n \to \mathbb{R}^m$ e sia $\boldsymbol{x}_0 \in \mathbb{R}^n$ un punto di accumulazione per $\operatorname{dom}\boldsymbol{f}$.

**Definizione 1.10** (limite). Si dice che $\boldsymbol{f}$ ha limite $\boldsymbol{\ell} \in \mathbb{R}^m$ per $\boldsymbol{x}$ tendente a $\boldsymbol{x}_0$, e si scrive $\lim_{\boldsymbol{x}\to\boldsymbol{x}_0}\boldsymbol{f}(\boldsymbol{x}) = \boldsymbol{\ell}$, se

$$
\forall \varepsilon>0\ \exists \delta>0 :\ \forall \boldsymbol{x}\in\operatorname{dom}\boldsymbol{f},\ 0<\|\boldsymbol{x}-\boldsymbol{x}_0\|<\delta \implies \|\boldsymbol{f}(\boldsymbol{x})-\boldsymbol{\ell}\|<\varepsilon,
$$

cioè $\boldsymbol{x}\in B_\delta(\boldsymbol{x}_0)\setminus\{\boldsymbol{x}_0\}$ implica $\boldsymbol{f}(\boldsymbol{x})\in B_\varepsilon(\boldsymbol{\ell})$.

**Definizione 1.11** (continuità). Sia $\boldsymbol{x}_0 \in \operatorname{dom}\boldsymbol{f}$. La funzione $\boldsymbol{f}$ è continua in $\boldsymbol{x}_0$ se

$$
\forall \varepsilon>0\ \exists \delta>0 :\ \forall \boldsymbol{x}\in\operatorname{dom}\boldsymbol{f},\ \|\boldsymbol{x}-\boldsymbol{x}_0\|<\delta \implies \|\boldsymbol{f}(\boldsymbol{x})-\boldsymbol{f}(\boldsymbol{x}_0)\|<\varepsilon.
$$

È continua su $\Omega\subseteq\operatorname{dom}\boldsymbol{f}$ se è continua in ogni punto di $\Omega$.

Se $\boldsymbol{x}_0\in\operatorname{dom}\boldsymbol{f}$ è di accumulazione, la continuità equivale a $\lim_{\boldsymbol{x}\to\boldsymbol{x}_0}\boldsymbol{f}(\boldsymbol{x})=\boldsymbol{f}(\boldsymbol{x}_0)$. Se $\boldsymbol{x}_0$ è un punto isolato del dominio, $\boldsymbol{f}$ è continua in $\boldsymbol{x}_0$ per definizione.

Una funzione $\boldsymbol{f}=(f_1,\dots,f_m)$ è continua in $\boldsymbol{x}_0$ se e solo se lo sono tutte le componenti $f_i$. Lo stesso vale per il limite, che si calcola componente per componente. Per le funzioni a valori vettoriali valgono unicità del limite, limite della somma e sostituzione nei limiti (da cui la continuità della funzione composta), ma non i teoremi del confronto.

Il criterio delle successioni caratterizza il limite anche per domini arbitrari: $\lim_{\boldsymbol{x}\to\boldsymbol{x}_0} f(\boldsymbol{x})=\ell$ se e solo se, per ogni successione $\boldsymbol{x}_k\in\operatorname{dom}f$ tale che $\boldsymbol{x}_k\to\boldsymbol{x}_0$ e $\boldsymbol{x}_k\neq\boldsymbol{x}_0$, si ha $f(\boldsymbol{x}_k)\to\ell$. Per ogni curva $\boldsymbol{\gamma}: I\to\mathbb{R}^n$ tale che $\boldsymbol{\gamma}(t)\to\boldsymbol{x}_0$ e $\boldsymbol{\gamma}(t)\neq\boldsymbol{x}_0$ per $t\neq t_0$, con $\boldsymbol{\gamma}(t)\in\operatorname{dom}f$ per $t\neq t_0$, l'esistenza del limite implica $\lim_{t\to t_0}f(\boldsymbol{\gamma}(t))=\ell$. Rette, parabole e altre curve che si avvicinano a $\boldsymbol{x}_0$ sono quindi utili per escludere l'esistenza del limite: due cammini con limiti diversi bastano a escluderla.

### Tecniche di calcolo

### Non esistenza: restrizioni a rette e curve

Se si trovano due restrizioni di $f$ con limiti distinti, il limite complessivo non esiste. Il metodo è questo:

1. si restringe $f$ agli assi coordinati e alle rette $y=kx$ (per il punto $(x_0,y_0)$: $y-y_0=k(x-x_0)$);
2. se i limiti dipendono da $k$ o dal cammino, si conclude che il limite non esiste;
3. se tutte le rette danno lo stesso valore, si provano curve più "tangenti" agli assi, come $y=x^2$ o $x=y^2$.

**Esempio 1.10.** Sia $f(x,y)=\dfrac{xy}{x^2+y^2}$ e si studi il limite in $(0,0)$. Sugli assi $f$ è identicamente nulla, quindi $\lim_{x\to0}f(x,0)=\lim_{y\to0}f(0,y)=0$. Lungo $y=x$, con $x\ne0$, si ha

$$
f(x,x)=\frac{x^2}{x^2+x^2}=\frac12 \ \Rightarrow\ \lim_{x\to0}f(x,x)=\frac12\neq 0.
$$

Il limite non esiste.

**Esempio 1.11.** Sia $f(x,y)=x\,e^{x/y}$ per $y\neq0$ e $f(x,0)=0$. Sugli assi $f$ vale $0$. Su $y=kx$, con $k\ne0$, si ha $f(x,kx)=x\,e^{1/k}\to0$. Dunque su ogni retta per l'origine il limite è $0$. Sull'arco di parabola $y=x^2$, $x>0$:

$$
f(x,x^2)=x\,e^{1/x}\to+\infty \quad (x\to0^+).
$$

Il limite non esiste.

**Errore tipico 1.9.** Concludere che il limite esiste e vale $0$ perché "lungo tutte le rette viene $0$". Le rette sono solo uno degli infiniti modi di avvicinarsi al punto: due legami diversi fra $x$ e $y$ possono dare comportamenti diversi, come mostra l'ultimo esempio. Le restrizioni provano la non esistenza, mai l'esistenza. Per provare l'esistenza servono una maggiorazione o le coordinate polari.

### Esistenza: maggiorazioni e confronto

Per dimostrare che il limite vale $\ell$ si maggiora $|f(x,y)-\ell|$ con una quantità che tende a $0$ e si usa il teorema del doppio confronto (per funzioni a valori scalari). Si usano disuguaglianze come $|x|\le\sqrt{x^2+y^2}$.

**Esempio 1.12.** Sia $f(x,y)=\dfrac{|x||y|}{\sqrt{x^2+y^2}}$. Poiché $\dfrac{|x|}{\sqrt{x^2+y^2}}\le1$, si ottiene $0\le|f(x,y)|\le|y|\to0$. Quindi $\lim_{(x,y)\to(0,0)}f(x,y)=0$.

### Coordinate polari

Nel piano si pone $x=x_0+r\cos\theta$, $y=y_0+r\sin\theta$.

:::theorem{id="1.1" title="criterio delle coordinate polari"}
Sia $f$ definita in un intorno forato di $(x_0,y_0)$. Se esistono $\ell\in\mathbb{R}$ e una funzione $g$ della sola variabile $r$ tali che, in un intorno di $(x_0,y_0)$,

$$
|f(x_0+r\cos\theta,\,y_0+r\sin\theta)-\ell|\le g(r)\quad\text{con}\quad \lim_{r\to0^+}g(r)=0,
$$

allora $\lim_{(x,y)\to(x_0,y_0)}f(x,y)=\ell$.
:::

L'ipotesi essenziale è che $g$ **non dipenda da $\theta$**: la stessa maggiorazione deve valere per ogni direzione di avvicinamento. In pratica si procede così.

1. Si traslano le variabili nel punto e si sostituisce.
2. Si semplifica e si maggiora usando $|\sin\theta|\le1$, $|\cos\theta|\le1$.
3. Si cerca $g(r)\to0$. Se invece il limite per $r\to0$ dipende da $\theta$, il limite in due variabili non esiste.

:::example{id="1.13"}
Sia $f(x,y)=\dfrac{x^2}{\sqrt{x^2+y^2}}$ nell'origine. Si ha

$$
|f(r\cos\theta,r\sin\theta)|=\frac{r^2\cos^2\theta}{r}=r\cos^2\theta\le r,
$$

quindi il criterio si applica con $g(r)=r$ e il limite vale $0$.
:::

**Esempio 1.14.** Si consideri $\displaystyle\lim_{(x,y)\to(0,1)}\frac{x\log y}{\sqrt{x^2+(y-1)^2}}$. Con $x=r\cos\theta$, $y=1+r\sin\theta$ si ha $f=\cos\theta\,\log(1+r\sin\theta)$. Dal limite notevole $\log(1+t)/t\to1$ segue $|\log(1+t)|\le2|t|$ per $|t|$ piccolo, dunque

$$
|f|\le 2r|\sin\theta\cos\theta|\le 2r=g(r)\to0.
$$

Il limite vale $0$.

:::example{id="1.15" title="limite che dipende da $\theta$"}
Se $f(r\cos\theta,r\sin\theta)=\dfrac{\cos\theta-\sin\theta}{\cos\theta+\sin\theta}$, il valore non dipende da $r$ ma varia con $\theta$. Il limite per $r\to0$ cambia al variare della direzione e il limite in due variabili non esiste.
:::

**Errore tipico 1.10.** Maggiorare lasciando $\theta$ nell'espressione di $g$, o fissare un $\theta$ e calcolare solo $\lim_{r\to0}$ lungo quella direzione. Un singolo $\theta$ è una retta e non basta, come sopra.

### Teoremi di Weierstrass e degli zeri

:::theorem{id="1.2" title="di Weierstrass"}
Sia $f$ continua su un insieme compatto $K\subseteq\operatorname{dom}f$. Allora $f(K)$ è chiuso e limitato in $\mathbb{R}$ e, se $K$ è connesso, è un intervallo chiuso. In particolare $f$ assume su $K$ valore minimo e massimo.
:::

Ricordiamo che compatto significa chiuso e limitato (si veda [Cenni di topologia di $\mathbb{R}^n$](ref:chapter/1#p3)). Il teorema garantisce l'esistenza degli estremi, ma non li calcola. Se $f$ è continua sul compatto e differenziabile in ogni suo punto interno, e non ha punti stazionari interni, gli estremi esistono e vanno cercati sulla frontiera.

:::example{id="1.16"}
La funzione $f(x,y)=x^2-y$ è continua sul disco chiuso $K=\{(x,y):x^2+y^2\le1\}$, che è chiuso e limitato. Per Weierstrass ammette massimo e minimo su $K$. Gli estremi, per quanto detto, non possono essere interni perché $\nabla f=(2x,-1)\neq\boldsymbol{0}$, e vanno cercati su $\partial K$.
:::

:::mistake{id="1.11"}
Applicare Weierstrass su un insieme non compatto, per esempio il disco aperto $x^2+y^2<1$, oppure su un insieme limitato ma non chiuso. In tal caso gli estremi possono non esistere, ad esempio per $f(x,y)=x$ sul disco aperto.
:::

:::theorem{id="1.3" title="degli zeri"}
Sia $f$ continua su una regione $R\subseteq\mathbb{R}^n$ (un insieme connesso per poligonali). Se $f$ assume in $R$ sia valori strettamente positivi sia valori strettamente negativi, allora $f$ si annulla in almeno un punto di $R$.
:::

:::proof
L'idea: si congiungono i punti $\boldsymbol{a}$, $\boldsymbol{b}$ con $f(\boldsymbol{a})<0<f(\boldsymbol{b})$ con una poligonale in $R$. Su almeno un suo segmento $f$ cambia segno e vi si applica il teorema degli zeri in una variabile. Ne segue il teorema dei valori intermedi.
:::

**Esempio 1.17.** Sia $f(x,y)=x^2+y^2-1$, continua su $\mathbb{R}^2$ (connesso). Poiché $f(0,0)=-1<0$ e $f(2,0)=3>0$, esiste almeno un punto dove $f=0$. L'insieme degli zeri è la circonferenza unitaria.

**Errore tipico 1.12.** Applicare il teorema degli zeri su un insieme non connesso. Se $R=\{x\ne0\}$ e $f(x,y)=x$, la funzione è continua e assume valori di entrambi i segni su $R$ ma non si annulla mai, perché $R$ è unione di due semipiani separati.
