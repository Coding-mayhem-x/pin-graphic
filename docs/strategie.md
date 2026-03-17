# Strategie rozmieszczania kół (Honeycomb)

Ten dokument opisuje strategie dodawania kół na siatce heksagonalnej używane w aplikacji.

## Siatka i obszar
- Układ współrzędnych: siatka heksagonalna w osiowym (u, v).
- Konwersje: `point ↔ axial` zapewniają zaokrąglenie do najbliższego węzła.
- Sąsiedztwo: 6 kierunków heksagonalnych.
- Granice: punkt jest akceptowany tylko, gdy `withinArea` (mieści się w prostokątnych granicach obszaru rysowania, z marginesem promienia).
- Promień/średnica: dobierane proporcjonalnie do rozmiaru hosta.

## Wspólne pojęcia
- „Godzina” (0–11): losowany sektor kątowy (klin). Środek klina: `π/2 + godzina·(π/6)` (12:00 to góra). Szerokość klina: ±`π/12`.
- „Grupa koloru”: spójny komponent (połączenia przez styczne heksy) dla danego koloru.
- „Środek ciężkości grupy”: średnia arytmetyczna położeń (w układzie kartezjańskim) kół w grupie.
- „Bias kątowy”: przy szukaniu najbliższego wolnego węzła preferujemy kierunki bliższe środkowi klina.

## Strategia: Frontier (bazowa)
- Utrzymujemy zbiór „frontier” (krawędź) – wolne węzły sąsiadujące z już zajętymi.
- Dodawanie wybiera kandydatów o najmniejszym „pierścieniu” (odległość heksowa) z ustalonym porządkiem kierunków.
- Gwarantuje rośnięcie plastra miodu od środka.

## Strategia: Clock
- Najpierw losujemy godzinę → powstaje klin (kierunek rozbudowy).
- Jeśli danego koloru brak na planszy:
  - Losujemy punkt w obszarze, ale tylko z kątem w klinie.
  - Zaokrąglamy do siatki, szukamy najbliższego wolnego węzła (z biasem na centrum klina) i stawiamy koło.
- Jeśli kolor istnieje (co najmniej jedna grupa):
  - Wybieramy losowo jedną grupę.
  - Dla każdego koła z grupy wyliczamy „najlepiej zgodnego” sąsiada (kierunek najbliższy środkowi klina) i zbieramy kandydatów.
  - Jeśli któryś kandydat jest wolny i w granicach → stawiamy.
  - Fallback: jak dla nowego koloru – losowy punkt w klinie → najbliższy wolny węzeł.

## Strategia: Clock v2 (z centroidem grupy)
1) Losowanie koloru (zewnętrzne – przycisk „Add random (any)” lub wybór w UI).
2) Sprawdzenie, czy kolor istnieje na planszy:
   - Brak grup:
     - Losujemy godzinę (klin), próbujemy wylosować punkt w klinie i osadzić w najbliższym wolnym węźle.
   - Co najmniej jedna grupa:
     - Wyznaczamy spójne grupy koloru i losujemy jedną z nich.
     - Liczymy środek ciężkości tej grupy.
     - Losujemy ponownie godzinę (klin) – ta godzina służy do wyboru koła bazowego względem środka ciężkości.
     - Wybór koła bazowego:
       - Jeśli są koła leżące w klinie (kierunek od środka ciężkości mieści się w ±`π/12`) – losujemy jedno z nich.
       - W przeciwnym razie bierzemy koło, którego kierunek względem środka ciężkości jest najbliżej środka klina.
     - Próba dołożenia sąsiada dotykającego bazę:
       - Z 6 kierunków wybieramy ten, którego kąt globalny jest najbliższy środkowi klina.
       - Jeżeli sąsiedni węzeł jest wolny i w granicach → stawiamy koło.
     - Plan B (przy kolizji/wyjściu poza granice):
       - Wśród wszystkich wolnych sąsiadów całej grupy wybieramy ten najbliższy środkowi ciężkości i stawiamy koło.
     - Ostateczny fallback:
       - Jak przy „brak grup”: losowy punkt w obrębie klina → zaokrąglenie → najbliższy wolny węzeł.

## Zachowanie na granicy
- Każde potencjalne miejsce jest weryfikowane przez `withinArea`.
- Gdy kandydat wypada poza obszar, szukamy najbliższego dozwolonego węzła (spiralny przeszukiwacz z biasem kątowym). Jeśli nie znajdziemy – stosujemy fallback zgodnie ze strategią.

## Mapowanie na kod (skrót)
- Metody: `addClockWithColor(color)`, `addClockV2WithColor(color)`, pomocnicze: `placeAsNewInWedge`, `componentsOfColor`, `centroidOfGroup`, `freeNeighbors`, `findNearestFree`.
- UI: wybór strategii w `#strategySelect` (wartości `frontier`, `clock`, `clock2`).
- Automaty: przycisk „Play” cyklicznie uruchamia „Add random (any)” z bieżącą strategią.

