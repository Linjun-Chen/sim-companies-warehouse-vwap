# Sim Companies Lager-VWAP

[Sprache auswählen](README.md)

Zeigt den volumengewichteten Durchschnittspreis (VWAP) und den Stückpreis mit Abschlag für Lagerbestände nach Qualitätsstufe an. Standardmäßig gilt der vorherige UTC-Tag. Für die offiziellen Tagescharts nach Qualität ist der Supporter-Status im Spiel erforderlich.

## Installieren und aktualisieren

1. Laden Sie `warehouse-vwap-v*.zip` unter **Assets** herunter und entpacken Sie die Datei. [Neueste Version](https://github.com/Linjun-Chen/sim-companies-warehouse-vwap/releases/latest)
2. Öffnen Sie `chrome://extensions`, aktivieren Sie den **Entwicklermodus** und klicken Sie auf **Entpackte Erweiterung laden**. Wählen Sie den Ordner `warehouse-vwap` mit der Datei `manifest.json` aus.
3. Melden Sie sich im Spiel an und öffnen Sie das Lager. Klappen Sie **Lager-VWAP** auf, um die Preise für die Bestände zu sehen, oder öffnen Sie ein Produkt für die Preise nach Qualität.

Zum Aktualisieren überschreiben Sie die Dateien im bisherigen Erweiterungsordner. Laden Sie die installierte Erweiterung über das Symbol auf ihrer Karte neu und aktualisieren Sie danach die Lagerseite. Im selben Ordner bleiben die Einstellungen und zwischengespeicherten Preise verfügbar.

## Abschläge und Sprache

Klicken Sie auf der Produktseite auf den Prozentwert neben dem Preis mit Abschlag. Dort können Sie den Standardabschlag für das Produkt und die Abschläge für Q0 bis Q12 bearbeiten. Ein leeres Feld übernimmt die übergeordnete Einstellung. Mit 0 gilt der Preis ohne Abschlag. Nach dem Speichern wird der Preis sofort neu berechnet.

Die Oberfläche folgt standardmäßig der Anzeigesprache von Chrome. Über das Erweiterungssymbol in der Symbolleiste gelangen Sie zu **Alle Einstellungen → Sprache**.
