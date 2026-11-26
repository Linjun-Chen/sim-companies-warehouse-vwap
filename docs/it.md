# Sim Companies VWAP del magazzino

[Scegli la lingua](README.md)

Consulta il prezzo medio ponderato per il volume (VWAP) e il prezzo unitario scontato dei prodotti in magazzino, per livello di qualità. Il periodo predefinito è il giorno precedente in UTC. Per accedere ai grafici giornalieri ufficiali per qualità serve lo stato Supporter nel gioco.

## Installazione e aggiornamento

1. Scarica `warehouse-vwap-v*.zip` dalla sezione **Assets** ed estrai i file. [Ultima versione](https://github.com/Linjun-Chen/sim-companies-warehouse-vwap/releases/latest)
2. Apri `chrome://extensions`, attiva la **Modalità sviluppatore** e scegli **Carica estensione non pacchettizzata**. Seleziona la cartella `warehouse-vwap` che contiene `manifest.json`.
3. Accedi al gioco e apri il magazzino. Espandi **VWAP del magazzino** per vedere i prezzi dei prodotti in stock, oppure apri un prodotto per consultarli per qualità.

Per aggiornare l’estensione, sostituisci i file nella cartella caricata in precedenza. Fai clic sull’icona di ricarica dell’estensione già installata, poi aggiorna la scheda del magazzino. Usando la stessa cartella, mantieni le impostazioni e i prezzi salvati in cache.

## Sconti e lingua

Nella pagina del prodotto, fai clic sulla percentuale accanto al prezzo scontato. Puoi modificare lo sconto predefinito del prodotto e gli sconti da Q0 a Q12. Un campo vuoto eredita il valore del livello superiore. Inserisci 0 per applicare il prezzo senza sconto. Al salvataggio, i prezzi vengono ricalcolati subito.

Per impostazione predefinita, l’estensione segue la lingua di Chrome. Per cambiarla, apri l’estensione dalla barra degli strumenti e vai su **Tutte le impostazioni → Lingua**.
