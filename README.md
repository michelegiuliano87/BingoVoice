# BingoVoice

BingoVoice e' un software desktop per Windows pensato per gestire estrazioni stile tombola basate su immagini, audio e contenuti multimediali, con schermo pubblico separato e gestione licenze.

## Cos'e' BingoVoice

BingoVoice permette di organizzare una tombola multimediale in cui:

- l'admin prepara uno o piu' progetti
- ogni progetto contiene immagini e audio associati
- durante l'estrazione il pubblico vede lo schermo dedicato in tempo reale
- prima dell'uscita finale viene mostrata una lucky wheel animata
- le estrazioni finiscono su un tabellone da 90 posti
- e' possibile usare bonus voice, video speciali e contenuti dedicati per evento

In pratica e' una versione scenica e gestibile da PC della tombola, pensata per serate, eventi, locali e format personalizzati.

## Funzioni principali

- Dashboard admin per la gestione dell'estrazione
- Schermo pubblico separato per il pubblico
- Lucky wheel prima di ogni estrazione
- Progetti con miniatura dedicata
- Media associati a ogni progetto
- Audio dedicato a ogni immagine
- Bonus Voice e Panariello Band
- Gestione cartelle di gioco
- Pannello licenze locale avanzato
- Aggiornamenti automatici tramite GitHub Releases
- Accesso a moduli tramite permessi sulla licenza

## Architettura attuale

Il progetto e' stato convertito in applicazione desktop Electron e non dipende piu' da Base44 per il funzionamento operativo.

Tecnologie principali:

- Electron
- React
- Vite
- React Query
- Electron Builder
- Electron Updater

Nome tecnico interno nel codice:

- `toretto`

Nome visibile per utenti e clienti:

- `BingoVoice`

## Come funziona il gioco

### 1. Preparazione

L'admin crea un progetto e carica:

- immagini
- audio per le immagini
- eventuali contenuti bonus
- cartelle
- video speciali
- impostazioni generali

### 2. Selezione progetto

Dalla dashboard viene scelto il progetto attivo tramite miniatura.

### 3. Estrazione

Quando si preme `ESTRAI`:

- il sistema sceglie casualmente un media non ancora estratto
- sullo schermo pubblico appare la lucky wheel
- al termine esce l'immagine finale
- l'elemento viene salvato nella cronologia e nel tabellone

### 4. Bonus Voice

Se il progetto ha un elemento marcato come bonus, viene usato quello.

Se non e' stato marcato manualmente:

- il programma sceglie un bonus casuale stabile per quel progetto
- il pulsante `Mostra Bonus Voice` mostra proprio quel bonus
- la logica resta coerente anche in estrazione

## Pagine principali

### Dashboard

Contiene:

- selezione progetto
- cronologia estrazioni
- pulsante estrazione
- controllo cartella
- lista media del progetto
- pulsante bonus
- gestione video e impostazioni, se abilitate dalla licenza

### Progetti

Permette di:

- creare un progetto
- modificare titolo e descrizione
- caricare miniatura quadrata
- aggiungere media
- modificare media gia' caricati
- usare il progetto poi in dashboard

### Carica Cartelle

Permette di:

- creare cartelle da 15 elementi
- filtrare per progetto
- modificare cartelle esistenti

### Pannello Admin

Permette di:

- creare clienti
- creare licenze
- gestire durata e numero dispositivi
- revocare, sospendere e rinnovare licenze
- assegnare moduli attivi per ogni cliente

## Sistema licenze

Il programma si apre solo con licenza valida.

Il proprietario prioritario e':

- `michele.giuliano.87@hotmail.com`

Le licenze possono attivare o bloccare moduli specifici:

- `Pannello Admin`
- `Crea/Modifica Progetti`
- `Carica Cartelle`
- `Pulsanti Video`
- `Impostazioni Generali`

Questo permette di installare la stessa app su piu' PC clienti, ma mostrare solo le funzioni previste per quella licenza.

## Aggiornamenti automatici

Gli aggiornamenti usano GitHub Releases.

Flusso attuale:

1. il cliente apre BingoVoice
2. se la licenza attiva e' salvata sul PC, prima della dashboard parte il controllo aggiornamenti
3. se esiste una nuova versione, appare una schermata iniziale dedicata
4. l'utente puo' scegliere di aggiornare
5. parte la barra di avanzamento download
6. al termine il programma si riavvia e installa l'update
7. solo dopo si apre la dashboard

Note importanti:

- la prima installazione o il primo passaggio a una versione con updater va fatto manualmente
- dopo, gli aggiornamenti successivi arrivano via GitHub Releases
- il progetto e' configurato per pubblicare release pubbliche, non draft

## Repository GitHub

Repository ufficiale:

- [https://github.com/michelegiuliano87/BingoVoice](https://github.com/michelegiuliano87/BingoVoice)

Le release pubbliche vengono pubblicate qui:

- [https://github.com/michelegiuliano87/BingoVoice/releases](https://github.com/michelegiuliano87/BingoVoice/releases)

## Installazione locale per sviluppo

### Prerequisiti

- Windows
- Node.js
- npm
- Git

### Avvio progetto

```bash
npm install
npm run dev
```

### Avvio desktop locale

```bash
npm run dev:desktop
```

## Build desktop

Per creare l'app desktop:

```bash
npm run dist
```

Output principale:

- installer Windows nella cartella `release`

## Release automatica su GitHub

Per pubblicare una nuova versione:

1. aggiorna `version` nel file `package.json`
2. fai commit e push su `main`
3. esegui:

```bash
npm run release
```

Lo script:

- genera build e installer
- crea o aggiorna la release GitHub
- carica installer e file di update

## Procedura consigliata per pubblicare un aggiornamento

1. modifica il progetto
2. aggiorna la versione in `package.json`
3. esegui build locale di controllo:

```bash
npm run build
```

4. fai commit e push:

```bash
git add .
git commit -m "Publish version x.y.z"
git push origin main
```

5. pubblica la release:

```bash
npm run release
```

## Distribuzione a un cliente

Sul PC del cliente puoi:

- installare BingoVoice con il setup `.exe`
- attivare la licenza
- abilitare o meno i moduli dal pannello licenze owner

Se vuoi trasferire una configurazione completa gia' pronta, servono anche i dati locali del programma oppure una futura funzione di export/import configurazione cliente.

## Stato attuale del progetto

Funzionalita' gia' implementate:

- desktop app Electron
- gestione licenze locale avanzata
- owner prioritario
- moduli per licenza
- dashboard con versione visibile
- tema persistente
- progetti dedicati
- lucky wheel
- update automatici via GitHub
- schermata update iniziale con progress bar

## Roadmap consigliata

Possibili sviluppi futuri:

- export/import configurazione cliente
- backend remoto per licenze
- revoca online centralizzata
- attivazioni cloud per dispositivo
- pannello web admin separato
- pulizia automatica della cartella `release`
- firma applicazione Windows

## Note operative

- Il nome interno del progetto resta `toretto`
- Il nome visibile all'utente finale resta `BingoVoice`
- Alcune vecchie versioni senza updater non possono ricevere update automatici finche' non vengono aggiornate almeno una volta manualmente

## Contatti proprietario

- Email owner: `michele.giuliano.87@hotmail.com`

