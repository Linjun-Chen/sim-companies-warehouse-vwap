# Sim Companies VWAP magazynu

[Wybierz język](README.md)

Sprawdzaj średnią cenę ważoną wolumenem (VWAP) oraz cenę jednostkową po rabacie dla zapasów według poziomu jakości. Domyślny okres to poprzedni dzień w UTC. Oficjalne wykresy dzienne według jakości wymagają statusu Supporter w grze.

## Instalacja i aktualizacja

1. Pobierz `warehouse-vwap-v*.zip` z sekcji **Assets** i rozpakuj plik. [Najnowsza wersja](https://github.com/Linjun-Chen/sim-companies-warehouse-vwap/releases/latest)
2. Otwórz `chrome://extensions`, włącz **Tryb dewelopera** i wybierz **Załaduj rozpakowane**. Wskaż folder `warehouse-vwap` zawierający `manifest.json`.
3. Zaloguj się do gry i przejdź do magazynu. Rozwiń **VWAP magazynu**, aby zobaczyć ceny zapasów, lub otwórz kartę produktu, aby sprawdzić ceny według jakości.

Aby zaktualizować rozszerzenie, zastąp pliki w dotychczasowym folderze. Kliknij ikonę ponownego wczytania na karcie zainstalowanego rozszerzenia, a potem odśwież kartę magazynu. Użycie tego samego folderu zachowuje ustawienia i ceny w pamięci podręcznej.

## Rabaty i język

Na stronie produktu kliknij wartość procentową obok ceny po rabacie. Możesz zmienić rabat produktu i rabaty dla jakości od Q0 do Q12. Puste pole przejmuje ustawienie z wyższego poziomu. Wartość 0 oznacza cenę bez rabatu. Po zapisaniu ceny zostaną od razu przeliczone.

Domyślnie rozszerzenie korzysta z języka Chrome. Aby go zmienić, otwórz rozszerzenie na pasku narzędzi i wybierz **Wszystkie ustawienia → Język**.
