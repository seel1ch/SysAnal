/**
 * Интерактивное приложение по подготовке к защите проектов по системному анализу
 * Включает полную поддержку Практической работы №3 и Практической работы №4
 * ТУСУР, проф. Захарова А.А.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global Application State
  // Global Application State: по требованию, при загрузке сайта ВСЕГДА включается последняя практическая
  const prKeys = window.PR_DATA ? Object.keys(window.PR_DATA) : ['pr3', 'pr4'];
  const latestPr = prKeys.length > 0 ? prKeys[prKeys.length - 1] : 'pr4';
  const initialPr = latestPr;

  const state = {
    currentPr: initialPr,
    activeTab: 'cheatsheet',
    searchQuery: '',
    learnedQuestions: new Set(JSON.parse(localStorage.getItem(`sa_learned_${initialPr}`) || (initialPr === 'pr3' ? localStorage.getItem('sa_learned') || '[]' : '[]'))),
    flashcards: [...(window.PR_DATA ? window.PR_DATA[initialPr].flashcards : APP_DATA.flashcards)],
    currentCardIndex: 0,
    isCardFlipped: false,
    knownCards: new Set(JSON.parse(localStorage.getItem(`sa_known_cards_${initialPr}`) || (initialPr === 'pr3' ? localStorage.getItem('sa_known_cards') || '[]' : '[]'))),
    quizIndex: 0,
    quizScore: 0,
    quizUserAnswers: {},
    quizFinished: false,
    isSpeaking: false,
    currentSpeechId: null,
    theme: localStorage.getItem('sa_theme') || 'light'
  };

  // Ensure global APP_DATA points to active practical work
  if (window.PR_DATA) {
    window.APP_DATA = window.PR_DATA[state.currentPr];
  }

  // DOM Elements
  const tabButtons = document.querySelectorAll('[data-tab-target]');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const searchInput = document.getElementById('global-search');
  const themeToggleBtn = document.getElementById('theme-toggle');
  const prToggleBtns = document.querySelectorAll('.pr-toggle-btn');

  // Initialize theme
  function initTheme() {
    if (state.theme === 'dark' || (!('sa_theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      state.theme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      state.theme = 'light';
    }
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('sa_theme', state.theme);
      initTheme();
    });
  }

  // Math rendering helper (KaTeX)
  function renderMath() {
    if (window.renderMathInElement) {
      renderMathInElement(document.body, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true }
        ],
        throwOnError: false
      });
    }
  }

  // Fallback retry if KaTeX is loaded asynchronously
  if (!window.renderMathInElement) {
    const katexPoll = setInterval(() => {
      if (window.renderMathInElement) {
        clearInterval(katexPoll);
        renderMath();
      }
    }, 150);
    setTimeout(() => clearInterval(katexPoll), 6000);
  }

  // Tab switching
  function switchTab(tabId) {
    state.activeTab = tabId;
    tabButtons.forEach(btn => {
      const target = btn.dataset.tabTarget;
      if (target === tabId) {
        btn.classList.add('active', 'border-indigo-600', 'text-indigo-600', 'dark:border-indigo-400', 'dark:text-indigo-400');
        btn.classList.remove('border-transparent', 'text-slate-500', 'hover:text-slate-700', 'dark:text-slate-400');
      } else {
        btn.classList.remove('active', 'border-indigo-600', 'text-indigo-600', 'dark:border-indigo-400', 'dark:text-indigo-400');
        btn.classList.add('border-transparent', 'text-slate-500', 'hover:text-slate-700', 'dark:text-slate-400');
      }
    });

    tabPanes.forEach(pane => {
      if (pane.id === `tab-${tabId}`) {
        pane.classList.remove('hidden');
      } else {
        pane.classList.add('hidden');
      }
    });

    setTimeout(renderMath, 50);
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tabTarget);
    });
  });

  // -------------------------------------------------------------
  // PRACTICAL WORK SWITCHER (PR-3 vs PR-4)
  // -------------------------------------------------------------
  function switchPractical(prKey) {
    if (!window.PR_DATA || !window.PR_DATA[prKey]) return;

    state.currentPr = prKey;
    localStorage.setItem('sa_current_pr', prKey);
    window.APP_DATA = window.PR_DATA[prKey];

    // Load learned & cards sets for this specific PR
    state.learnedQuestions = new Set(JSON.parse(localStorage.getItem(`sa_learned_${prKey}`) || (prKey === 'pr3' ? localStorage.getItem('sa_learned') || '[]' : '[]')));
    state.knownCards = new Set(JSON.parse(localStorage.getItem(`sa_known_cards_${prKey}`) || (prKey === 'pr3' ? localStorage.getItem('sa_known_cards') || '[]' : '[]')));
    state.flashcards = [...window.APP_DATA.flashcards];
    state.currentCardIndex = 0;
    state.isCardFlipped = false;

    // Reset quiz
    state.quizIndex = 0;
    state.quizScore = 0;
    state.quizUserAnswers = {};
    state.quizFinished = false;

    // Update PR toggle button styles
    prToggleBtns.forEach(btn => {
      const targetPr = btn.dataset.pr;
      if (targetPr === prKey) {
        btn.classList.add('bg-white', 'dark:bg-slate-800', 'text-indigo-600', 'dark:text-indigo-400', 'shadow-sm', 'font-bold');
        btn.classList.remove('text-slate-600', 'dark:text-slate-400', 'font-semibold');
      } else {
        btn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-indigo-600', 'dark:text-indigo-400', 'shadow-sm', 'font-bold');
        btn.classList.add('text-slate-600', 'dark:text-slate-400', 'font-semibold');
      }
    });

    // Update Headings & Navigation Labels
    const numQ = window.APP_DATA.questions.length;
    const navCheatLabel = document.getElementById('nav-cheatsheet-label');
    const navCalcLabel = document.getElementById('nav-calc-label');
    const cheatsheetHeading = document.getElementById('cheatsheet-heading');
    const headerSubtitle = document.getElementById('header-subtitle');
    const calcsHeading = document.getElementById('calculators-heading');
    const calcsSubheading = document.getElementById('calculators-subheading');

    if (navCheatLabel) navCheatLabel.innerText = `⚡ Шпаргалка к защите (${numQ} вопросов)`;
    if (cheatsheetHeading) {
      cheatsheetHeading.innerText = `Шпаргалка: ${numQ} вопросов к защите (${prKey === 'pr3' ? 'Практика 3: Измерения' : 'Практика 4: Нечеткие множества'})`;
    }
    if (headerSubtitle) {
      headerSubtitle.innerText = prKey === 'pr3'
        ? 'Методы субъективных измерений и экспертные оценки'
        : 'Нечеткие множества и алгоритм вывода Мамдани';
    }
    if (searchInput) {
      searchInput.placeholder = `Поиск по ${numQ} вопросам...`;
    }

    // Toggle Calculators Container
    const pr3Calcs = document.getElementById('pr3-calculators');
    const pr4Calcs = document.getElementById('pr4-calculators');

    if (prKey === 'pr3') {
      if (pr3Calcs) pr3Calcs.classList.remove('hidden');
      if (pr4Calcs) pr4Calcs.classList.add('hidden');
      if (navCalcLabel) navCalcLabel.innerText = '🧮 Интерактивные калькуляторы (4)';
      if (calcsHeading) calcsHeading.innerText = 'Интерактивная лаборатория: 4 живых калькулятора (Практика 3)';
      if (calcsSubheading) calcsSubheading.innerText = 'Проверьте расчеты своими руками: конкордация Кендалла, парные сравнения, непосредственное оценивание и метод Черчмена-Акоффа.';
    } else {
      if (pr3Calcs) pr3Calcs.classList.add('hidden');
      if (pr4Calcs) pr4Calcs.classList.remove('hidden');
      if (navCalcLabel) navCalcLabel.innerText = '🧮 Интерактивные симуляторы (2)';
      if (calcsHeading) calcsHeading.innerText = 'Интерактивная лаборатория: 2 живых симулятора (Практика 4)';
      if (calcsSubheading) calcsSubheading.innerText = 'Интерактивный конструктор функций принадлежности и пошаговый 5-этапный симулятор вывода Мамдани с дефаззификацией.';
      // Render PR4 calculators
      renderMfSliders();
      drawMfGraph();
      computeMamdani();
    }

    // Re-render all views
    renderQuickIndex();
    renderQuestions();
    renderTheory();
    renderFlashcard();
    renderQuiz();
    updateProgressHeader();

    setTimeout(renderMath, 50);
  }

  prToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchPractical(btn.dataset.pr);
    });
  });

  // Text-To-Speech (Web Speech API)
  function speakText(text, id) {
    if (!('speechSynthesis' in window)) {
      alert('Ваш браузер не поддерживает синтез речи.');
      return;
    }

    if (state.isSpeaking && state.currentSpeechId === id) {
      window.speechSynthesis.cancel();
      state.isSpeaking = false;
      state.currentSpeechId = null;
      updateSpeechButtons();
      return;
    }

    window.speechSynthesis.cancel();
    const clean = text
      .replace(/<[^>]*>/g, '')
      .replace(/\$\$?[^$]+\$\$?/g, '')
      .replace(/[«»"]/g, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'ru-RU';
    utterance.rate = 1.0;

    utterance.onend = () => {
      state.isSpeaking = false;
      state.currentSpeechId = null;
      updateSpeechButtons();
    };

    utterance.onerror = () => {
      state.isSpeaking = false;
      state.currentSpeechId = null;
      updateSpeechButtons();
    };

    state.isSpeaking = true;
    state.currentSpeechId = id;
    updateSpeechButtons();
    window.speechSynthesis.speak(utterance);
  }

  function updateSpeechButtons() {
    document.querySelectorAll('.speech-btn').forEach(btn => {
      const qId = parseInt(btn.dataset.questionId, 10);
      if (state.isSpeaking && state.currentSpeechId === qId) {
        btn.innerHTML = `
          <svg class="w-4 h-4 animate-pulse text-red-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
          <span class="text-red-500">Остановить</span>
        `;
      } else {
        btn.innerHTML = `
          <svg class="w-4 h-4 text-indigo-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
          <span>Озвучить ответ</span>
        `;
      }
    });
  }

  // Toggle Learned status for a question
  function toggleLearned(qId) {
    if (state.learnedQuestions.has(qId)) {
      state.learnedQuestions.delete(qId);
    } else {
      state.learnedQuestions.add(qId);
    }
    localStorage.setItem(`sa_learned_${state.currentPr}`, JSON.stringify(Array.from(state.learnedQuestions)));
    renderQuestions();
    updateProgressHeader();
  }

  function updateProgressHeader() {
    const total = window.APP_DATA.questions.length;
    const learned = state.learnedQuestions.size;
    const pct = Math.round((learned / total) * 100);
    const progressEl = document.getElementById('overall-progress-text');
    const progressBar = document.getElementById('overall-progress-bar');
    if (progressEl) progressEl.innerText = `${learned}/${total} (${pct}%) вопросов изучено`;
    if (progressBar) progressBar.style.width = `${pct}%`;
  }

  // Render Dynamic Quick Index Pills
  function renderQuickIndex() {
    const pillsContainer = document.getElementById('quick-index-pills');
    if (!pillsContainer) return;

    pillsContainer.innerHTML = window.APP_DATA.questions.map(q => {
      // Short label
      let label = q.title.split(':')[0].split('?')[0];
      if (label.length > 24) label = label.slice(0, 22) + '...';
      return `
        <a href="#question-${q.id}" class="px-2 py-1 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition flex items-center gap-1">
          <span class="font-bold">${q.id}.</span>
          <span>${label}</span>
        </a>
      `;
    }).join('');
  }

  // Render Questions (Cheat Sheet)
  function renderQuestions() {
    const container = document.getElementById('questions-container');
    if (!container) return;

    const query = state.searchQuery.toLowerCase().trim();
    const filtered = window.APP_DATA.questions.filter(q => {
      if (!query) return true;
      return (
        q.title.toLowerCase().includes(query) ||
        q.shortAnswer.toLowerCase().includes(query) ||
        (q.lectureExcerpt && q.lectureExcerpt.toLowerCase().includes(query)) ||
        q.oralDefense.toLowerCase().includes(query) ||
        (q.tags && q.tags.some(t => t.toLowerCase().includes(query)))
      );
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12 text-slate-400">
          <p class="text-lg">Ничего не найдено по запросу "${state.searchQuery}"</p>
          <button id="reset-search-btn" class="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Сбросить поиск</button>
        </div>
      `;
      document.getElementById('reset-search-btn')?.addEventListener('click', () => {
        state.searchQuery = '';
        if (searchInput) searchInput.value = '';
        renderQuestions();
      });
      return;
    }

    container.innerHTML = filtered.map(q => {
      const isLearned = state.learnedQuestions.has(q.id);
      return `
        <article class="bg-white dark:bg-slate-800 rounded-xl border ${isLearned ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50/20' : 'border-slate-200 dark:border-slate-700'} shadow-sm hover:shadow-md transition-all duration-200 p-5 md:p-6 mb-5" id="question-${q.id}">
          <header class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-4 mb-4">
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center justify-center w-9 h-9 rounded-lg font-bold text-sm ${isLearned ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'}">
                ${q.num}
              </span>
              <div>
                <h3 class="text-lg md:text-xl font-bold text-slate-900 dark:text-white">${q.title}</h3>
                <span class="text-xs text-slate-500 dark:text-slate-400">Источник: ${q.slidesRef}</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button data-question-id="${q.id}" class="speech-btn no-print flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition">
                <svg class="w-4 h-4 text-indigo-500" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                <span>Озвучить</span>
              </button>
              <button data-learn-id="${q.id}" class="learn-btn no-print flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg ${isLearned ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-600'} transition">
                ${isLearned ? '✓ Выучено' : 'Отметить как выученное'}
              </button>
            </div>
          </header>

          <!-- 1. Выжимка без лишних слов -->
          <div class="mb-4 p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 border-l-4 border-indigo-500 rounded-r-lg">
            <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300 mb-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              Суть ответа (без лишних слов):
            </div>
            <p class="text-sm md:text-base text-slate-800 dark:text-slate-200 font-medium leading-relaxed">${q.shortAnswer}</p>
          </div>

          <!-- 2. Суть ответа из лекции (как есть) -->
          <div class="mb-4 p-3.5 bg-sky-50/80 dark:bg-sky-950/40 border-l-4 border-sky-500 rounded-r-lg">
            <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-sky-900 dark:text-sky-300 mb-1.5">
              <span class="flex items-center gap-1.5">
                <svg class="w-4 h-4 text-sky-600 dark:text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                </svg>
                Суть ответа из лекции (как есть):
              </span>
              <span class="text-[11px] font-mono text-sky-600 dark:text-sky-400 lowercase">прямые вырезки из слайдов</span>
            </div>
            <div class="text-xs md:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
              ${q.lectureExcerpt}
            </div>
          </div>

          <!-- 3. Как сказать преподавателю своими словами -->
          <div class="mb-4 p-3.5 bg-amber-50/70 dark:bg-amber-950/40 border-l-4 border-amber-500 rounded-r-lg">
            <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
              Как сказать преподавателю своими словами:
            </div>
            <p class="text-xs md:text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed">${q.oralDefense}</p>
          </div>

          <!-- 4. Раскрывающийся блок теории и формул -->
          <details class="group border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden mb-3">
            <summary class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 cursor-pointer font-semibold text-xs md:text-sm text-slate-700 dark:text-slate-300 group-open:border-b group-open:border-slate-200 dark:group-open:border-slate-700">
              <span class="flex items-center gap-2">
                <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                Развернуть теоретическую базу и формулы
              </span>
              <svg class="w-4 h-4 transform group-open:rotate-180 transition-transform text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </summary>
            <div class="p-4 bg-white dark:bg-slate-800 text-xs md:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
              ${q.deepDive}
            </div>
          </details>

          <!-- 5. Каверзный вопрос на защите -->
          <div class="p-3 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-lg">
            <div class="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400 mb-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              Каверзный вопрос на защите:
            </div>
            <p class="text-xs text-rose-900 dark:text-rose-200">${q.examTrap}</p>
          </div>

          <!-- Теги вопроса -->
          <footer class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap gap-1.5">
            ${(q.tags || []).map(t => `<span class="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-[10px] font-medium">#${t}</span>`).join('')}
          </footer>
        </article>
      `;
    }).join('');

    // Attach speech listeners
    document.querySelectorAll('.speech-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const qId = parseInt(btn.dataset.questionId, 10);
        const question = window.APP_DATA.questions.find(q => q.id === qId);
        if (question) {
          const speechContent = `${question.title}. Суть ответа: ${question.shortAnswer}. Своими словами: ${question.oralDefense}`;
          speakText(speechContent, qId);
        }
      });
    });

    // Attach learn toggle listeners
    document.querySelectorAll('.learn-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const qId = parseInt(btn.dataset.learnId, 10);
        toggleLearned(qId);
      });
    });

    renderMath();
  }

  // Render Theory Sections
  function renderTheory() {
    const container = document.getElementById('theory-container');
    if (!container) return;

    container.innerHTML = window.APP_DATA.theorySections.map(sec => `
      <article class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 md:p-6 mb-6 shadow-sm">
        <header class="border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
          <h3 class="text-lg md:text-xl font-bold text-slate-900 dark:text-white">${sec.title}</h3>
          <p class="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-1">${sec.summary}</p>
        </header>
        <div class="text-xs md:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
          ${sec.content}
        </div>
      </article>
    `).join('');

    renderMath();
  }

  // Search input handler
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (state.activeTab !== 'cheatsheet') {
        switchTab('cheatsheet');
      }
      renderQuestions();
    });
  }

  // -------------------------------------------------------------
  // PR-3 CALCULATORS ENGINE (1, 2, 3, 4)
  // -------------------------------------------------------------

  // Calculator 1: Concordance & Ranking
  const calc1ExpertsInput = document.getElementById('calc1-m');
  const calc1ObjectsInput = document.getElementById('calc1-n');
  const calc1GridContainer = document.getElementById('calc1-grid-container');
  const calc1ComputeBtn = document.getElementById('calc1-compute-btn');
  const calc1LoadExampleBtn = document.getElementById('calc1-load-example-btn');
  const calc1ResultsContainer = document.getElementById('calc1-results');

  let calc1Matrix = [
    [3, 7, 1, 2, 6, 4, 5],
    [1, 5, 2, 3, 7, 4, 6],
    [1, 6, 4, 2, 7, 3, 5]
  ];

  function buildCalc1Grid(m, n, values = null) {
    if (!calc1GridContainer) return;
    let html = `<table class="min-w-full text-xs text-center border border-slate-300 dark:border-slate-700">`;
    html += `<thead class="bg-slate-100 dark:bg-slate-700"><tr><th class="p-2 border">Эксперт / Объект</th>`;
    for (let j = 1; j <= n; j++) {
      html += `<th class="p-2 border font-bold">x${j}</th>`;
    }
    html += `</tr></thead><tbody>`;

    for (let i = 1; i <= m; i++) {
      html += `<tr><td class="p-2 border font-semibold bg-slate-50 dark:bg-slate-800">Эксперт ${i}</td>`;
      for (let j = 1; j <= n; j++) {
        const val = values && values[i - 1] && values[i - 1][j - 1] !== undefined ? values[i - 1][j - 1] : j;
        html += `<td class="p-1 border"><input type="number" step="0.5" min="1" max="${n}" class="calc1-cell w-14 text-center border rounded p-1 dark:bg-slate-900 dark:border-slate-700" data-row="${i - 1}" data-col="${j - 1}" value="${val}"></td>`;
      }
      html += `</tr>`;
    }
    html += `</tbody></table>`;
    calc1GridContainer.innerHTML = html;
  }

  function computeConcordance() {
    if (!calc1ExpertsInput || !calc1ObjectsInput || !calc1ResultsContainer) return;
    const m = parseInt(calc1ExpertsInput.value, 10);
    const n = parseInt(calc1ObjectsInput.value, 10);

    const matrix = [];
    for (let i = 0; i < m; i++) {
      matrix[i] = [];
      for (let j = 0; j < n; j++) {
        const input = document.querySelector(`.calc1-cell[data-row="${i}"][data-col="${j}"]`);
        matrix[i][j] = parseFloat(input ? input.value : 0) || 0;
      }
    }

    // 1. Sum of ranks per object
    const sumRanks = new Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < m; i++) {
        sumRanks[j] += matrix[i][j];
      }
    }

    // 2. Mean rank sum
    const totalSum = sumRanks.reduce((acc, v) => acc + v, 0);
    const meanR = totalSum / n;

    // 3. Deviations
    const deviations = sumRanks.map(s => s - meanR);
    const sumSqDev = deviations.reduce((acc, d) => acc + d * d, 0);

    // 4. Tied ranks correction T_s for each expert
    let totalT = 0;
    const tiedDetails = [];
    for (let i = 0; i < m; i++) {
      const counts = {};
      matrix[i].forEach(r => { counts[r] = (counts[r] || 0) + 1; });
      let Ti = 0;
      for (const rankVal in counts) {
        const h = counts[rankVal];
        if (h > 1) {
          Ti += (Math.pow(h, 3) - h);
        }
      }
      totalT += Ti;
      tiedDetails.push({ expert: i + 1, Ti });
    }

    // 5. Coefficient of Concordance K
    const denominator = (Math.pow(m, 2) * (Math.pow(n, 3) - n)) - (m * totalT);
    let K = denominator > 0 ? (12 * sumSqDev) / denominator : 0;
    if (K > 1) K = 1;

    // 6. Qualitative Interpretation (точно по шкале слайда 122 лекции проф. Захаровой А.А.)
    let interpretation = '';
    let badgeColor = '';
    if (K < 0.3) {
      interpretation = 'Слабая согласованность (K < 0.3, слайд 122). Мнения экспертов существенно расходятся, обобщенная оценка ненадежна.';
      badgeColor = 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300';
    } else if (K < 0.5) {
      interpretation = 'Умеренная согласованность (0.3 <= K < 0.5, слайд 122). Приемлема для ориентировочных выводов, рекомендуется повторный тур.';
      badgeColor = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
    } else if (K < 0.7) {
      interpretation = 'Заметная согласованность (0.5 <= K < 0.7, слайд 122). Приемлема для большинства инженерных задач.';
      badgeColor = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300';
    } else if (K < 0.9) {
      interpretation = 'Высокая согласованность (0.7 <= K < 0.9, слайд 122). Мнения экспертов согласованы, обобщенная оценка достоверна.';
      badgeColor = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300';
    } else {
      interpretation = 'Очень высокая согласованность (K >= 0.9, слайд 122). Практически полное единодушие экспертов.';
      badgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
    }

    // 7. Chi-Square Pearson Criterion
    const chiSquare = m * (n - 1) * K;
    const df = n - 1;

    // 8. Generalized Ranking (со связными рангами при равенстве сумм — точно по слайду 120 лекции)
    const rankedObjects = sumRanks
      .map((sum, idx) => ({ id: idx + 1, sum }))
      .sort((a, b) => a.sum - b.sum);

    const generalizedRanks = {};
    let rIdx = 0;
    while (rIdx < rankedObjects.length) {
      let rEnd = rIdx;
      while (rEnd < rankedObjects.length && rankedObjects[rEnd].sum === rankedObjects[rIdx].sum) {
        rEnd++;
      }
      // Одинаковые суммы получают среднее арифметическое занимаемых мест (связанный ранг)
      const avgRank = ((rIdx + 1) + rEnd) / 2;
      for (let k = rIdx; k < rEnd; k++) {
        generalizedRanks[rankedObjects[k].id] = avgRank;
      }
      rIdx = rEnd;
    }

    calc1ResultsContainer.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div class="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
          <div class="text-xs text-slate-500">Коэффициент конкордации (K):</div>
          <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">${K.toFixed(4)}</div>
          <div class="mt-2 text-xs font-semibold px-2 py-1 rounded inline-block ${badgeColor}">
            ${(K * 100).toFixed(1)}% согласованности
          </div>
        </div>

        <div class="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
          <div class="text-xs text-slate-500">Статистика согласия Пирсона:</div>
          <div class="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1 font-mono">$$\\chi^2 = ${chiSquare.toFixed(3)}$$</div>
          <div class="text-xs text-slate-500 mt-1">Число степеней свободы: df = ${df}</div>
        </div>

        <div class="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
          <div class="text-xs text-slate-500">Сумма квадратов отклонений (S):</div>
          <div class="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1 font-mono">S = ${sumSqDev.toFixed(2)}</div>
          <div class="text-xs text-slate-500 mt-1">Поправка на связки: $\\sum T_s = ${totalT}$</div>
        </div>
      </div>

      <div class="p-3 bg-slate-100 dark:bg-slate-700/70 rounded-lg mb-4 text-xs">
        <strong>Вердикт конкордации:</strong> ${interpretation}
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full text-xs text-center border border-slate-300 dark:border-slate-700">
          <thead class="bg-indigo-50 dark:bg-slate-700">
            <tr>
              <th class="p-2 border">Параметр</th>
              ${sumRanks.map((_, idx) => `<th class="p-2 border font-bold">x${idx + 1}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="p-2 border font-semibold bg-slate-50 dark:bg-slate-800">Сумма рангов $\\sum r_{sj}$</td>
              ${sumRanks.map(s => `<td class="p-2 border font-mono font-bold text-indigo-600 dark:text-indigo-400">${s}</td>`).join('')}
            </tr>
            <tr>
              <td class="p-2 border font-semibold bg-slate-50 dark:bg-slate-800">Отклонение от среднего $\\Delta_j$</td>
              ${deviations.map(d => `<td class="p-2 border font-mono">${d.toFixed(2)}</td>`).join('')}
            </tr>
            <tr class="bg-emerald-50 dark:bg-emerald-950/40">
              <td class="p-2 border font-bold text-emerald-800 dark:text-emerald-300">Итоговый ранг объекта</td>
              ${sumRanks.map((_, idx) => `<td class="p-2 border font-mono font-black text-emerald-700 dark:text-emerald-300 text-sm">${generalizedRanks[idx + 1]}</td>`).join('')}
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 p-3 bg-white dark:bg-slate-900 border rounded-lg text-xs font-mono">
        <strong>Итоговая обобщенная ранжировка (лучший &rarr; худший):</strong><br>
        ${rankedObjects.map((item, i) => `<strong>${i + 1} место:</strong> объект x${item.id} (ранг ${generalizedRanks[item.id]}, сумма = ${item.sum})`).join(' &nbsp;|&nbsp; ')}
      </div>
    `;

    renderMath();
  }

  if (calc1ComputeBtn) calc1ComputeBtn.addEventListener('click', computeConcordance);
  if (calc1ExpertsInput) calc1ExpertsInput.addEventListener('change', () => buildCalc1Grid(parseInt(calc1ExpertsInput.value, 10), parseInt(calc1ObjectsInput.value, 10)));
  if (calc1ObjectsInput) calc1ObjectsInput.addEventListener('change', () => buildCalc1Grid(parseInt(calc1ExpertsInput.value, 10), parseInt(calc1ObjectsInput.value, 10)));
  if (calc1LoadExampleBtn) {
    calc1LoadExampleBtn.addEventListener('click', () => {
      calc1ExpertsInput.value = 3;
      calc1ObjectsInput.value = 7;
      buildCalc1Grid(3, 7, calc1Matrix);
      computeConcordance();
    });
  }

  // Calculator 2: Pairwise Comparisons
  const calc2NInput = document.getElementById('calc2-size');
  const calc2GridContainer = document.getElementById('calc2-matrix-container');
  const calc2ResultsContainer = document.getElementById('calc2-results');

  function buildCalc2Matrix(n) {
    if (!calc2GridContainer) return;
    let html = `<table class="min-w-full text-xs text-center border border-slate-300 dark:border-slate-700">`;
    html += `<thead class="bg-slate-100 dark:bg-slate-700"><tr><th class="p-2 border">Объект</th>`;
    for (let j = 1; j <= n; j++) html += `<th class="p-2 border font-bold">x${j}</th>`;
    html += `</tr></thead><tbody>`;

    for (let i = 1; i <= n; i++) {
      html += `<tr><td class="p-2 border font-semibold bg-slate-50 dark:bg-slate-800">x${i}</td>`;
      for (let j = 1; j <= n; j++) {
        if (i === j) {
          html += `<td class="p-1 border bg-slate-200 dark:bg-slate-700 font-bold text-slate-500">1</td>`;
        } else if (i < j) {
          html += `<td class="p-1 border"><input type="number" step="any" min="0.1" max="9" class="calc2-cell w-16 text-center border rounded p-1 dark:bg-slate-900 dark:border-slate-700 font-mono" data-row="${i - 1}" data-col="${j - 1}" value="1"></td>`;
        } else {
          html += `<td class="p-1 border bg-slate-50 dark:bg-slate-800/50"><span class="calc2-inv-cell font-mono text-slate-500 text-[11px]" data-row="${i - 1}" data-col="${j - 1}">1.000</span></td>`;
        }
      }
      html += `</tr>`;
    }
    html += `</tbody></table>`;
    calc2GridContainer.innerHTML = html;

    document.querySelectorAll('.calc2-cell').forEach(inp => {
      inp.addEventListener('input', () => {
        const r = parseInt(inp.dataset.row, 10);
        const c = parseInt(inp.dataset.col, 10);
        const val = parseFloat(inp.value) || 1;
        const invCell = document.querySelector(`.calc2-inv-cell[data-row="${c}"][data-col="${r}"]`);
        if (invCell) {
          invCell.innerText = val !== 0 ? (1 / val).toFixed(3) : '∞';
        }
        computePairwise();
      });
    });
  }

  function computePairwise() {
    if (!calc2NInput || !calc2ResultsContainer) return;
    const n = parseInt(calc2NInput.value, 10);
    const A = [];
    for (let i = 0; i < n; i++) {
      A[i] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          A[i][j] = 1;
        } else if (i < j) {
          const inp = document.querySelector(`.calc2-cell[data-row="${i}"][data-col="${j}"]`);
          A[i][j] = parseFloat(inp ? inp.value : 1) || 1;
        } else {
          A[i][j] = 1 / A[j][i];
        }
      }
    }

    // Geometric mean method
    const geomMeans = [];
    for (let i = 0; i < n; i++) {
      let prod = 1;
      for (let j = 0; j < n; j++) prod *= A[i][j];
      geomMeans[i] = Math.pow(prod, 1 / n);
    }
    const sumGeom = geomMeans.reduce((a, b) => a + b, 0);
    const weights = geomMeans.map(g => g / sumGeom);

    // Lambda max and Consistency Index (CI, CR)
    let lambdaMax = 0;
    for (let j = 0; j < n; j++) {
      let colSum = 0;
      for (let i = 0; i < n; i++) colSum += A[i][j];
      lambdaMax += colSum * weights[j];
    }
    const CI = n > 1 ? (lambdaMax - n) / (n - 1) : 0;
    const RI_TABLE = [0, 0, 0.58, 0.90, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49];
    const RI = RI_TABLE[n - 1] || 1.49;
    const CR = RI > 0 ? CI / RI : 0;

    let crBadge = '';
    let crDesc = '';
    if (CR <= 0.10) {
      crBadge = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
      crDesc = 'Матрица полностью согласована (CR <= 0.10). Результаты пригодны для принятия решений.';
    } else if (CR <= 0.20) {
      crBadge = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
      crDesc = 'Допустимая несогласованность (0.10 < CR <= 0.20). Рекомендуется выборочно пересмотреть экспертные суждения.';
    } else {
      crBadge = 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300';
      crDesc = 'Существенная несогласованность (CR > 0.20)! Имеются грубые нарушения транзитивности. Требуется пересмотр матрицы.';
    }

    calc2ResultsContainer.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div class="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
          <div class="text-xs text-slate-500">Отношение согласованности (CR):</div>
          <div class="text-2xl font-black mt-1 font-mono">${(CR * 100).toFixed(2)}%</div>
          <div class="mt-2 text-xs font-semibold px-2 py-1 rounded inline-block ${crBadge}">
            CR = ${CR.toFixed(4)}
          </div>
        </div>
        <div class="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
          <div class="text-xs text-slate-500">Индекс согласованности (CI):</div>
          <div class="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1 font-mono">CI = ${CI.toFixed(4)}</div>
          <div class="text-xs text-slate-500 mt-1">Случайный индекс RI = ${RI}</div>
        </div>
        <div class="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
          <div class="text-xs text-slate-500">Собственное число $\\lambda_{\\max}$:</div>
          <div class="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1 font-mono">$$\\lambda_{\\max} = ${lambdaMax.toFixed(3)}$$</div>
          <div class="text-xs text-slate-500 mt-1">Размерность n = ${n}</div>
        </div>
      </div>

      <div class="p-3 bg-slate-100 dark:bg-slate-700/70 rounded-lg mb-4 text-xs">
        <strong>Оценка транзитивности:</strong> ${crDesc}
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full text-xs text-center border border-slate-300 dark:border-slate-700">
          <thead class="bg-indigo-50 dark:bg-slate-700">
            <tr>
              <th class="p-2 border">Объект</th>
              <th class="p-2 border">Геометрическое среднее</th>
              <th class="p-2 border">Нормированный вес ($w_i$)</th>
              <th class="p-2 border">Процент значимости</th>
              <th class="p-2 border">Итоговый ранг</th>
            </tr>
          </thead>
          <tbody>
            ${weights.map((w, idx) => {
              const rank = weights.filter(x => x > w).length + 1;
              return `
                <tr>
                  <td class="p-2 border font-bold bg-slate-50 dark:bg-slate-800">x${idx + 1}</td>
                  <td class="p-2 border font-mono">${geomMeans[idx].toFixed(4)}</td>
                  <td class="p-2 border font-mono font-bold text-indigo-600 dark:text-indigo-400">${w.toFixed(4)}</td>
                  <td class="p-2 border font-mono font-bold">${(w * 100).toFixed(2)}%</td>
                  <td class="p-2 border font-mono font-black text-emerald-600 dark:text-emerald-400">${rank}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    renderMath();
  }

  if (calc2NInput) {
    calc2NInput.addEventListener('change', () => {
      buildCalc2Matrix(parseInt(calc2NInput.value, 10));
      computePairwise();
    });
  }

  // Calculator 3: Direct Estimation
  const calc3ComputeBtn = document.getElementById('calc3-compute-btn');
  const calc3ResultsContainer = document.getElementById('calc3-results');

  function computeDirectRating() {
    if (!calc3ResultsContainer) return;
    const weightsInputs = document.querySelectorAll('.calc3-kw');
    const expertWeightsRaw = Array.from(weightsInputs).map(inp => parseFloat(inp.value) || 0);
    const sumW = expertWeightsRaw.reduce((a, b) => a + b, 0);
    const expertWeights = expertWeightsRaw.map(w => (sumW > 0 ? w / sumW : 1 / expertWeightsRaw.length));

    const ratings = [
      [80, 70, 90, 60],
      [85, 75, 80, 65],
      [90, 65, 85, 70]
    ];

    const numObj = 4;
    const numExp = 3;
    const aggScores = [];
    const means = [];
    const stdDevs = [];
    const varCoeffs = [];

    for (let j = 0; j < numObj; j++) {
      let agg = 0;
      let rawSum = 0;
      const vals = [];
      for (let i = 0; i < numExp; i++) {
        agg += expertWeights[i] * ratings[i][j];
        rawSum += ratings[i][j];
        vals.push(ratings[i][j]);
      }
      aggScores.push(agg);
      const mean = rawSum / numExp;
      means.push(mean);

      const variance = vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (numExp - 1);
      const s = Math.sqrt(variance);
      stdDevs.push(s);
      varCoeffs.push(mean > 0 ? s / mean : 0);
    }

    calc3ResultsContainer.innerHTML = `
      <div class="overflow-x-auto">
        <table class="min-w-full text-xs text-center border border-slate-300 dark:border-slate-700">
          <thead class="bg-indigo-50 dark:bg-slate-700">
            <tr>
              <th class="p-2 border">Параметр</th>
              ${aggScores.map((_, idx) => `<th class="p-2 border font-bold">Объект x${idx + 1}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr class="bg-emerald-50 dark:bg-emerald-950/40 font-bold">
              <td class="p-2 border text-left">Агрегированная оценка $\\bar{c}_j = \\sum k_s c_{sj}$</td>
              ${aggScores.map(score => `<td class="p-2 border font-mono text-emerald-700 dark:text-emerald-300 text-sm font-black">${score.toFixed(2)}</td>`).join('')}
            </tr>
            <tr>
              <td class="p-2 border text-left">Среднее значение $\\bar{c}_j$</td>
              ${means.map(m => `<td class="p-2 border font-mono">${m.toFixed(2)}</td>`).join('')}
            </tr>
            <tr>
              <td class="p-2 border text-left">Стандартное отклонение $S_j$</td>
              ${stdDevs.map(s => `<td class="p-2 border font-mono">${s.toFixed(2)}</td>`).join('')}
            </tr>
            <tr>
              <td class="p-2 border text-left">Коэффициент вариации $V_j = S_j / \\bar{c}_j$</td>
              ${varCoeffs.map(v => {
                const isGood = v <= 0.33;
                return `<td class="p-2 border font-mono font-bold ${isGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">${(v * 100).toFixed(1)}% ${isGood ? '✓' : '⚠️'}</td>`;
              }).join('')}
            </tr>
          </tbody>
        </table>
      </div>
    `;

    renderMath();
  }

  if (calc3ComputeBtn) calc3ComputeBtn.addEventListener('click', computeDirectRating);
  const calc3NormBtn = document.getElementById('calc3-norm-weights-btn');
  if (calc3NormBtn) {
    calc3NormBtn.addEventListener('click', () => {
      const inputs = document.querySelectorAll('.calc3-kw');
      const vals = Array.from(inputs).map(inp => parseFloat(inp.value) || 0);
      const sum = vals.reduce((a, b) => a + b, 0);
      if (sum > 0) {
        inputs.forEach((inp, idx) => {
          inp.value = (vals[idx] / sum).toFixed(2);
        });
      }
      computeDirectRating();
    });
  }

  // Calculator 4: Churchman-Ackoff
  let caObjects = [
    { name: 'Система безопасности (x1)', raw: 1.0, norm: 0 },
    { name: 'Интерфейс пользователя (x2)', raw: 0.8, norm: 0 },
    { name: 'Скорость обработки (x3)', raw: 0.5, norm: 0 },
    { name: 'Масштабируемость (x4)', raw: 0.3, norm: 0 }
  ];

  function renderChurchmanAckoff() {
    const container = document.getElementById('ca-table-display');
    if (!container) return;

    const sumRaw = caObjects.reduce((acc, o) => acc + o.raw, 0);
    caObjects.forEach(o => { o.norm = sumRaw > 0 ? o.raw / sumRaw : 0; });

    container.innerHTML = `
      <div class="space-y-3">
        ${caObjects.map((obj, idx) => `
          <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <span class="text-xs font-semibold">${obj.name}</span>
            <div class="flex items-center gap-2">
              <input type="number" step="0.05" min="0.01" class="ca-input w-20 text-center border rounded p-1 text-xs dark:bg-slate-900 font-mono" data-index="${idx}" value="${obj.raw}">
              <span class="text-xs font-mono font-bold text-indigo-600 w-16 text-right">${(obj.norm * 100).toFixed(1)}%</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    document.querySelectorAll('.ca-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        caObjects[idx].raw = parseFloat(e.target.value) || 0.01;
        renderChurchmanAckoff();
      });
    });
  }

  // -------------------------------------------------------------
  // PR-4 CALCULATOR 1: Membership Functions Designer
  // -------------------------------------------------------------
  const pr4MfState = {
    type: 'tri',
    params: {
      tri: { a: 20, b: 50, c: 80 },
      trap: { a: 15, b: 35, c: 65, d: 85 },
      gauss: { c: 50, sigma: 12 },
      sig: { c: 50, a: 0.15 }
    },
    testPoint: 45
  };

  function evalMF(type, p, x) {
    if (type === 'tri') {
      const { a, b, c } = p;
      if (x <= a || x >= c) return 0;
      if (x === b) return 1;
      if (x > a && x < b) return b > a ? (x - a) / (b - a) : 1;
      if (x > b && x < c) return c > b ? (c - x) / (c - b) : 1;
      return 0;
    } else if (type === 'trap') {
      const { a, b, c, d } = p;
      if (x <= a || x >= d) return 0;
      if (x >= b && x <= c) return 1;
      if (x > a && x < b) return b > a ? (x - a) / (b - a) : 1;
      if (x > c && x < d) return d > c ? (d - x) / (d - c) : 1;
      return 0;
    } else if (type === 'gauss') {
      const { c, sigma } = p;
      const s = Math.max(0.1, sigma);
      return Math.exp(-Math.pow(x - c, 2) / (2 * Math.pow(s, 2)));
    } else if (type === 'sig') {
      const { c, a } = p;
      return 1 / (1 + Math.exp(-a * (x - c)));
    }
    return 0;
  }

  function renderMfSliders() {
    const container = document.getElementById('mf-sliders-container');
    if (!container) return;
    const t = pr4MfState.type;
    const p = pr4MfState.params[t];

    let html = '';
    if (t === 'tri') {
      html = `
        <div>
          <div class="flex justify-between text-xs font-semibold mb-1">
            <span>Параметр a (левый 0):</span>
            <span class="font-mono text-indigo-600 dark:text-indigo-400 font-bold">${p.a}</span>
          </div>
          <input type="range" id="mf-param-a" min="0" max="100" value="${p.a}" class="w-full accent-indigo-600">
        </div>
        <div>
          <div class="flex justify-between text-xs font-semibold mb-1">
            <span>Параметр b (вершина $\\mu=1$):</span>
            <span class="font-mono text-indigo-600 dark:text-indigo-400 font-bold">${p.b}</span>
          </div>
          <input type="range" id="mf-param-b" min="0" max="100" value="${p.b}" class="w-full accent-indigo-600">
        </div>
        <div>
          <div class="flex justify-between text-xs font-semibold mb-1">
            <span>Параметр c (правый 0):</span>
            <span class="font-mono text-indigo-600 dark:text-indigo-400 font-bold">${p.c}</span>
          </div>
          <input type="range" id="mf-param-c" min="0" max="100" value="${p.c}" class="w-full accent-indigo-600">
        </div>
        <div class="flex items-center text-xs text-slate-500">
          Условие: $a \\le b \\le c$. Ядро: точка $b$.
        </div>
      `;
    } else if (t === 'trap') {
      html = `
        <div>
          <div class="flex justify-between text-xs font-semibold mb-1">
            <span>a (начало):</span>
            <span class="font-mono text-indigo-600 dark:text-indigo-400 font-bold">${p.a}</span>
          </div>
          <input type="range" id="mf-param-a" min="0" max="100" value="${p.a}" class="w-full accent-indigo-600">
        </div>
        <div>
          <div class="flex justify-between text-xs font-semibold mb-1">
            <span>b (старт ядра $\\mu=1$):</span>
            <span class="font-mono text-indigo-600 dark:text-indigo-400 font-bold">${p.b}</span>
          </div>
          <input type="range" id="mf-param-b" min="0" max="100" value="${p.b}" class="w-full accent-indigo-600">
        </div>
        <div>
          <div class="flex justify-between text-xs font-semibold mb-1">
            <span>c (конец ядра $\\mu=1$):</span>
            <span class="font-mono text-indigo-600 dark:text-indigo-400 font-bold">${p.c}</span>
          </div>
          <input type="range" id="mf-param-c" min="0" max="100" value="${p.c}" class="w-full accent-indigo-600">
        </div>
        <div>
          <div class="flex justify-between text-xs font-semibold mb-1">
            <span>d (конец спада):</span>
            <span class="font-mono text-indigo-600 dark:text-indigo-400 font-bold">${p.d}</span>
          </div>
          <input type="range" id="mf-param-d" min="0" max="100" value="${p.d}" class="w-full accent-indigo-600">
        </div>
      `;
    } else if (t === 'gauss') {
      html = `
        <div>
          <div class="flex justify-between text-xs font-semibold mb-1">
            <span>Центр c (максимум):</span>
            <span class="font-mono text-indigo-600 dark:text-indigo-400 font-bold">${p.c}</span>
          </div>
          <input type="range" id="mf-param-c" min="0" max="100" value="${p.c}" class="w-full accent-indigo-600">
        </div>
        <div>
          <div class="flex justify-between text-xs font-semibold mb-1">
            <span>Ширина $\\sigma$ (разброс):</span>
            <span class="font-mono text-indigo-600 dark:text-indigo-400 font-bold">${p.sigma}</span>
          </div>
          <input type="range" id="mf-param-sigma" min="2" max="30" value="${p.sigma}" class="w-full accent-indigo-600">
        </div>
        <div class="col-span-1 sm:col-span-2 flex items-center text-xs text-slate-500">
          Бесконечно гладкая Гауссова функция. Всюду дифференцируема.
        </div>
      `;
    } else if (t === 'sig') {
      html = `
        <div>
          <div class="flex justify-between text-xs font-semibold mb-1">
            <span>Точка перегиба c ($\\mu=0.5$):</span>
            <span class="font-mono text-indigo-600 dark:text-indigo-400 font-bold">${p.c}</span>
          </div>
          <input type="range" id="mf-param-c" min="0" max="100" value="${p.c}" class="w-full accent-indigo-600">
        </div>
        <div>
          <div class="flex justify-between text-xs font-semibold mb-1">
            <span>Крутизна a:</span>
            <span class="font-mono text-indigo-600 dark:text-indigo-400 font-bold">${p.a}</span>
          </div>
          <input type="range" id="mf-param-a-sig" min="0.02" max="0.5" step="0.01" value="${p.a}" class="w-full accent-indigo-600">
        </div>
        <div class="col-span-1 sm:col-span-2 flex items-center text-xs text-slate-500">
          S-образная сигмоида для открытых качественных понятий («высокий», «горячий»).
        </div>
      `;
    }

    container.innerHTML = html;
    renderMath();

    // Attach slider listeners
    ['a', 'b', 'c', 'd', 'sigma', 'a-sig'].forEach(paramKey => {
      const input = document.getElementById(`mf-param-${paramKey}`);
      if (input) {
        input.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          if (paramKey === 'a-sig') {
            pr4MfState.params.sig.a = val;
          } else {
            pr4MfState.params[pr4MfState.type][paramKey] = val;
          }
          renderMfSliders();
          drawMfGraph();
        });
      }
    });
  }

  function drawMfGraph() {
    const svg = document.getElementById('mf-svg-canvas');
    if (!svg) return;
    const t = pr4MfState.type;
    const p = pr4MfState.params[t];
    const xTest = pr4MfState.testPoint;

    const leftMargin = 45;
    const rightMargin = 580;
    const topMargin = 25;
    const bottomMargin = 205;
    const graphWidth = rightMargin - leftMargin;
    const graphHeight = bottomMargin - topMargin;

    function toSvgX(x) { return leftMargin + (x / 100) * graphWidth; }
    function toSvgY(mu) { return bottomMargin - mu * graphHeight; }

    const numSamples = 200;
    const points = [];
    for (let i = 0; i <= numSamples; i++) {
      const x = (i / numSamples) * 100;
      const mu = evalMF(t, p, x);
      points.push({ x, mu, sx: toSvgX(x), sy: toSvgY(mu) });
    }

    let pathD = `M ${points[0].sx} ${points[0].sy}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].sx} ${points[i].sy}`;
    }
    const areaD = pathD + ` L ${toSvgX(100)} ${bottomMargin} L ${toSvgX(0)} ${bottomMargin} Z`;

    const muTest = evalMF(t, p, xTest);
    const testSx = toSvgX(xTest);
    const testSy = toSvgY(muTest);

    svg.innerHTML = `
      <defs>
        <linearGradient id="mfGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#818cf8" stop-opacity="0.6"/>
          <stop offset="100%" stop-color="#818cf8" stop-opacity="0.05"/>
        </linearGradient>
      </defs>

      <!-- Background Grid -->
      <line x1="${leftMargin}" y1="${toSvgY(1.0)}" x2="${rightMargin}" y2="${toSvgY(1.0)}" stroke="#334155" stroke-dasharray="3,3" />
      <text x="${leftMargin - 8}" y="${toSvgY(1.0) + 3}" fill="#94a3b8" text-anchor="end">1.0</text>

      <line x1="${leftMargin}" y1="${toSvgY(0.75)}" x2="${rightMargin}" y2="${toSvgY(0.75)}" stroke="#1e293b" stroke-dasharray="2,2" />
      <text x="${leftMargin - 8}" y="${toSvgY(0.75) + 3}" fill="#64748b" text-anchor="end">0.75</text>

      <line x1="${leftMargin}" y1="${toSvgY(0.5)}" x2="${rightMargin}" y2="${toSvgY(0.5)}" stroke="#334155" stroke-dasharray="3,3" />
      <text x="${leftMargin - 8}" y="${toSvgY(0.5) + 3}" fill="#94a3b8" text-anchor="end">0.5</text>

      <line x1="${leftMargin}" y1="${toSvgY(0.25)}" x2="${rightMargin}" y2="${toSvgY(0.25)}" stroke="#1e293b" stroke-dasharray="2,2" />
      <text x="${leftMargin - 8}" y="${toSvgY(0.25) + 3}" fill="#64748b" text-anchor="end">0.25</text>

      <!-- Axes -->
      <line x1="${leftMargin}" y1="${bottomMargin}" x2="${rightMargin}" y2="${bottomMargin}" stroke="#64748b" stroke-width="1.5" />
      <line x1="${leftMargin}" y1="${topMargin}" x2="${leftMargin}" y2="${bottomMargin}" stroke="#64748b" stroke-width="1.5" />
      <text x="${leftMargin - 8}" y="${bottomMargin + 3}" fill="#94a3b8" text-anchor="end">0.0</text>

      <!-- X-axis ticks -->
      ${[0, 20, 40, 60, 80, 100].map(tx => `
        <line x1="${toSvgX(tx)}" y1="${bottomMargin}" x2="${toSvgX(tx)}" y2="${bottomMargin + 4}" stroke="#64748b" />
        <text x="${toSvgX(tx)}" y="${bottomMargin + 15}" fill="#94a3b8" text-anchor="middle">${tx}</text>
      `).join('')}

      <!-- Filled Area -->
      <path d="${areaD}" fill="url(#mfGrad)" />

      <!-- Curve Line -->
      <path d="${pathD}" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Test point guideline and circle -->
      <line x1="${testSx}" y1="${bottomMargin}" x2="${testSx}" y2="${testSy}" stroke="#ec4899" stroke-width="1.5" stroke-dasharray="4,3" />
      <circle cx="${testSx}" cy="${testSy}" r="5" fill="#f43f5e" stroke="#ffffff" stroke-width="2" />
      <text x="${testSx}" y="${Math.max(topMargin + 10, testSy - 10)}" fill="#f43f5e" font-weight="bold" text-anchor="middle">x=${xTest}, μ=${muTest.toFixed(3)}</text>
    `;

    // Badges update
    const testValLabel = document.getElementById('mf-test-val-label');
    const resultBadge = document.getElementById('mf-result-badge');
    const zoneTag = document.getElementById('mf-zone-tag');

    if (testValLabel) testValLabel.innerText = xTest;
    if (resultBadge) resultBadge.innerText = `μ_A(${xTest}) = ${muTest.toFixed(3)}`;

    if (zoneTag) {
      if (muTest >= 0.999) {
        zoneTag.innerText = 'Ядро множества (Core)';
        zoneTag.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700';
      } else if (muTest <= 0.001) {
        zoneTag.innerText = 'Вне носителя (μ = 0)';
        zoneTag.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700';
      } else {
        zoneTag.innerText = 'Зона перехода (0 < μ < 1)';
        zoneTag.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700';
      }
    }
  }

  // Type Selector Pills
  document.querySelectorAll('.mf-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      pr4MfState.type = btn.dataset.mfType;
      document.querySelectorAll('.mf-type-btn').forEach(b => {
        b.classList.remove('border-indigo-600', 'bg-indigo-50', 'dark:bg-indigo-950/50', 'text-indigo-700', 'dark:text-indigo-300', 'font-bold', 'shadow-sm');
        b.classList.add('border-slate-200', 'dark:border-slate-700', 'text-slate-600', 'dark:text-slate-300', 'font-semibold');
      });
      btn.classList.add('border-indigo-600', 'bg-indigo-50', 'dark:bg-indigo-950/50', 'text-indigo-700', 'dark:text-indigo-300', 'font-bold', 'shadow-sm');
      btn.classList.remove('border-slate-200', 'dark:border-slate-700', 'text-slate-600', 'dark:text-slate-300', 'font-semibold');
      renderMfSliders();
      drawMfGraph();
    });
  });

  const mfTestSlider = document.getElementById('mf-test-slider');
  if (mfTestSlider) {
    mfTestSlider.addEventListener('input', (e) => {
      pr4MfState.testPoint = parseFloat(e.target.value);
      drawMfGraph();
    });
  }

  const mfPresetResetBtn = document.getElementById('pr4-mf-preset-reset');
  if (mfPresetResetBtn) {
    mfPresetResetBtn.addEventListener('click', () => {
      pr4MfState.params = {
        tri: { a: 20, b: 50, c: 80 },
        trap: { a: 15, b: 35, c: 65, d: 85 },
        gauss: { c: 50, sigma: 12 },
        sig: { c: 50, a: 0.15 }
      };
      pr4MfState.testPoint = 45;
      if (mfTestSlider) mfTestSlider.value = 45;
      renderMfSliders();
      drawMfGraph();
    });
  }

  // -------------------------------------------------------------
  // PR-4 CALCULATOR 2: Mamdani Fuzzy Inference Simulator
  // -------------------------------------------------------------
  const mamdaniState = {
    temp: 27.0,
    hum: 65
  };

  function muTCold(t) { return evalMF('trap', { a: 15, b: 15, c: 18, d: 22 }, t); }
  function muTNorm(t) { return evalMF('tri', { a: 19, b: 23.5, c: 27 }, t); }
  function muTHot(t)  { return evalMF('trap', { a: 24, b: 28, c: 35, d: 35 }, t); }

  function muHDry(h) { return evalMF('trap', { a: 20, b: 20, c: 35, d: 50 }, h); }
  function muHWet(h) { return evalMF('trap', { a: 40, b: 55, c: 80, d: 80 }, h); }

  function muPLow(p)  { return evalMF('trap', { a: 0, b: 0, c: 20, d: 40 }, p); }
  function muPMed(p)  { return evalMF('tri', { a: 25, b: 50, c: 75 }, p); }
  function muPHigh(p) { return evalMF('trap', { a: 60, b: 80, c: 100, d: 100 }, p); }

  function computeMamdani() {
    const T = mamdaniState.temp;
    const H = mamdaniState.hum;

    // Step 1: Fuzzification
    const fTCold = muTCold(T);
    const fTNorm = muTNorm(T);
    const fTHot  = muTHot(T);

    const fHDry = muHDry(H);
    const fHWet = muHWet(H);

    // Step 2: Aggregation
    const alpha1 = Math.min(fTHot, fHWet);
    const alpha2 = Math.min(fTNorm, fHWet);
    const alpha3 = fTCold;

    // Render Step 1 UI
    const fuzzOutput = document.getElementById('mamdani-fuzz-output');
    if (fuzzOutput) {
      fuzzOutput.innerHTML = `
        <div class="space-y-1">
          <div class="font-semibold text-slate-700 dark:text-slate-300">Температура T = ${T.toFixed(1)}°C:</div>
          <div class="flex items-center gap-2">
            <span class="w-16">Холодно:</span>
            <div class="flex-1 bg-slate-100 dark:bg-slate-700 rounded h-2 overflow-hidden"><div class="bg-blue-500 h-2" style="width:${fTCold*100}%"></div></div>
            <span class="w-10 font-mono text-right font-bold">${fTCold.toFixed(2)}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-16">Комфорт:</span>
            <div class="flex-1 bg-slate-100 dark:bg-slate-700 rounded h-2 overflow-hidden"><div class="bg-emerald-500 h-2" style="width:${fTNorm*100}%"></div></div>
            <span class="w-10 font-mono text-right font-bold">${fTNorm.toFixed(2)}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-16">Жарко:</span>
            <div class="flex-1 bg-slate-100 dark:bg-slate-700 rounded h-2 overflow-hidden"><div class="bg-rose-500 h-2" style="width:${fTHot*100}%"></div></div>
            <span class="w-10 font-mono text-right font-bold">${fTHot.toFixed(2)}</span>
          </div>
        </div>
        <div class="space-y-1 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
          <div class="font-semibold text-slate-700 dark:text-slate-300">Влажность H = ${H}%:</div>
          <div class="flex items-center gap-2">
            <span class="w-16">Сухо:</span>
            <div class="flex-1 bg-slate-100 dark:bg-slate-700 rounded h-2 overflow-hidden"><div class="bg-amber-500 h-2" style="width:${fHDry*100}%"></div></div>
            <span class="w-10 font-mono text-right font-bold">${fHDry.toFixed(2)}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-16">Влажно:</span>
            <div class="flex-1 bg-slate-100 dark:bg-slate-700 rounded h-2 overflow-hidden"><div class="bg-cyan-500 h-2" style="width:${fHWet*100}%"></div></div>
            <span class="w-10 font-mono text-right font-bold">${fHWet.toFixed(2)}</span>
          </div>
        </div>
      `;
    }

    // Render Step 2 UI
    const rulesOutput = document.getElementById('mamdani-rules-output');
    if (rulesOutput) {
      rulesOutput.innerHTML = `
        <div class="p-2 rounded border ${alpha1 > 0 ? 'bg-amber-50/60 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 font-semibold' : 'border-slate-200 dark:border-slate-700 opacity-60'}">
          <div class="flex justify-between items-center">
            <span><strong>П1:</strong> ЕСЛИ Жарко И Влажно &rarr; Высокая</span>
            <span class="font-mono font-bold text-amber-700 dark:text-amber-400">&alpha;₁ = min(${fTHot.toFixed(2)}, ${fHWet.toFixed(2)}) = ${alpha1.toFixed(2)}</span>
          </div>
        </div>
        <div class="p-2 rounded border ${alpha2 > 0 ? 'bg-amber-50/60 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 font-semibold' : 'border-slate-200 dark:border-slate-700 opacity-60'}">
          <div class="flex justify-between items-center">
            <span><strong>П2:</strong> ЕСЛИ Комфорт И Влажно &rarr; Средняя</span>
            <span class="font-mono font-bold text-amber-700 dark:text-amber-400">&alpha;₂ = min(${fTNorm.toFixed(2)}, ${fHWet.toFixed(2)}) = ${alpha2.toFixed(2)}</span>
          </div>
        </div>
        <div class="p-2 rounded border ${alpha3 > 0 ? 'bg-amber-50/60 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 font-semibold' : 'border-slate-200 dark:border-slate-700 opacity-60'}">
          <div class="flex justify-between items-center">
            <span><strong>П3:</strong> ЕСЛИ Холодно &rarr; Низкая</span>
            <span class="font-mono font-bold text-amber-700 dark:text-amber-400">&alpha;₃ = ${alpha3.toFixed(2)}</span>
          </div>
        </div>
      `;
    }

    // Step 3 & 4: Accumulation across P in [0, 100]
    let sumNum = 0;
    let sumDen = 0;
    const accumPoints = [];

    for (let p = 0; p <= 100; p++) {
      const act1 = Math.min(alpha1, muPHigh(p));
      const act2 = Math.min(alpha2, muPMed(p));
      const act3 = Math.min(alpha3, muPLow(p));
      const muSigma = Math.max(act1, act2, act3);

      sumNum += p * muSigma;
      sumDen += muSigma;
      accumPoints.push({ p, mu: muSigma });
    }

    // Step 5: Defuzzification (Centroid)
    const finalPower = sumDen > 0 ? sumNum / sumDen : 50;

    // Render Accumulation SVG
    const accumSvg = document.getElementById('mamdani-accum-svg');
    if (accumSvg) {
      const leftM = 40;
      const rightM = 580;
      const topM = 20;
      const bottomM = 150;
      const w = rightM - leftM;
      const h = bottomM - topM;

      function toX(p) { return leftM + (p / 100) * w; }
      function toY(mu) { return bottomM - mu * h; }

      let pathD = `M ${toX(0)} ${toY(accumPoints[0].mu)}`;
      for (let i = 1; i <= 100; i++) {
        pathD += ` L ${toX(i)} ${toY(accumPoints[i].mu)}`;
      }
      const areaD = pathD + ` L ${toX(100)} ${bottomM} L ${toX(0)} ${bottomM} Z`;

      const defuzzX = toX(finalPower);

      accumSvg.innerHTML = `
        <defs>
          <linearGradient id="mamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.6"/>
            <stop offset="100%" stop-color="#10b981" stop-opacity="0.05"/>
          </linearGradient>
        </defs>

        <!-- Baseline and Ticks -->
        <line x1="${leftM}" y1="${bottomM}" x2="${rightM}" y2="${bottomM}" stroke="#64748b" stroke-width="1.5"/>
        <line x1="${leftM}" y1="${toY(1.0)}" x2="${rightM}" y2="${toY(1.0)}" stroke="#334155" stroke-dasharray="2,2"/>
        <text x="${leftM - 6}" y="${toY(1.0) + 3}" fill="#94a3b8" text-anchor="end">1.0</text>
        <text x="${leftM - 6}" y="${bottomM + 3}" fill="#94a3b8" text-anchor="end">0.0</text>

        ${[0, 20, 40, 60, 80, 100].map(tp => `
          <line x1="${toX(tp)}" y1="${bottomM}" x2="${toX(tp)}" y2="${bottomM + 4}" stroke="#64748b"/>
          <text x="${toX(tp)}" y="${bottomM + 14}" fill="#94a3b8" text-anchor="middle">${tp}%</text>
        `).join('')}

        <!-- Labels for Output Sets -->
        <text x="${toX(15)}" y="${topM + 12}" fill="#60a5fa" text-anchor="middle" font-size="9">Низкая</text>
        <text x="${toX(50)}" y="${topM + 12}" fill="#34d399" text-anchor="middle" font-size="9">Средняя</text>
        <text x="${toX(85)}" y="${topM + 12}" fill="#f87171" text-anchor="middle" font-size="9">Высокая</text>

        <!-- Accumulated Area -->
        <path d="${areaD}" fill="url(#mamGrad)"/>
        <path d="${pathD}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linejoin="round"/>

        <!-- Centroid Red Line -->
        <line x1="${defuzzX}" y1="${topM}" x2="${defuzzX}" y2="${bottomM}" stroke="#ef4444" stroke-width="2" stroke-dasharray="4,3"/>
        <circle cx="${defuzzX}" cy="${toY(0.1)}" r="4" fill="#ef4444"/>
        <text x="${defuzzX}" y="${topM - 5}" fill="#ef4444" font-weight="bold" text-anchor="middle">Центр тяжести: P* = ${finalPower.toFixed(1)}%</text>
      `;
    }

    // Step 5 Outputs
    const finalValEl = document.getElementById('mamdani-final-val');
    const verdictEl = document.getElementById('mamdani-verdict-text');
    const formulaEl = document.getElementById('mamdani-formula-calc');

    if (finalValEl) finalValEl.innerText = `${finalPower.toFixed(1)} %`;
    if (formulaEl) {
      formulaEl.innerHTML = `$$P^* = \\frac{\\sum P_i \\cdot \\mu(P_i)}{\\sum \\mu(P_i)} = \\frac{${sumNum.toFixed(1)}}{${sumDen.toFixed(2)}} = \\mathbf{${finalPower.toFixed(1)}\\%}$$`;
      renderMath();
    }
    if (verdictEl) {
      if (finalPower > 65) {
        verdictEl.innerText = 'Режим: Интенсивное кондиционирование (высокая температура и духота, компрессор на максимуме).';
      } else if (finalPower >= 35) {
        verdictEl.innerText = 'Режим: Стандартное поддержание комфортного микроклимата (умеренная нагрузка).';
      } else {
        verdictEl.innerText = 'Режим: Энергосбережение / минимальный обдув (в помещении прохладно).';
      }
    }
  }

  const tempSlider = document.getElementById('mamdani-temp-slider');
  const tempLabel = document.getElementById('mamdani-temp-val');
  if (tempSlider) {
    tempSlider.addEventListener('input', (e) => {
      mamdaniState.temp = parseFloat(e.target.value);
      if (tempLabel) tempLabel.innerText = `${mamdaniState.temp.toFixed(1)} °C`;
      computeMamdani();
    });
  }

  const humSlider = document.getElementById('mamdani-hum-slider');
  const humLabel = document.getElementById('mamdani-hum-val');
  if (humSlider) {
    humSlider.addEventListener('input', (e) => {
      mamdaniState.hum = parseFloat(e.target.value);
      if (humLabel) humLabel.innerText = `${mamdaniState.hum} %`;
      computeMamdani();
    });
  }

  // -------------------------------------------------------------
  // FLASHCARDS ENGINE
  // -------------------------------------------------------------
  const flashcardEl = document.getElementById('flashcard');
  const flashcardInner = document.getElementById('flashcard-inner');
  const flashcardFront = document.getElementById('flashcard-front');
  const flashcardBack = document.getElementById('flashcard-back');
  const flashcardCategory = document.getElementById('flashcard-category');
  const flashcardProgressText = document.getElementById('flashcard-progress-text');
  const flashcardPrevBtn = document.getElementById('flashcard-prev');
  const flashcardNextBtn = document.getElementById('flashcard-next');
  const flashcardFlipBtn = document.getElementById('flashcard-flip-btn');
  const flashcardKnownBtn = document.getElementById('flashcard-known-btn');
  const flashcardShuffleBtn = document.getElementById('flashcard-shuffle-btn');

  function renderFlashcard() {
    if (!flashcardEl) return;
    const card = state.flashcards[state.currentCardIndex];
    if (!card) return;

    state.isCardFlipped = false;
    flashcardInner.classList.remove('flipped');

    if (flashcardCategory) flashcardCategory.innerText = state.currentPr === 'pr3' ? 'Практика 3' : 'Практика 4';
    flashcardFront.innerHTML = `<div class="text-base md:text-lg font-semibold text-slate-900 dark:text-white">${card.front}</div>`;
    flashcardBack.innerHTML = `<div class="text-sm md:text-base text-slate-800 dark:text-slate-200 leading-relaxed">${card.back}</div>`;

    const isKnown = state.knownCards.has(card.id);
    flashcardProgressText.innerText = `Карточка ${state.currentCardIndex + 1} из ${state.flashcards.length} | Изучено: ${state.knownCards.size}`;

    if (flashcardKnownBtn) {
      flashcardKnownBtn.innerHTML = isKnown ? '✓ Знаю эту тему' : 'Отметить: знаю';
      flashcardKnownBtn.className = isKnown
        ? 'px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs md:text-sm font-semibold transition'
        : 'px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs md:text-sm font-semibold hover:bg-slate-200 transition';
    }

    renderMath();
  }

  function flipCard() {
    state.isCardFlipped = !state.isCardFlipped;
    flashcardInner.classList.toggle('flipped', state.isCardFlipped);
    renderMath();
  }

  if (flashcardEl) flashcardEl.addEventListener('click', flipCard);
  if (flashcardFlipBtn) flashcardFlipBtn.addEventListener('click', (e) => { e.stopPropagation(); flipCard(); });

  if (flashcardPrevBtn) {
    flashcardPrevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.currentCardIndex > 0) {
        state.currentCardIndex--;
        renderFlashcard();
      }
    });
  }

  if (flashcardNextBtn) {
    flashcardNextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.currentCardIndex < state.flashcards.length - 1) {
        state.currentCardIndex++;
        renderFlashcard();
      }
    });
  }

  if (flashcardKnownBtn) {
    flashcardKnownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = state.flashcards[state.currentCardIndex];
      if (state.knownCards.has(card.id)) {
        state.knownCards.delete(card.id);
      } else {
        state.knownCards.add(card.id);
      }
      localStorage.setItem(`sa_known_cards_${state.currentPr}`, JSON.stringify(Array.from(state.knownCards)));
      renderFlashcard();
    });
  }

  if (flashcardShuffleBtn) {
    flashcardShuffleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.flashcards.sort(() => Math.random() - 0.5);
      state.currentCardIndex = 0;
      renderFlashcard();
    });
  }

  // -------------------------------------------------------------
  // QUIZ ENGINE
  // -------------------------------------------------------------
  const quizContainer = document.getElementById('quiz-container');

  function renderQuiz() {
    if (!quizContainer) return;
    const questions = window.APP_DATA.quiz;
    const currentQ = questions[state.quizIndex];

    if (state.quizFinished) {
      renderQuizResults();
      return;
    }

    const answered = state.quizUserAnswers[state.quizIndex] !== undefined;
    const userSelected = state.quizUserAnswers[state.quizIndex];

    quizContainer.innerHTML = `
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 md:p-6 shadow-sm">
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
          <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            Вопрос ${state.quizIndex + 1} из ${questions.length} (${state.currentPr === 'pr3' ? 'Практика 3' : 'Практика 4'})
          </span>
          <span class="text-xs font-mono text-slate-500">Счет: ${state.quizScore} баллов</span>
        </div>

        <h3 class="text-base md:text-lg font-bold text-slate-900 dark:text-white mb-4">
          ${currentQ.question}
        </h3>

        <div class="space-y-2.5 mb-6">
          ${currentQ.options.map((opt, optIdx) => {
            let btnClass = 'w-full text-left p-3.5 rounded-lg border text-sm transition ';
            if (!answered) {
              btnClass += 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200';
            } else {
              if (optIdx === currentQ.correct) {
                btnClass += 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 font-bold';
              } else if (optIdx === userSelected) {
                btnClass += 'border-rose-500 bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200 line-through';
              } else {
                btnClass += 'border-slate-200 dark:border-slate-700 opacity-50 text-slate-400';
              }
            }

            return `
              <button data-opt-idx="${optIdx}" ${answered ? 'disabled' : ''} class="quiz-opt-btn ${btnClass}">
                <div class="flex items-start gap-3">
                  <span class="inline-flex items-center justify-center w-5 h-5 rounded-full border text-xs font-semibold shrink-0 mt-0.5">
                    ${String.fromCharCode(65 + optIdx)}
                  </span>
                  <span>${opt}</span>
                </div>
              </button>
            `;
          }).join('')}
        </div>

        ${answered ? `
          <div class="p-4 rounded-lg mb-6 ${userSelected === currentQ.correct ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200' : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'} text-xs md:text-sm">
            <div class="font-bold mb-1">${userSelected === currentQ.correct ? '✓ Правильно!' : '✗ Неверно!'}</div>
            <p>${currentQ.explanation}</p>
          </div>
        ` : ''}

        <div class="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-4">
          <button id="quiz-prev-btn" ${state.quizIndex === 0 ? 'disabled' : ''} class="px-4 py-2 rounded-lg text-xs md:text-sm font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-40 transition">
            ← Назад
          </button>
          ${answered ? `
            <button id="quiz-next-btn" class="px-5 py-2 rounded-lg text-xs md:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition">
              ${state.quizIndex === questions.length - 1 ? 'Завершить тест 🏁' : 'Следующий вопрос →'}
            </button>
          ` : `
            <span class="text-xs text-slate-400">Выберите вариант ответа</span>
          `}
        </div>
      </div>
    `;

    document.querySelectorAll('.quiz-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const optIdx = parseInt(btn.dataset.optIdx, 10);
        state.quizUserAnswers[state.quizIndex] = optIdx;
        if (optIdx === currentQ.correct) {
          state.quizScore++;
        }
        renderQuiz();
      });
    });

    const nextBtn = document.getElementById('quiz-next-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (state.quizIndex < questions.length - 1) {
          state.quizIndex++;
          renderQuiz();
        } else {
          state.quizFinished = true;
          renderQuizResults();
        }
      });
    }

    const prevBtn = document.getElementById('quiz-prev-btn');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (state.quizIndex > 0) {
          state.quizIndex--;
          renderQuiz();
        }
      });
    }

    renderMath();
  }

  function renderQuizResults() {
    if (!quizContainer) return;
    const total = window.APP_DATA.quiz.length;
    const score = state.quizScore;
    const pct = Math.round((score / total) * 100);

    let message = '';
    let emoji = '';
    if (pct >= 90) {
      emoji = '🏆 Отлично!';
      message = 'Блестящий результат! Вы полностью готовы к защите работы и уверенным ответам преподавателю.';
      if (typeof confetti === 'function') confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } else if (pct >= 70) {
      emoji = '👍 Хорошо!';
      message = 'Твердая четверка! Рекомендуется еще раз заглянуть в раздел «Каверзные вопросы», чтобы получить отлично.';
    } else {
      emoji = '📖 Нужно повторить';
      message = 'Есть пробелы в базовых формулировках. Пройдитесь по карточкам и шпаргалке еще раз.';
    }

    quizContainer.innerHTML = `
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 md:p-8 text-center shadow-sm">
        <div class="text-4xl mb-2">${emoji.split(' ')[0]}</div>
        <h3 class="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-2">
          ${emoji.split(' ')[1]}
        </h3>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
          ${message}
        </p>

        <div class="inline-block p-4 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl border border-indigo-200 dark:border-indigo-800 mb-6">
          <div class="text-3xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
            ${score} / ${total}
          </div>
          <div class="text-xs text-indigo-800 dark:text-indigo-300 font-bold uppercase tracking-wider mt-1">
            ${pct}% правильных ответов
          </div>
        </div>

        <div>
          <button id="quiz-restart-btn" class="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-md transition">
            Пройти тест заново ↺
          </button>
        </div>
      </div>
    `;

    document.getElementById('quiz-restart-btn')?.addEventListener('click', () => {
      state.quizIndex = 0;
      state.quizScore = 0;
      state.quizUserAnswers = {};
      state.quizFinished = false;
      renderQuiz();
    });
  }

  // -------------------------------------------------------------
  // INITIAL BOOTSTRAP
  // -------------------------------------------------------------
  initTheme();
  switchPractical(state.currentPr);

  // Initialize PR-3 Calculators
  buildCalc1Grid(3, 7, calc1Matrix);
  computeConcordance();
  buildCalc2Matrix(4);
  computePairwise();
  computeDirectRating();
  renderChurchmanAckoff();

  // Initialize PR-4 Calculators
  renderMfSliders();
  drawMfGraph();
  computeMamdani();
});
