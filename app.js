/**
 * Chronos Plan - Inteligentny Układacz Planu Dnia
 * Nowoczesny interfejs z pełnym kalendarzem, wyborem daty i podglądem dni.
 * Zoptymalizowany dla osób ze słabym wzrokiem (WCAG AA/AAA).
 */

// --- Date Utilities ---
function getLocalTodayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseIsoDate(isoStr) {
  if (!isoStr) return new Date();
  const [y, m, d] = isoStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatIsoDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatFullDatePolish(isoStr) {
  const d = parseIsoDate(isoStr);
  const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const str = d.toLocaleDateString('pl-PL', options);
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatMonthYearPolish(dateObj) {
  const options = { month: 'long', year: 'numeric' };
  const str = dateObj.toLocaleDateString('pl-PL', options);
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatMinutesPolish(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

// --- Global State ---
const state = {
  selectedDate: getLocalTodayIso(), // Aktualnie wybrany dzień do planowania (YYYY-MM-DD)
  plansByDate: {}, // Słownik przechowujący dane per dzień: { [isoDate]: { constraints, tasks, schedule, overflow } }
  
  // Aktywny dzień w pamięci podręcznej
  constraints: {
    startTime: '08:00',
    endTime: '17:00',
    lunchStartTime: '13:00',
    lunchDuration: 30,
    bufferDuration: 10,
    strategy: 'balanced'
  },
  tasks: [],
  schedule: [],
  overflow: [],
  filterHideDone: false,
  
  // Dostępność
  fontSize: 'lg', // 'md' | 'lg' | 'xl'
  highContrast: false,

  // Kalendarz modalny
  calendarViewMonth: new Date(), // Widok miesiąca w kalendarzu
  calendarPreviewDate: getLocalTodayIso(), // Dzień aktualnie podglądany w modalu kalendarza

  // Focus Timer
  focusTimer: {
    taskId: null,
    durationSec: 25 * 60,
    remainingSec: 25 * 60,
    intervalId: null,
    isRunning: false
  }
};

// --- High-Contrast & Readable Icons & Labels Dictionary ---
const CATEGORIES = {
  work: { 
    label: 'Praca / Projekt', 
    icon: 'briefcase', 
    colorClass: 'cat-work', 
    badgeBg: 'bg-blue-100 text-blue-950 border-2 border-blue-300 font-extrabold' 
  },
  study: { 
    label: 'Nauka / Czytanie', 
    icon: 'book-open', 
    colorClass: 'cat-study', 
    badgeBg: 'bg-purple-100 text-purple-950 border-2 border-purple-300 font-extrabold' 
  },
  meeting: { 
    label: 'Spotkanie / Call', 
    icon: 'users', 
    colorClass: 'cat-meeting', 
    badgeBg: 'bg-sky-100 text-sky-950 border-2 border-sky-300 font-extrabold' 
  },
  admin: { 
    label: 'Administracja', 
    icon: 'mail', 
    colorClass: 'cat-admin', 
    badgeBg: 'bg-slate-200 text-slate-950 border-2 border-slate-400 font-extrabold' 
  },
  health: { 
    label: 'Zdrowie / Sport', 
    icon: 'activity', 
    colorClass: 'cat-health', 
    badgeBg: 'bg-emerald-100 text-emerald-950 border-2 border-emerald-300 font-extrabold' 
  },
  creative: { 
    label: 'Kreatywne', 
    icon: 'lightbulb', 
    colorClass: 'cat-creative', 
    badgeBg: 'bg-amber-100 text-amber-950 border-2 border-amber-300 font-extrabold' 
  },
  lunch: { 
    label: 'Przerwa obiadowa', 
    icon: 'utensils', 
    colorClass: 'cat-lunch', 
    badgeBg: 'bg-orange-100 text-orange-950 border-2 border-orange-300 font-extrabold' 
  },
  buffer: { 
    label: 'Odpoczynek / Bufor', 
    icon: 'coffee', 
    colorClass: 'cat-buffer', 
    badgeBg: 'bg-slate-100 text-slate-900 border-2 border-slate-300 font-bold' 
  }
};

const STRATEGY_DESCRIPTIONS = {
  balanced: 'Deep work & priorytety rano, administracja po południu',
  eat_frog: 'Najważniejsza i najtrudniejsza "żaba" jako pierwsze zadanie dnia',
  pomodoro: 'Częste przerwy i optymalne interwały dla wysokiej koncentracji'
};

// --- Presets Data ---
const PRESETS = {
  student: {
    constraints: { startTime: '08:30', endTime: '18:00', lunchStartTime: '13:30', lunchDuration: 45, bufferDuration: 10, strategy: 'balanced' },
    tasks: [
      { id: 'st-1', title: 'Wykład: Algorytmy i struktury danych', duration: 90, priority: 'P1', category: 'study', energy: 'high', isFixed: true, fixedTime: '09:00', done: false },
      { id: 'st-2', title: 'Pisanie rozdziału pracy dyplomowej', duration: 90, priority: 'P1', category: 'study', energy: 'high', isFixed: false, done: false },
      { id: 'st-3', title: 'Powtórka fiszek przed kolokwium', duration: 45, priority: 'P2', category: 'study', energy: 'medium', isFixed: false, done: false },
      { id: 'st-4', title: 'Trening biegowy w parku', duration: 45, priority: 'P2', category: 'health', energy: 'medium', isFixed: false, done: false },
      { id: 'st-5', title: 'Wypożyczenie książki w bibliotece', duration: 30, priority: 'P3', category: 'admin', energy: 'low', isFixed: false, done: false }
    ]
  },
  freelancer: {
    constraints: { startTime: '08:00', endTime: '16:30', lunchStartTime: '12:30', lunchDuration: 30, bufferDuration: 10, strategy: 'eat_frog' },
    tasks: [
      { id: 'fl-1', title: 'Projekt UI dla klienta - Ekran Dashboardu', duration: 120, priority: 'P1', category: 'creative', energy: 'high', isFixed: false, done: false },
      { id: 'fl-2', title: 'Statusowy call z klientem (Google Meet)', duration: 45, priority: 'P1', category: 'meeting', energy: 'medium', isFixed: true, fixedTime: '11:00', done: false },
      { id: 'fl-3', title: 'Odpisanie na zapytania ofertowe i maile', duration: 45, priority: 'P2', category: 'admin', energy: 'low', isFixed: false, done: false },
      { id: 'fl-4', title: 'Poprawki CSS do widoku mobilnego', duration: 60, priority: 'P2', category: 'work', energy: 'medium', isFixed: false, done: false },
      { id: 'fl-5', title: 'Wystawienie faktur i porządki w plikach', duration: 30, priority: 'P3', category: 'admin', energy: 'low', isFixed: false, done: false }
    ]
  },
  manager: {
    constraints: { startTime: '08:00', endTime: '17:00', lunchStartTime: '13:00', lunchDuration: 45, bufferDuration: 15, strategy: 'balanced' },
    tasks: [
      { id: 'mg-1', title: 'Daily Stand-up zespołu produktowego', duration: 30, priority: 'P1', category: 'meeting', energy: 'high', isFixed: true, fixedTime: '09:00', done: false },
      { id: 'mg-2', title: 'Przegląd budżetu Q4 i analiza wskaźników', duration: 75, priority: 'P1', category: 'work', energy: 'high', isFixed: false, done: false },
      { id: 'mg-3', title: '1-on-1 z Tech Leadem', duration: 45, priority: 'P1', category: 'meeting', energy: 'high', isFixed: true, fixedTime: '11:30', done: false },
      { id: 'mg-4', title: 'Planowanie roadmapy na kolejny sprint', duration: 60, priority: 'P2', category: 'creative', energy: 'high', isFixed: false, done: false },
      { id: 'mg-5', title: 'Inbox Zero & przegląd ticketów w Jira', duration: 45, priority: 'P3', category: 'admin', energy: 'low', isFixed: false, done: false },
      { id: 'mg-6', title: 'Krótki spacer / reset głowy', duration: 20, priority: 'P2', category: 'health', energy: 'low', isFixed: false, done: false }
    ]
  }
};

// --- Multi-Date Management ---
function saveCurrentDayToStorage() {
  state.plansByDate[state.selectedDate] = {
    constraints: JSON.parse(JSON.stringify(state.constraints)),
    tasks: JSON.parse(JSON.stringify(state.tasks)),
    schedule: JSON.parse(JSON.stringify(state.schedule)),
    overflow: JSON.parse(JSON.stringify(state.overflow))
  };
  saveToLocalStorage();
}

function switchDate(newDateIso) {
  if (!newDateIso) return;
  // Zapisz aktualny dzień przed przełączeniem
  saveCurrentDayToStorage();

  state.selectedDate = newDateIso;
  const dayData = state.plansByDate[newDateIso];

  if (dayData) {
    state.constraints = JSON.parse(JSON.stringify(dayData.constraints));
    state.tasks = JSON.parse(JSON.stringify(dayData.tasks || []));
    state.schedule = JSON.parse(JSON.stringify(dayData.schedule || []));
    state.overflow = JSON.parse(JSON.stringify(dayData.overflow || []));
  } else {
    // Nowy dzień z domyślnymi ograniczeniami i pustą listą
    state.tasks = [];
    state.schedule = [];
    state.overflow = [];
  }

  // Zaktualizuj formularz
  document.getElementById('dayStartTime').value = state.constraints.startTime;
  document.getElementById('dayEndTime').value = state.constraints.endTime;
  document.getElementById('lunchStartTime').value = state.constraints.lunchStartTime;
  document.getElementById('lunchDuration').value = state.constraints.lunchDuration;
  document.getElementById('bufferDuration').value = state.constraints.bufferDuration;

  document.querySelectorAll('.strategy-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.strategy === state.constraints.strategy);
  });
  document.getElementById('strategyDesc').textContent = STRATEGY_DESCRIPTIONS[state.constraints.strategy];

  updateHeaderDateDisplay();
  renderAll();
  saveToLocalStorage();
}

function updateHeaderDateDisplay() {
  const fullText = formatFullDatePolish(state.selectedDate);
  const isToday = state.selectedDate === getLocalTodayIso();
  const headerElem = document.getElementById('headerDateText');
  if (headerElem) {
    headerElem.textContent = isToday ? `Dziś, ${fullText.split(',')[1] || fullText}` : fullText;
  }
  const dateInput = document.getElementById('nativeDatePicker');
  if (dateInput) {
    dateInput.value = state.selectedDate;
  }
}

// --- Scheduling Algorithm ---
function optimizeSchedule() {
  const { startTime, endTime, lunchStartTime, lunchDuration, bufferDuration, strategy } = state.constraints;
  const dayStartMin = timeToMinutes(startTime);
  const dayEndMin = timeToMinutes(endTime);
  const totalDayCapacity = Math.max(0, dayEndMin - dayStartMin);

  // 1. Zidentyfikuj sztywne bloki (Fixed commitments & Lunch)
  const fixedBlocks = [];

  const lunchDur = Number(lunchDuration);
  if (lunchDur > 0 && lunchStartTime) {
    const lStart = timeToMinutes(lunchStartTime);
    const lEnd = lStart + lunchDur;
    if (lStart >= dayStartMin && lEnd <= dayEndMin) {
      fixedBlocks.push({
        id: 'lunch-block',
        title: 'Przerwa obiadowa & Regeneracja',
        category: 'lunch',
        priority: 'P1',
        startMin: lStart,
        endMin: lEnd,
        duration: lunchDur,
        isFixed: true,
        isSystemBreak: true,
        done: false
      });
    }
  }

  const fixedUserTasks = state.tasks.filter(t => t.isFixed && t.fixedTime);
  const flexibleTasks = state.tasks.filter(t => !t.isFixed || !t.fixedTime);

  fixedUserTasks.forEach(task => {
    const fStart = timeToMinutes(task.fixedTime);
    const fEnd = fStart + Number(task.duration);
    fixedBlocks.push({
      ...task,
      startMin: fStart,
      endMin: fEnd,
      isFixed: true
    });
  });

  fixedBlocks.sort((a, b) => a.startMin - b.startMin);

  // 2. Sortowanie zadań według strategii
  const sortedFlexible = [...flexibleTasks].sort((a, b) => {
    const priorityWeight = { P1: 3, P2: 2, P3: 1 };
    const energyWeight = { high: 3, medium: 2, low: 1 };

    if (strategy === 'eat_frog') {
      if (priorityWeight[b.priority] !== priorityWeight[a.priority]) {
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      }
      if (energyWeight[b.energy] !== energyWeight[a.energy]) {
        return energyWeight[b.energy] - energyWeight[a.energy];
      }
      return b.duration - a.duration;
    } else if (strategy === 'pomodoro') {
      if (priorityWeight[b.priority] !== priorityWeight[a.priority]) {
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      }
      return a.duration - b.duration;
    } else {
      if (priorityWeight[b.priority] !== priorityWeight[a.priority]) {
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      }
      if (energyWeight[b.energy] !== energyWeight[a.energy]) {
        return energyWeight[b.energy] - energyWeight[a.energy];
      }
      return b.duration - a.duration;
    }
  });

  // 3. Wolne okna czasowe
  let currentPointer = dayStartMin;
  const availableSlots = [];

  for (const fBlock of fixedBlocks) {
    if (fBlock.startMin > currentPointer) {
      availableSlots.push({
        start: currentPointer,
        end: Math.min(fBlock.startMin, dayEndMin)
      });
    }
    currentPointer = Math.max(currentPointer, fBlock.endMin);
  }

  if (currentPointer < dayEndMin) {
    availableSlots.push({
      start: currentPointer,
      end: dayEndMin
    });
  }

  // 4. Rozmieszczanie elastycznych zadań
  const scheduledBlocks = [...fixedBlocks];
  const overflowTasks = [];
  const bufferMin = Number(bufferDuration) || 0;

  const activeSlots = availableSlots.map(s => ({ ...s }));

  for (const task of sortedFlexible) {
    const taskDur = Number(task.duration);
    let placed = false;

    for (let i = 0; i < activeSlots.length; i++) {
      const slot = activeSlots[i];
      const slotCap = slot.end - slot.start;

      if (slotCap >= taskDur) {
        const taskStart = slot.start;
        const taskEnd = taskStart + taskDur;

        scheduledBlocks.push({
          ...task,
          startMin: taskStart,
          endMin: taskEnd
        });

        const afterBuffer = taskEnd + bufferMin;
        if (afterBuffer < slot.end) {
          slot.start = afterBuffer;
        } else {
          slot.start = slot.end;
        }

        placed = true;
        break;
      }
    }

    if (!placed) {
      overflowTasks.push(task);
    }
  }

  scheduledBlocks.sort((a, b) => a.startMin - b.startMin);

  // Wstaw bloki buforowe
  const finalSchedule = [];
  for (let i = 0; i < scheduledBlocks.length; i++) {
    const current = scheduledBlocks[i];
    finalSchedule.push(current);

    if (i < scheduledBlocks.length - 1) {
      const next = scheduledBlocks[i + 1];
      const gap = next.startMin - current.endMin;
      if (gap >= 5) {
        finalSchedule.push({
          id: `buffer-${current.id}-${next.id}`,
          title: gap <= 15 ? 'Krótki odpoczynek & oddech' : 'Wolny czas / Bufor rezerwowy',
          category: 'buffer',
          priority: 'P3',
          startMin: current.endMin,
          endMin: next.startMin,
          duration: gap,
          isBuffer: true,
          done: false
        });
      }
    }
  }

  state.schedule = finalSchedule;
  state.overflow = overflowTasks;

  saveCurrentDayToStorage();
  renderAll();
}

// --- Render Functions ---
function renderAll() {
  renderTasksPool();
  renderTimeline();
  renderRealismMetrics();
  lucide.createIcons();
}

function renderTasksPool() {
  const container = document.getElementById('unplannedTasksList');
  const countBadge = document.getElementById('tasksCountBadge');
  const totalDurElem = document.getElementById('totalTasksDuration');

  countBadge.textContent = state.tasks.length;
  const totalMin = state.tasks.reduce((sum, t) => sum + Number(t.duration), 0);
  totalDurElem.textContent = `Łącznie: ${formatMinutesPolish(totalMin)}`;

  if (state.tasks.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 text-slate-600 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50">
        <i data-lucide="inbox" class="w-10 h-10 mx-auto mb-2 text-slate-400"></i>
        <p class="text-sm sm:text-base font-bold text-slate-800">Brak zadań dla tego dnia.</p>
        <p class="text-xs sm:text-sm text-slate-600 mt-1 font-medium">Dodaj nowe zadanie lub wybierz szablon u góry strony.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.tasks.map(task => {
    const cat = CATEGORIES[task.category] || CATEGORIES.work;
    const priorityColor = task.priority === 'P1' 
      ? 'text-rose-950 bg-rose-100 border-2 border-rose-300' 
      : task.priority === 'P2' 
      ? 'text-amber-950 bg-amber-100 border-2 border-amber-300' 
      : 'text-slate-900 bg-slate-200 border border-slate-400';

    return `
      <div class="p-3.5 sm:p-4 bg-slate-50 hover:bg-slate-100/90 rounded-2xl border-2 border-slate-200/90 flex items-center justify-between gap-3 group transition shadow-sm">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl ${cat.badgeBg} flex-shrink-0 flex items-center justify-center shadow-sm">
            <i data-lucide="${cat.icon}" class="w-5 h-5"></i>
          </div>
          <div class="min-w-0">
            <h4 class="text-sm sm:text-base font-extrabold text-slate-950 truncate">${escapeHtml(task.title)}</h4>
            <div class="flex flex-wrap items-center gap-2 mt-1 text-xs sm:text-sm text-slate-700 font-semibold">
              <span class="font-extrabold text-slate-900">${formatMinutesPolish(task.duration)}</span>
              <span>&bull;</span>
              <span class="font-black px-2 py-0.5 rounded-lg ${priorityColor}">${task.priority}</span>
              ${task.isFixed ? `<span class="text-blue-950 font-black bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-lg">Sztywne: ${task.fixedTime}</span>` : ''}
            </div>
          </div>
        </div>

        <button onclick="removeTask('${task.id}')" class="p-2 text-slate-400 hover:text-rose-700 rounded-xl hover:bg-rose-50 transition flex-shrink-0" title="Usuń zadanie">
          <i data-lucide="trash-2" class="w-5 h-5"></i>
        </button>
      </div>
    `;
  }).join('');
}

function renderTimeline() {
  const container = document.getElementById('timelineContainer');
  const doneCount = document.getElementById('doneCount');
  const overflowSection = document.getElementById('overflowSection');
  const overflowList = document.getElementById('overflowTasksList');

  const regularTasks = state.schedule.filter(s => !s.isBuffer && !s.isSystemBreak);
  const completedTasks = regularTasks.filter(s => s.done);
  doneCount.textContent = `${completedTasks.length}/${regularTasks.length}`;

  if (state.schedule.length === 0) {
    container.innerHTML = `
      <div class="text-center py-14 text-slate-600 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
        <div class="w-14 h-14 rounded-2xl bg-white border-2 border-slate-200 flex items-center justify-center mx-auto mb-3 text-slate-500 shadow-sm">
          <i data-lucide="calendar" class="w-7 h-7 text-emerald-700"></i>
        </div>
        <h3 class="text-base sm:text-lg font-black text-slate-900">Plan dla tego dnia nie został jeszcze ułożony</h3>
        <p class="text-sm font-semibold text-slate-600 mt-1.5 max-w-md mx-auto">Dodaj zadania po lewej stronie i kliknij <strong>„Ułóż Realistyczny Plan Dnia”</strong>.</p>
      </div>
    `;
    overflowSection.classList.add('hidden');
    return;
  }

  const now = new Date();
  const isSelectedToday = state.selectedDate === getLocalTodayIso();
  const currentMinutesNow = now.getHours() * 60 + now.getMinutes();

  const itemsHtml = state.schedule.map(item => {
    if (state.filterHideDone && item.done) return '';

    const startTimeFormatted = minutesToTime(item.startMin);
    const endTimeFormatted = minutesToTime(item.endMin);
    const cat = CATEGORIES[item.category] || CATEGORIES.work;

    if (item.isBuffer) {
      return `
        <div class="timeline-item flex items-center gap-3.5 py-1 text-slate-600 group">
          <div class="timeline-dot break"></div>
          <div class="w-24 sm:w-28 text-xs sm:text-sm font-mono font-bold text-slate-700 flex-shrink-0">${startTimeFormatted} - ${endTimeFormatted}</div>
          <div class="flex-1 py-2 px-3.5 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 text-xs sm:text-sm flex items-center justify-between text-slate-800 font-semibold shadow-sm">
            <span class="flex items-center gap-2">
              <i data-lucide="coffee" class="w-4 h-4 text-amber-700"></i>
              <span>${escapeHtml(item.title)}</span>
            </span>
            <span class="text-xs font-bold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">${item.duration} min</span>
          </div>
        </div>
      `;
    }

    if (item.isSystemBreak) {
      return `
        <div class="timeline-item flex items-center gap-3.5 py-2 text-slate-900 group">
          <div class="timeline-dot break"></div>
          <div class="w-24 sm:w-28 text-xs sm:text-sm font-mono font-black text-orange-900 flex-shrink-0">${startTimeFormatted} - ${endTimeFormatted}</div>
          <div class="flex-1 p-4 rounded-2xl bg-orange-100 border-2 border-orange-300 flex items-center justify-between shadow-sm">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-orange-200 text-orange-950 flex items-center justify-center border border-orange-300">
                <i data-lucide="utensils" class="w-5 h-5"></i>
              </div>
              <div>
                <h4 class="text-sm sm:text-base font-black text-orange-950">${escapeHtml(item.title)}</h4>
                <span class="text-xs sm:text-sm font-bold text-orange-900">Czas na regenerację i obiad (${item.duration} min)</span>
              </div>
            </div>
            <span class="text-xs sm:text-sm font-black px-3 py-1 rounded-full bg-white text-orange-950 shadow-sm border border-orange-200">Przerwa</span>
          </div>
        </div>
      `;
    }

    const isOngoing = isSelectedToday && currentMinutesNow >= item.startMin && currentMinutesNow <= item.endMin;
    const priorityBadge = item.priority === 'P1'
      ? '<span class="text-xs font-black text-rose-950 bg-rose-100 px-2.5 py-0.5 rounded-lg border-2 border-rose-300">🔴 P1 Kluczowe</span>'
      : item.priority === 'P2'
      ? '<span class="text-xs font-extrabold text-amber-950 bg-amber-100 px-2.5 py-0.5 rounded-lg border-2 border-amber-300">🟡 P2 Ważne</span>'
      : '<span class="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-300">🟢 P3</span>';

    return `
      <div class="timeline-item flex items-start gap-3.5 py-1.5 ${item.done ? 'task-completed' : ''}">
        <div class="timeline-dot ${isOngoing ? 'current animate-pulse' : item.isFixed ? 'fixed' : ''}"></div>
        
        <div class="w-24 sm:w-28 pt-2.5 text-xs sm:text-sm font-mono font-black text-slate-950 flex-shrink-0">
          <div class="text-sm sm:text-base">${startTimeFormatted}</div>
          <div class="text-xs font-bold text-slate-600">${endTimeFormatted}</div>
        </div>

        <div class="flex-1 bg-white hover:bg-slate-50/90 p-4 sm:p-5 rounded-2xl border-l-[6px] ${cat.colorClass} border-2 border-slate-200 shadow-md transition group">
          <div class="flex items-start justify-between gap-3">
            
            <div class="flex items-start gap-3.5 min-w-0">
              <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleTaskDone('${item.id}')" class="mt-1 rounded-lg border-2 border-slate-400 text-emerald-600 focus:ring-emerald-600 w-6 h-6 cursor-pointer flex-shrink-0">
              
              <div class="min-w-0">
                <h4 class="text-base sm:text-lg font-black text-slate-950 task-title leading-snug">${escapeHtml(item.title)}</h4>
                
                <div class="flex flex-wrap items-center gap-2 mt-2 text-xs sm:text-sm">
                  <span class="font-extrabold px-3 py-1 rounded-xl ${cat.badgeBg} flex items-center gap-1.5">
                    <i data-lucide="${cat.icon}" class="w-3.5 h-3.5"></i>
                    ${cat.label}
                  </span>
                  ${priorityBadge}
                  <span class="text-slate-800 font-extrabold font-mono bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">${item.duration} min</span>
                  ${item.isFixed ? '<span class="text-xs font-black text-blue-950 bg-blue-100 border border-blue-300 px-2 py-1 rounded-lg">Sztywny termin</span>' : ''}
                  ${isOngoing ? '<span class="text-xs font-black text-emerald-950 bg-emerald-200 px-3 py-1 rounded-full border border-emerald-400 animate-pulse">Trwa teraz</span>' : ''}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1.5 flex-shrink-0">
              <button onclick="openFocusTimer('${item.id}')" class="p-2 text-slate-600 hover:text-emerald-800 hover:bg-emerald-100 rounded-xl transition border border-transparent hover:border-emerald-300" title="Uruchom tryb skupienia dla tego zadania">
                <i data-lucide="timer" class="w-5 h-5"></i>
              </button>
            </div>

          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = itemsHtml;

  if (state.overflow.length > 0) {
    overflowSection.classList.remove('hidden');
    overflowList.innerHTML = state.overflow.map(task => `
      <div class="p-3 bg-white rounded-xl border-2 border-amber-300 text-sm flex items-center justify-between text-slate-900 font-semibold shadow-sm">
        <div class="flex items-center gap-2.5">
          <span class="font-black text-amber-950 bg-amber-200 px-2 py-0.5 rounded-lg border border-amber-300 text-xs">${task.priority}</span>
          <span class="font-bold">${escapeHtml(task.title)}</span>
          <span class="text-xs text-slate-600 font-extrabold">(${task.duration}m)</span>
        </div>
        <span class="text-xs bg-amber-200 text-amber-950 font-black px-2.5 py-1 rounded-full border border-amber-300">Przełóż na jutro</span>
      </div>
    `).join('');
  } else {
    overflowSection.classList.add('hidden');
  }
}

function renderRealismMetrics() {
  const { startTime, endTime } = state.constraints;
  const dayStartMin = timeToMinutes(startTime);
  const dayEndMin = timeToMinutes(endTime);
  const totalDayCapacity = Math.max(0, dayEndMin - dayStartMin);

  document.getElementById('totalDayBudgetBadge').textContent = `Dostępne: ${formatMinutesPolish(totalDayCapacity)}`;

  let plannedWorkMinutes = 0;
  let plannedBufferMinutes = 0;

  state.schedule.forEach(item => {
    if (item.isBuffer || item.isSystemBreak) {
      plannedBufferMinutes += item.duration;
    } else {
      plannedWorkMinutes += item.duration;
    }
  });

  const totalOccupied = plannedWorkMinutes + plannedBufferMinutes;
  const freeMinutes = Math.max(0, totalDayCapacity - totalOccupied);

  const workPercent = Math.min(100, Math.round((plannedWorkMinutes / (totalDayCapacity || 1)) * 100));
  const bufferPercent = Math.min(100 - workPercent, Math.round((plannedBufferMinutes / (totalDayCapacity || 1)) * 100));

  document.getElementById('progressBarPlanned').style.width = `${workPercent}%`;
  document.getElementById('progressBarBuffer').style.width = `${bufferPercent}%`;

  document.getElementById('plannedVsTotalText').textContent = `${formatMinutesPolish(totalOccupied)} / ${formatMinutesPolish(totalDayCapacity)}`;
  document.getElementById('freeTimeText').textContent = `Wolny czas: ${formatMinutesPolish(freeMinutes)}`;

  const realismPill = document.getElementById('realismPill');
  const realismMsg = document.getElementById('realismMessage');

  if (state.schedule.length === 0) {
    realismPill.className = 'text-xs sm:text-sm font-bold px-3 py-1 rounded-full bg-slate-200 text-slate-800 border border-slate-300';
    realismPill.textContent = 'Czeka na plan';
    realismMsg.textContent = 'Wprowadź zadania i wygeneruj plan.';
    return;
  }

  if (state.overflow.length > 0) {
    realismPill.className = 'text-xs sm:text-sm font-black px-3.5 py-1 rounded-full bg-rose-100 text-rose-950 border-2 border-rose-300';
    realismPill.textContent = 'Przeładowany dzień!';
    realismMsg.textContent = `Uwaga: ${state.overflow.length} zadania nie zmieściły się w dostępnym czasie. Algorytm zabezpieczył Twój odpoczynek.`;
  } else if (totalOccupied / totalDayCapacity > 0.85) {
    realismPill.className = 'text-xs sm:text-sm font-black px-3.5 py-1 rounded-full bg-amber-100 text-amber-950 border-2 border-amber-300';
    realismPill.textContent = 'Intensywny dzień (85%+)';
    realismMsg.textContent = 'Wysokie zagęszczenie zadań. Trzymaj się wyznaczonych buforów, by uniknąć opóźnień.';
  } else {
    realismPill.className = 'text-xs sm:text-sm font-black px-3.5 py-1 rounded-full bg-emerald-100 text-emerald-950 border-2 border-emerald-300';
    realismPill.textContent = '100% Realny & Zbalansowany';
    realismMsg.textContent = 'Świetny balans! Masz zaplanowane zadania priorytetowe i wystarczająco dużo oddechu.';
  }
}

// --- Calendar Modal & Interactive Month Grid Logic ---
function openCalendarModal(initialDateIso) {
  state.calendarPreviewDate = initialDateIso || state.selectedDate;
  state.calendarViewMonth = parseIsoDate(state.calendarPreviewDate);

  renderCalendarMonthGrid();
  renderCalendarDayPreview();

  document.getElementById('calendarModal').classList.remove('hidden');
  lucide.createIcons();
}

function renderCalendarMonthGrid() {
  const gridContainer = document.getElementById('calendarDaysGrid');
  const monthTitle = document.getElementById('calMonthTitle');
  const viewYear = state.calendarViewMonth.getFullYear();
  const viewMonth = state.calendarViewMonth.getMonth();

  monthTitle.textContent = formatMonthYearPolish(state.calendarViewMonth);

  // Pierwszy dzień miesiąca
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  // Liczba dni w miesiącu
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  // Dzień tygodnia (0=Niedziela, 1=Poniedziałek) -> zamieniamy na Poniedziałek=0..Niedziela=6
  let firstDayIndex = firstDayOfMonth.getDay() - 1;
  if (firstDayIndex === -1) firstDayIndex = 6;

  // Dni poprzedniego miesiąca
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  let html = '';

  // 1. Dni z poprzedniego miesiąca (padding)
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const prevDayNum = prevMonthDays - i;
    const prevDate = new Date(viewYear, viewMonth - 1, prevDayNum);
    const isoStr = formatIsoDate(prevDate);
    html += renderCalendarCell(isoStr, prevDayNum, true);
  }

  // 2. Dni bieżącego miesiąca
  for (let d = 1; d <= daysInMonth; d++) {
    const currDate = new Date(viewYear, viewMonth, d);
    const isoStr = formatIsoDate(currDate);
    html += renderCalendarCell(isoStr, d, false);
  }

  // 3. Dni z kolejnego miesiąca (dopełnienie do pełnych tygodni)
  const totalRendered = firstDayIndex + daysInMonth;
  const remainingCells = (7 - (totalRendered % 7)) % 7;
  for (let n = 1; n <= remainingCells; n++) {
    const nextDate = new Date(viewYear, viewMonth + 1, n);
    const isoStr = formatIsoDate(nextDate);
    html += renderCalendarCell(isoStr, n, true);
  }

  gridContainer.innerHTML = html;
  lucide.createIcons();
}

function renderCalendarCell(isoStr, dayNumber, isAdjacentMonth) {
  const isToday = isoStr === getLocalTodayIso();
  const isSelected = isoStr === state.calendarPreviewDate;
  
  // Sprawdź czy są zaplanowane zadania w tym dniu
  let tasksCount = 0;
  if (isoStr === state.selectedDate) {
    tasksCount = state.tasks.length;
  } else if (state.plansByDate[isoStr]) {
    tasksCount = (state.plansByDate[isoStr].tasks || []).length;
  }

  const adjacentClass = isAdjacentMonth ? 'opacity-40 text-slate-400 bg-slate-50/50' : 'bg-white text-slate-900';
  const selectedClass = isSelected ? 'is-selected border-emerald-600 bg-emerald-100 font-black' : 'border-slate-200 hover:border-emerald-400 hover:bg-slate-50';
  const todayRing = isToday ? 'is-today' : '';

  return `
    <div onclick="selectCalendarPreviewDay('${isoStr}')" class="calendar-day-cell p-2 rounded-2xl border-2 ${adjacentClass} ${selectedClass} ${todayRing} cursor-pointer flex flex-col justify-between shadow-xs">
      <div class="flex items-center justify-between">
        <span class="text-sm sm:text-base font-extrabold">${dayNumber}</span>
        ${isToday ? '<span class="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-1 rounded">Dziś</span>' : ''}
      </div>
      <div class="mt-1 flex items-center justify-between text-[11px] font-bold">
        ${tasksCount > 0 ? `
          <span class="inline-flex items-center gap-1 text-emerald-950 bg-emerald-200/90 px-1.5 py-0.5 rounded-md border border-emerald-300">
            <span class="w-2 h-2 rounded-full bg-emerald-700"></span>
            <span>${tasksCount} zad.</span>
          </span>
        ` : '<span class="text-slate-300 text-[10px]">—</span>'}
      </div>
    </div>
  `;
}

function selectCalendarPreviewDay(isoStr) {
  state.calendarPreviewDate = isoStr;
  renderCalendarMonthGrid();
  renderCalendarDayPreview();
}

function renderCalendarDayPreview() {
  const previewDateText = document.getElementById('calPreviewDate');
  const previewBadge = document.getElementById('calPreviewBadge');
  const previewWorkTime = document.getElementById('calPreviewWorkTime');
  const previewFixedTime = document.getElementById('calPreviewFixedTime');
  const previewList = document.getElementById('calPreviewTasksList');

  const iso = state.calendarPreviewDate;
  previewDateText.textContent = formatFullDatePolish(iso);

  // Pobierz zadania dla wybranego dnia
  let dayData;
  if (iso === state.selectedDate) {
    dayData = { tasks: state.tasks, schedule: state.schedule, constraints: state.constraints };
  } else if (state.plansByDate[iso]) {
    dayData = state.plansByDate[iso];
  } else {
    dayData = { tasks: [], schedule: [], constraints: state.constraints };
  }

  const tasks = dayData.tasks || [];
  const totalMin = tasks.reduce((sum, t) => sum + Number(t.duration), 0);
  const fixedCount = tasks.filter(t => t.isFixed).length;

  previewBadge.textContent = `${tasks.length} zadań`;
  previewBadge.className = tasks.length > 0
    ? 'text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300 flex-shrink-0'
    : 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 border border-slate-300 flex-shrink-0';

  previewWorkTime.textContent = formatMinutesPolish(totalMin);
  previewFixedTime.textContent = `${fixedCount} spotkań`;

  if (tasks.length === 0) {
    previewList.innerHTML = `
      <div class="text-center py-6 text-slate-500 bg-white rounded-xl border border-dashed border-slate-300 p-4">
        <i data-lucide="calendar-x" class="w-7 h-7 mx-auto mb-1 text-slate-400"></i>
        <p class="text-xs sm:text-sm font-bold text-slate-800">Brak zadań w tym dniu</p>
        <p class="text-[11px] text-slate-500 mt-0.5">Kliknij poniżej, aby otworzyć ten dzień i zaplanować czas.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  previewList.innerHTML = tasks.map(t => {
    const cat = CATEGORIES[t.category] || CATEGORIES.work;
    return `
      <div class="p-2.5 bg-white rounded-xl border-2 border-slate-200 text-xs flex items-center justify-between text-slate-900 shadow-xs">
        <div class="flex items-center gap-2 min-w-0">
          <span class="w-2.5 h-2.5 rounded-full ${cat.badgeBg} flex-shrink-0"></span>
          <span class="font-extrabold truncate">${escapeHtml(t.title)}</span>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0 font-bold">
          <span class="text-slate-600 font-mono">${t.duration}m</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 font-black">${t.priority}</span>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

// --- User Interaction Functions ---
function removeTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  if (state.schedule.length > 0) {
    optimizeSchedule();
  } else {
    saveCurrentDayToStorage();
    renderAll();
  }
  showToast('Zadanie usunięte');
}

function toggleTaskDone(id) {
  const scheduleItem = state.schedule.find(s => s.id === id);
  if (scheduleItem) {
    scheduleItem.done = !scheduleItem.done;
  }
  const rawTask = state.tasks.find(t => t.id === id);
  if (rawTask) {
    rawTask.done = !rawTask.done;
  }
  saveCurrentDayToStorage();
  renderTimeline();
  lucide.createIcons();
}

function loadPreset(presetKey) {
  const preset = PRESETS[presetKey];
  if (!preset) return;

  state.constraints = { ...preset.constraints };
  state.tasks = JSON.parse(JSON.stringify(preset.tasks));

  document.getElementById('dayStartTime').value = state.constraints.startTime;
  document.getElementById('dayEndTime').value = state.constraints.endTime;
  document.getElementById('lunchStartTime').value = state.constraints.lunchStartTime;
  document.getElementById('lunchDuration').value = state.constraints.lunchDuration;
  document.getElementById('bufferDuration').value = state.constraints.bufferDuration;

  document.querySelectorAll('.strategy-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.strategy === state.constraints.strategy);
  });
  document.getElementById('strategyDesc').textContent = STRATEGY_DESCRIPTIONS[state.constraints.strategy];

  optimizeSchedule();
  showToast(`Załadowano szablon: ${presetKey.toUpperCase()}`);
}

// --- Font Size & Contrast Handlers ---
function applyAccessibilitySettings() {
  const body = document.getElementById('appBody');
  body.classList.remove('font-size-md', 'font-size-lg', 'font-size-xl');
  if (state.fontSize === 'md') body.classList.add('font-size-md');
  else if (state.fontSize === 'xl') body.classList.add('font-size-xl');
  else body.classList.add('font-size-lg');

  if (state.highContrast) {
    body.classList.add('high-contrast');
  } else {
    body.classList.remove('high-contrast');
  }

  const normBtn = document.getElementById('fontSizeNormalBtn');
  const lrgBtn = document.getElementById('fontSizeLargeBtn');
  const xlBtn = document.getElementById('fontSizeXLargeBtn');
  const hcBtn = document.getElementById('toggleHighContrastBtn');

  if (normBtn && lrgBtn && xlBtn) {
    normBtn.className = state.fontSize === 'md'
      ? 'px-2.5 py-1 text-xs font-bold rounded-xl bg-emerald-600 text-white border border-emerald-700 shadow-sm transition'
      : 'px-2.5 py-1 text-xs font-bold rounded-xl bg-white text-slate-800 border border-slate-300 shadow-sm hover:bg-slate-50 transition';

    lrgBtn.className = state.fontSize === 'lg'
      ? 'px-3 py-1 text-sm font-extrabold rounded-xl bg-emerald-600 text-white border border-emerald-700 shadow-sm transition'
      : 'px-3 py-1 text-sm font-extrabold rounded-xl bg-white text-slate-800 border border-slate-300 shadow-sm hover:bg-slate-50 transition';

    xlBtn.className = state.fontSize === 'xl'
      ? 'px-3.5 py-1 text-base font-black rounded-xl bg-emerald-600 text-white border border-emerald-700 shadow-sm transition'
      : 'px-3.5 py-1 text-base font-black rounded-xl bg-white text-slate-900 border border-slate-300 shadow-sm hover:bg-slate-50 transition';
  }

  if (hcBtn) {
    hcBtn.classList.toggle('bg-amber-100', state.highContrast);
    hcBtn.classList.toggle('border-amber-400', state.highContrast);
  }
}

// --- Focus Timer (Pomodoro) Logic ---
function openFocusTimer(taskId) {
  const task = state.schedule.find(s => s.id === taskId) || state.tasks.find(t => t.id === taskId);
  if (!task) return;

  state.focusTimer.taskId = task.id;
  const durationMinutes = Math.min(task.duration || 25, 50);
  state.focusTimer.durationSec = durationMinutes * 60;
  state.focusTimer.remainingSec = state.focusTimer.durationSec;
  state.focusTimer.isRunning = false;
  clearInterval(state.focusTimer.intervalId);

  document.getElementById('focusTaskTitle').textContent = task.title;
  document.getElementById('focusTaskCategory').textContent = CATEGORIES[task.category]?.label || 'Zadanie';
  document.getElementById('focusTaskDuration').textContent = `Czas trwania bloku: ${durationMinutes} min`;
  updateFocusTimerDisplay();

  document.getElementById('focusModal').classList.remove('hidden');
  lucide.createIcons();
}

function updateFocusTimerDisplay() {
  const m = Math.floor(state.focusTimer.remainingSec / 60);
  const s = state.focusTimer.remainingSec % 60;
  document.getElementById('focusTimerDisplay').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function startFocusTimer() {
  if (state.focusTimer.isRunning) {
    clearInterval(state.focusTimer.intervalId);
    state.focusTimer.isRunning = false;
    document.getElementById('focusStartBtn').innerHTML = `<i data-lucide="play" class="w-5 h-5"></i><span>Wznów</span>`;
  } else {
    state.focusTimer.isRunning = true;
    document.getElementById('focusStartBtn').innerHTML = `<i data-lucide="pause" class="w-5 h-5"></i><span>Pauza</span>`;

    state.focusTimer.intervalId = setInterval(() => {
      if (state.focusTimer.remainingSec > 0) {
        state.focusTimer.remainingSec--;
        updateFocusTimerDisplay();
      } else {
        clearInterval(state.focusTimer.intervalId);
        state.focusTimer.isRunning = false;
        playTimerChime();
        showToast('Brawo! Czas skupienia dobiegł końca. Zrób przerwę!');
        document.getElementById('focusStartBtn').innerHTML = `<i data-lucide="play" class="w-5 h-5"></i><span>Start</span>`;
      }
    }, 1000);
  }
  lucide.createIcons();
}

function resetFocusTimer() {
  clearInterval(state.focusTimer.intervalId);
  state.focusTimer.isRunning = false;
  state.focusTimer.remainingSec = state.focusTimer.durationSec;
  updateFocusTimerDisplay();
  document.getElementById('focusStartBtn').innerHTML = `<i data-lucide="play" class="w-5 h-5"></i><span>Start</span>`;
  lucide.createIcons();
}

function playTimerChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
    osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.8);
  } catch (e) {
    console.log('Audio not supported or permitted');
  }
}

// --- Export Functions ---
function copyPlanAsText() {
  if (state.schedule.length === 0) {
    showToast('Brak ułożonego planu do skopiowania');
    return;
  }

  let text = `📅 Plan Dnia – ${formatFullDatePolish(state.selectedDate)}\n`;
  text += `Godziny: ${state.constraints.startTime} - ${state.constraints.endTime}\n\n`;

  state.schedule.forEach(item => {
    const s = minutesToTime(item.startMin);
    const e = minutesToTime(item.endMin);
    const check = item.done ? '[x]' : '[ ]';
    text += `${s} - ${e} | ${check} ${item.title} (${item.duration}m)\n`;
  });

  if (state.overflow.length > 0) {
    text += `\n⚠️ Zadania odłożone na jutro:\n`;
    state.overflow.forEach(t => {
      text += `- ${t.title} (${t.duration}m, ${t.priority})\n`;
    });
  }

  navigator.clipboard.writeText(text).then(() => {
    showToast('Plan skopiowany do schowka!');
  }).catch(() => {
    showToast('Nie udało się skopiować');
  });
}

function exportToICS() {
  if (state.schedule.length === 0) {
    showToast('Ułóż najpierw plan, aby go wyeksportować');
    return;
  }

  const d = parseIsoDate(state.selectedDate);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const datePrefix = `${year}${month}${day}`;

  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Chronos Plan//Daily Scheduler//PL',
    'CALSCALE:GREGORIAN'
  ];

  state.schedule.forEach((item, index) => {
    if (item.isBuffer) return;

    const sH = String(Math.floor(item.startMin / 60)).padStart(2, '0');
    const sM = String(item.startMin % 60).padStart(2, '0');
    const eH = String(Math.floor(item.endMin / 60)).padStart(2, '0');
    const eM = String(item.endMin % 60).padStart(2, '0');

    const dtStart = `${datePrefix}T${sH}${sM}00`;
    const dtEnd = `${datePrefix}T${eH}${eM}00`;

    icsContent.push('BEGIN:VEVENT');
    icsContent.push(`UID:chronos-${Date.now()}-${index}@chronosplan.app`);
    icsContent.push(`DTSTAMP:${datePrefix}T000000Z`);
    icsContent.push(`DTSTART:${dtStart}`);
    icsContent.push(`DTEND:${dtEnd}`);
    icsContent.push(`SUMMARY:${item.title.replace(/[,;]/g, '')}`);
    icsContent.push(`DESCRIPTION:Kategoria: ${item.category}, Priorytet: ${item.priority || 'N/A'}`);
    icsContent.push('END:VEVENT');
  });

  icsContent.push('END:VCALENDAR');

  const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Plan_dnia_${datePrefix}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Pobrano plik .ics dla Twojego kalendarza!');
}

// --- Persistence & Storage ---
function saveToLocalStorage() {
  try {
    localStorage.setItem('chronos_state_v3', JSON.stringify({
      selectedDate: state.selectedDate,
      plansByDate: state.plansByDate,
      fontSize: state.fontSize,
      highContrast: state.highContrast
    }));
  } catch (e) {
    console.error('Storage error', e);
  }
}

function loadFromLocalStorage() {
  try {
    const rawV3 = localStorage.getItem('chronos_state_v3');
    if (rawV3) {
      const data = JSON.parse(rawV3);
      if (data.selectedDate) state.selectedDate = data.selectedDate;
      if (data.plansByDate) state.plansByDate = data.plansByDate;
      if (data.fontSize) state.fontSize = data.fontSize;
      if (data.highContrast !== undefined) state.highContrast = data.highContrast;
      return true;
    }

    // Migracja z wersji v2/v1
    const rawV2 = localStorage.getItem('chronos_state_v2') || localStorage.getItem('chronos_state_v1');
    if (rawV2) {
      const data = JSON.parse(rawV2);
      const todayIso = getLocalTodayIso();
      state.plansByDate[todayIso] = {
        constraints: data.constraints || state.constraints,
        tasks: data.tasks || [],
        schedule: data.schedule || [],
        overflow: data.overflow || []
      };
      if (data.fontSize) state.fontSize = data.fontSize;
      if (data.highContrast !== undefined) state.highContrast = data.highContrast;
      return true;
    }
  } catch (e) {
    console.error('Storage parse error', e);
  }
  return false;
}

// --- Helpers ---
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  const msgElem = document.getElementById('toastMessage');
  msgElem.textContent = msg;
  toast.classList.remove('translate-y-20', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 2800);
}

// --- Initialization & Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
  // 1. Wczytaj dane z pamięci podręcznej
  loadFromLocalStorage();
  applyAccessibilitySettings();

  // 2. Jeśli brak planu dla wybranego dnia, zainicjalizuj szablon
  if (!state.plansByDate[state.selectedDate]) {
    loadPreset('freelancer');
    saveCurrentDayToStorage();
  } else {
    const dayData = state.plansByDate[state.selectedDate];
    state.constraints = JSON.parse(JSON.stringify(dayData.constraints));
    state.tasks = JSON.parse(JSON.stringify(dayData.tasks || []));
    state.schedule = JSON.parse(JSON.stringify(dayData.schedule || []));
    state.overflow = JSON.parse(JSON.stringify(dayData.overflow || []));
    
    document.getElementById('dayStartTime').value = state.constraints.startTime;
    document.getElementById('dayEndTime').value = state.constraints.endTime;
    document.getElementById('lunchStartTime').value = state.constraints.lunchStartTime;
    document.getElementById('lunchDuration').value = state.constraints.lunchDuration;
    document.getElementById('bufferDuration').value = state.constraints.bufferDuration;
    
    updateHeaderDateDisplay();
    renderAll();
  }

  // 3. Obsługa wyboru daty w nagłówku
  document.getElementById('prevDayBtn').addEventListener('click', () => {
    const cur = parseIsoDate(state.selectedDate);
    cur.setDate(cur.getDate() - 1);
    switchDate(formatIsoDate(cur));
  });

  document.getElementById('nextDayBtn').addEventListener('click', () => {
    const cur = parseIsoDate(state.selectedDate);
    cur.setDate(cur.getDate() + 1);
    switchDate(formatIsoDate(cur));
  });

  document.getElementById('jumpTodayBtn').addEventListener('click', () => {
    switchDate(getLocalTodayIso());
  });

  const nativeDatePicker = document.getElementById('nativeDatePicker');
  if (nativeDatePicker) {
    nativeDatePicker.addEventListener('change', (e) => {
      if (e.target.value) {
        switchDate(e.target.value);
      }
    });
  }

  // 4. Obsługa otwierania kalendarza
  document.getElementById('openCalendarBtn').addEventListener('click', () => {
    openCalendarModal(state.selectedDate);
  });
  document.getElementById('calendarModalBtn').addEventListener('click', () => {
    openCalendarModal(state.selectedDate);
  });

  document.getElementById('closeCalendarModal').addEventListener('click', () => {
    document.getElementById('calendarModal').classList.add('hidden');
  });

  // Nawigacja w miesiącach w kalendarzu
  document.getElementById('calPrevMonthBtn').addEventListener('click', () => {
    state.calendarViewMonth.setMonth(state.calendarViewMonth.getMonth() - 1);
    renderCalendarMonthGrid();
  });

  document.getElementById('calNextMonthBtn').addEventListener('click', () => {
    state.calendarViewMonth.setMonth(state.calendarViewMonth.getMonth() + 1);
    renderCalendarMonthGrid();
  });

  document.getElementById('calTodayJumpBtn').addEventListener('click', () => {
    state.calendarViewMonth = new Date();
    selectCalendarPreviewDay(getLocalTodayIso());
  });

  // Przycisk "Otwórz ten dzień w planerze"
  document.getElementById('calSelectAndEditBtn').addEventListener('click', () => {
    switchDate(state.calendarPreviewDate);
    document.getElementById('calendarModal').classList.add('hidden');
    showToast(`Przełączono na dzień: ${formatFullDatePolish(state.selectedDate)}`);
  });

  // Przycisk "Skopiuj zadania z dzisiaj" w podglądzie
  document.getElementById('calCopyFromTodayBtn').addEventListener('click', () => {
    const todayTasks = state.tasks;
    if (todayTasks.length === 0) {
      showToast('W bieżącym dniu nie ma zadań do skopiowania');
      return;
    }
    const targetIso = state.calendarPreviewDate;
    if (!state.plansByDate[targetIso]) {
      state.plansByDate[targetIso] = {
        constraints: JSON.parse(JSON.stringify(state.constraints)),
        tasks: [],
        schedule: [],
        overflow: []
      };
    }
    state.plansByDate[targetIso].tasks = JSON.parse(JSON.stringify(todayTasks));
    saveToLocalStorage();
    renderCalendarMonthGrid();
    renderCalendarDayPreview();
    showToast(`Skopiowano ${todayTasks.length} zadań do wybranego dnia!`);
  });

  // 5. Obsługa powiększania czcionki i kontrastu
  document.getElementById('fontSizeNormalBtn').addEventListener('click', () => {
    state.fontSize = 'md';
    applyAccessibilitySettings();
    saveToLocalStorage();
    showToast('Rozmiar czcionki: Standardowy');
  });

  document.getElementById('fontSizeLargeBtn').addEventListener('click', () => {
    state.fontSize = 'lg';
    applyAccessibilitySettings();
    saveToLocalStorage();
    showToast('Rozmiar czcionki: Duży (Zalecany)');
  });

  document.getElementById('fontSizeXLargeBtn').addEventListener('click', () => {
    state.fontSize = 'xl';
    applyAccessibilitySettings();
    saveToLocalStorage();
    showToast('Rozmiar czcionki: Bardzo Duży');
  });

  document.getElementById('toggleHighContrastBtn').addEventListener('click', () => {
    state.highContrast = !state.highContrast;
    applyAccessibilitySettings();
    saveToLocalStorage();
    showToast(state.highContrast ? 'Włączono tryb wysokiego kontrastu' : 'Wyłączono tryb wysokiego kontrastu');
  });

  // 6. Obsługa formularza dodawania zadania
  const taskForm = document.getElementById('taskForm');
  const isFixedCheck = document.getElementById('taskIsFixed');
  const fixedTimeWrapper = document.getElementById('fixedTimeWrapper');

  isFixedCheck.addEventListener('change', (e) => {
    if (e.target.checked) {
      fixedTimeWrapper.classList.remove('hidden');
    } else {
      fixedTimeWrapper.classList.add('hidden');
    }
  });

  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const titleInput = document.getElementById('taskTitle');
    const title = titleInput.value.trim();
    if (!title) return;

    const newTask = {
      id: 'task-' + Date.now(),
      title: title,
      duration: Number(document.getElementById('taskDuration').value),
      priority: document.getElementById('taskPriority').value,
      category: document.getElementById('taskCategory').value,
      energy: document.getElementById('taskEnergy').value,
      isFixed: isFixedCheck.checked,
      fixedTime: isFixedCheck.checked ? document.getElementById('taskFixedTime').value : null,
      done: false
    };

    state.tasks.push(newTask);
    titleInput.value = '';
    isFixedCheck.checked = false;
    fixedTimeWrapper.classList.add('hidden');

    saveCurrentDayToStorage();
    renderTasksPool();
    showToast('Dodano zadanie do puli');
    lucide.createIcons();
  });

  // 7. Obsługa parametrów ram dnia
  ['dayStartTime', 'dayEndTime', 'lunchStartTime', 'lunchDuration', 'bufferDuration'].forEach(id => {
    document.getElementById(id).addEventListener('change', (e) => {
      state.constraints[id.replace('day', '').replace(/^[A-Z]/, c => c.toLowerCase())] = e.target.value;
      saveCurrentDayToStorage();
      renderRealismMetrics();
    });
  });

  // 8. Obsługa strategii
  document.querySelectorAll('.strategy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.strategy-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const strategy = btn.dataset.strategy;
      state.constraints.strategy = strategy;
      document.getElementById('strategyDesc').textContent = STRATEGY_DESCRIPTIONS[strategy];
      saveCurrentDayToStorage();
      optimizeSchedule();
    });
  });

  // 9. Przyciski akcji
  document.getElementById('autoScheduleBtn').addEventListener('click', () => {
    optimizeSchedule();
    showToast('Plan dnia został pomyślnie zoptymalizowany!');
  });

  document.getElementById('regenerateBtn').addEventListener('click', () => {
    optimizeSchedule();
  });

  document.getElementById('presetStudentBtn').addEventListener('click', () => loadPreset('student'));
  document.getElementById('presetFreelancerBtn').addEventListener('click', () => loadPreset('freelancer'));
  document.getElementById('presetManagerBtn').addEventListener('click', () => loadPreset('manager'));

  document.getElementById('clearAllBtn').addEventListener('click', () => {
    if (confirm(`Czy na pewno chcesz wyczyścić wszystkie zadania dla dnia: ${formatFullDatePolish(state.selectedDate)}?`)) {
      state.tasks = [];
      state.schedule = [];
      state.overflow = [];
      saveCurrentDayToStorage();
      renderAll();
      showToast('Wyczyszczono plan wybranego dnia');
    }
  });

  document.getElementById('copyPlanBtn').addEventListener('click', copyPlanAsText);
  document.getElementById('exportIcsBtn').addEventListener('click', exportToICS);
  document.getElementById('printPlanBtn').addEventListener('click', () => window.print());

  // 10. Timer Focus Modal
  document.getElementById('focusModeBtn').addEventListener('click', () => {
    const firstUndone = state.schedule.find(s => !s.done && !s.isBuffer && !s.isSystemBreak);
    if (firstUndone) {
      openFocusTimer(firstUndone.id);
    } else {
      showToast('Wszystkie zadania są ukończone lub brak zadań w planie!');
    }
  });

  document.getElementById('closeFocusModal').addEventListener('click', () => {
    document.getElementById('focusModal').classList.add('hidden');
    clearInterval(state.focusTimer.intervalId);
    state.focusTimer.isRunning = false;
  });

  document.getElementById('focusStartBtn').addEventListener('click', startFocusTimer);
  document.getElementById('focusResetBtn').addEventListener('click', resetFocusTimer);
  document.getElementById('focusMarkDoneBtn').addEventListener('click', () => {
    if (state.focusTimer.taskId) {
      toggleTaskDone(state.focusTimer.taskId);
      document.getElementById('focusModal').classList.add('hidden');
      clearInterval(state.focusTimer.intervalId);
      state.focusTimer.isRunning = false;
      showToast('Zadanie ukończone! Gratulacje!');
    }
  });

  // 11. Przełącznik ukrywania ukończonych zadań
  document.getElementById('toggleDoneTasksBtn').addEventListener('click', () => {
    state.filterHideDone = !state.filterHideDone;
    document.getElementById('toggleDoneTasksBtn').classList.toggle('bg-slate-200', state.filterHideDone);
    renderTimeline();
    lucide.createIcons();
  });

  // 12. Przycisk przykładowego zadania (Szybkie dodanie)
  const sampleBtn = document.getElementById('quickVoiceOrSample');
  if (sampleBtn) {
    sampleBtn.addEventListener('click', () => {
      const sampleTasks = [
        { title: 'Przygotowanie raportu i podsumowania', dur: 45, prio: 'P1', cat: 'work', energy: 'high' },
        { title: 'Krótki spacer na dotlenienie mózgu', dur: 30, prio: 'P2', cat: 'health', energy: 'low' },
        { title: 'Przegląd materiałów i fiszek', dur: 30, prio: 'P2', cat: 'study', energy: 'medium' },
        { title: 'Odpowiedź na zaległe maile', dur: 30, prio: 'P3', cat: 'admin', energy: 'low' }
      ];
      const randomSample = sampleTasks[Math.floor(Math.random() * sampleTasks.length)];
      document.getElementById('taskTitle').value = randomSample.title;
      document.getElementById('taskDuration').value = randomSample.dur;
      document.getElementById('taskPriority').value = randomSample.prio;
      document.getElementById('taskCategory').value = randomSample.cat;
      document.getElementById('taskEnergy').value = randomSample.energy;
      showToast('Wypełniono przykładowe zadanie!');
    });
  }

  // Render icons
  lucide.createIcons();
});

// Explicit window exposure for inline onclick handlers
window.removeTask = removeTask;
window.toggleTaskDone = toggleTaskDone;
window.openFocusTimer = openFocusTimer;
window.selectCalendarPreviewDay = selectCalendarPreviewDay;
