# Chronos Plan – Inteligentny Układacz Planu Dnia (Calendar & A11y Edition)

Nowoczesna, webowa aplikacja produktywności stworzona dla **studentów, freelancerów i managerów**, wyposażona w **interaktywny kalendarz wielodniowy, wybór daty, podgląd dni oraz wysoką dostępność dla osób ze słabszym wzrokiem**.

---

## 📅 Nowość: Pełny Kalendarz & Wybór Daty

1. **Szybki nawigator dat w nagłówku:**
   - Przyciski `[◀ Poprzedni]` i `[Następny ▶]` do szybkiego przeskakiwania między dniami.
   - Przycisk `[Dziś]` do natychmiastowego powrotu do bieżącej daty.
   - Dynamiczny nagłówek z pełną polską nazwą dnia (np. *„Wtorek, 24 listopada 2026”*).

2. **Interaktywny Podgląd Kalendarza Miesięcznego:**
   - Dedykowany przycisk **`[📅 Kalendarz]`** otwierający pełny widok miesiąca.
   - **Siatka dni z wskaźnikami:** Każdy dzień z zaplanowanymi zadaniami oznaczony jest zielonym znacznikiem z liczbą zadań.
   - **Podgląd wybranego dnia:** Kliknięcie dowolnego dnia w siatce natychmiast wyświetla w bocznym panelu listę zadań, szacowany czas pracy oraz liczbę spotkań.
   - **„Otwórz ten dzień w planerze”:** 1-kliknięciem przełączasz planer na wybrany dzień w przyszłości lub przeszłości.
   - **„Skopiuj zadania z dzisiaj”:** Umożliwia błyskawiczne powielenie powtarzalnych zadań na kolejny dzień.

3. **Wielodniowa pamięć lokalna (`localStorage`):**
   - Każdy dzień ma swój własny, niezależny plan zadań, harmonogram godzinowy i ustawienia buforów.

---

## 👁️ Usprawnienia Widoczności & Dostępności (A11y)
* **Zwiększona typografia bazowa:** Wyraźne, powiększone czcionki (`18px – 20px+`) o zoptymalizowanym kroju i kontraście.
* **Przełącznik rozmiaru tekstu 1-kliknięciem w nagłówku:**
  * **[A] Standardowy**
  * **[A+] Duży (Zalecany)**
  * **[A++] Bardzo Duży (Ultra-czytelny)**
* **Tryb Wysokiego Kontrastu:** Dedykowany przycisk `[Kontrast]` włączający głębokie, wyraziste obramowania, czarny tekst o maksymalnym kontraście i jaskrawe znaczniki.
* **Duże elementy interaktywne:**
  * Powiększone komórki kalendarza i checkboxy (24x24 px).
  * Wyraźne, grube obramowania kart (`border-2`) i paski akcentowe (`border-l-[6px]`).
  * Wysoki kontrast kategorii i priorytetów (🔴 P1, 🟡 P2, 🟢 P3) spełniający normy WCAG AA/AAA.

---

## 🚀 Jak uruchomić?

Aplikacja jest w 100% lokalna i bezobsługowa (Zero-dependency). Nie wymaga instalacji Node.js, Pythona ani żadnych bibliotek.

1. **Wystarczy dwukrotnie kliknąć plik `index.html`** w dowolnej nowoczesnej przeglądarce (Google Chrome, Microsoft Edge, Mozilla Firefox, Safari).
2. Gotowe! Wszystkie Twoje plany dzienne, preferencje wielkości czcionki i zadania są automatycznie zapisywane lokalnie w Twojej przeglądarce (`localStorage`).
