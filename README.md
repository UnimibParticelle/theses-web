# UNIMIB Fisica - Proposte Tesi (GitHub Pages + Google Sheets)

Sito statico per esplorare le proposte di tesi pubblicate in un Google Sheet.

## Come funziona

- Il sito e ospitato su GitHub Pages.
- I dati vengono letti lato browser da un URL CSV pubblico del foglio Google.
- Nessun backend richiesto.

## 1) Preparare il Google Sheet

1. Crea o apri il foglio con le proposte.
2. Inserisci una riga di intestazioni (prima riga).
3. Usa nomi colonna compatibili (consigliato):
	- titolo
	- docente
	- area
	- lingua
	- descrizione
	- requisiti
	- email
	- link
4. Vai su File -> Condividi -> Pubblica sul web.
5. Seleziona il foglio corretto e formato CSV.
6. Copia il link CSV pubblico.

Nota: il sito riconosce anche alias comuni (ad esempio relatore/supervisor per docente, topic/categoria per area).

## 2) Configurare il progetto

1. Apri [config.js](config.js).
2. Imposta csvUrl con il link CSV pubblico:

```js
window.SHEETS_CONFIG = {
  csvUrl: "https://docs.google.com/spreadsheets/d/e/XXXXXXXXXXXX/pub?output=csv"
};
```

## 3) Anteprima locale

Puoi usare qualsiasi server statico. Esempio con Python:

```bash
python -m http.server 8000
```

Poi apri http://localhost:8000

## 4) Pubblicare su GitHub Pages

1. Pusha il repository su GitHub.
2. Vai in Settings -> Pages.
3. In Build and deployment:
	- Source: Deploy from a branch
	- Branch: main (root)
4. Salva.
5. Dopo qualche minuto il sito sara disponibile all'URL Pages del repository.

## Struttura file

- [index.html](index.html): struttura della pagina
- [styles.css](styles.css): stile responsive
- [app.js](app.js): fetch CSV, parsing, filtri, ricerca, dettaglio
- [config.js](config.js): URL del foglio Google

## Suggerimenti

- Se cambi il foglio spesso, il sito riflette i dati aggiornati al refresh pagina.
- Se vedi errori di caricamento, verifica che il CSV sia davvero pubblico.
