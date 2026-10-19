/**
 * Логика интерактивного приложения по системному анализу
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global State
  const state = {
    activeTab: 'cheatsheet',
    searchQuery: '',
    learnedQuestions: new Set(JSON.parse(localStorage.getItem('sa_learned') || '[]')),
    flashcards: [...APP_DATA.flashcards],
    currentCardIndex: 0,
    isCardFlipped: false,
    knownCards: new Set(JSON.parse(localStorage.getItem('sa_known_cards') || '[]')),
    quizIndex: 0,
    quizScore: 0,
    quizUserAnswers: {},
    quizFinished: false,
    isSpeaking: false,
    currentSpeechId: null,
    theme: localStorage.getItem('sa_theme') || 'light'
  };

  // DOM Elements
  const tabButtons = document.querySelectorAll('[data-tab-target]');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const searchInput = document.getElementById('global-search');
  const themeToggleBtn = document.getElementById('theme-toggle');

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

  themeToggleBtn.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('sa_theme', state.theme);
    initTheme();
  });

  // Math rendering helper
  function renderMath() {
    if (window.renderMathInElement) {
      renderMathInElement(document.body, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    }
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

    // Re-render math in active pane
    setTimeout(renderMath, 50);
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tabTarget);
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
    // Clean text from KaTeX and markdown artifacts for speech
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
    localStorage.setItem('sa_learned', JSON.stringify(Array.from(state.learnedQuestions)));
    renderQuestions();
    updateProgressHeader();
  }

  function updateProgressHeader() {
    const total = APP_DATA.questions.length;
    const learned = state.learnedQuestions.size;
    const pct = Math.round((learned / total) * 100);
    const progressEl = document.getElementById('overall-progress-text');
    const progressBar = document.getElementById('overall-progress-bar');
    if (progressEl) progressEl.innerText = `${learned}/${total} (${pct}%) вопросов изучено`;
    if (progressBar) progressBar.style.width = `${pct}%`;
  }

  // Render 13 Questions (Cheat Sheet)
  function renderQuestions() {
    const container = document.getElementById('questions-container');
    if (!container) return;

    const query = state.searchQuery.toLowerCase().trim();
    const filtered = APP_DATA.questions.filter(q => {
      if (!query) return true;
      return (
        q.title.toLowerCase().includes(query) ||
        q.shortAnswer.toLowerCase().includes(query) ||
        (q.lectureExcerpt && q.lectureExcerpt.toLowerCase().includes(query)) ||
        q.oralDefense.toLowerCase().includes(query) ||
        q.tags.some(t => t.toLowerCase().includes(query))
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
        <article class="card-print bg-white dark:bg-slate-800 rounded-xl border ${isLearned ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50/20' : 'border-slate-200 dark:border-slate-700'} shadow-sm hover:shadow-md transition-all duration-200 p-5 md:p-6 mb-5" id="question-${q.id}">
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

          <!-- Выжимка без лишних слов -->
          <div class="mb-4 p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 border-l-4 border-indigo-500 rounded-r-lg">
            <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300 mb-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              Суть ответа (без лишних слов):
            </div>
            <p class="text-sm md:text-base text-slate-800 dark:text-slate-200 font-medium leading-relaxed">${q.shortAnswer}</p>
          </div>

          <!-- Суть ответа из лекции (как есть) -->
          <div class="mb-4 p-3.5 bg-sky-50/80 dark:bg-sky-950/40 border-l-4 border-sky-500 rounded-r-lg">
            <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-sky-900 dark:text-sky-300 mb-1.5">
              <span class="flex items-center gap-1.5">
                <svg class="w-4 h-4 text-sky-600 dark:text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                </svg>
                Суть ответа из лекции (как есть):
              </span>
              <span class="text-[10px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/60 px-2 py-0.5 rounded">
                Вырезка из слайдов
              </span>
            </div>
            <div class="text-sm md:text-base text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
              ${q.lectureExcerpt}
            </div>
          </div>

          <!-- Скрипт ответа своими словами -->
          <div class="mb-4 p-3.5 bg-amber-50/70 dark:bg-amber-950/30 border-l-4 border-amber-500 rounded-r-lg">
            <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
              Как сказать преподавателю своими словами:
            </div>
            <p class="text-sm md:text-base text-slate-800 dark:text-slate-200 italic leading-relaxed">${q.oralDefense}</p>
          </div>

          <!-- Подробная теория (разворачиваемый блок) -->
          <div class="no-print border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden my-3">
            <button class="toggle-deep-btn w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300 transition">
              <span class="flex items-center gap-2">
                <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                Развернуть полную теоретическую справку и формулы
              </span>
              <svg class="chevron-icon w-4 h-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </button>
            <div class="deep-content hidden p-4 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700">
              ${q.deepDive}
            </div>
          </div>

          <!-- Ловушка / Каверзный вопрос -->
          <div class="mt-3 p-3 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg text-xs md:text-sm text-rose-900 dark:text-rose-200">
            <span class="font-bold text-rose-700 dark:text-rose-300">💡 Каверзный вопрос на защите:</span>
            ${q.examTrap}
          </div>

          <!-- Теги -->
          <footer class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex flex-wrap gap-1.5">
            ${q.tags.map(tag => `<span class="px-2 py-0.5 text-[11px] rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">#${tag}</span>`).join('')}
          </footer>
        </article>
      `;
    }).join('');

    // Attach listeners
    document.querySelectorAll('.speech-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const qId = parseInt(btn.dataset.questionId, 10);
        const question = APP_DATA.questions.find(q => q.id === qId);
        if (question) speakText(question.oralDefense, qId);
      });
    });

    document.querySelectorAll('.learn-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        toggleLearned(parseInt(btn.dataset.learnId, 10));
      });
    });

    document.querySelectorAll('.toggle-deep-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const content = btn.nextElementSibling;
        const icon = btn.querySelector('.chevron-icon');
        content.classList.toggle('hidden');
        icon.classList.toggle('rotate-180');
        renderMath();
      });
    });

    renderMath();
    updateSpeechButtons();
  }

  // Render Theory Sections
  function renderTheory() {
    const container = document.getElementById('theory-container');
    if (!container) return;

    container.innerHTML = APP_DATA.theorySections.map(sec => `
      <section class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 md:p-6 mb-6 shadow-sm">
        <header class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
          <h3 class="text-lg md:text-xl font-bold text-slate-900 dark:text-white">${sec.title}</h3>
          <span class="px-2.5 py-1 text-xs rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold">${sec.badge}</span>
        </header>
        <div class="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed text-sm md:text-base">
          ${sec.content}
        </div>
      </section>
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
  // CALCULATORS ENGINE
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
    const meanR = totalSum / n; // или m * (n + 1) / 2

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
    if (K > 1) K = 1; // Rounding protection

    // 6. Qualitative Interpretation
    let interpretation = '';
    let badgeColor = '';
    if (K < 0.3) {
      interpretation = 'Слабая согласованность мнений экспертов. Усреднять оценки нельзя, требуется дополнительный опрос или метод Дельфи.';
      badgeColor = 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
    } else if (K < 0.5) {
      interpretation = 'Умеренная согласованность. Рекомендуется обсудить расхождения.';
      badgeColor = 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300';
    } else if (K < 0.7) {
      interpretation = 'Заметная согласованность мнений.';
      badgeColor = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300';
    } else if (K < 0.9) {
      interpretation = 'Высокая согласованность мнений. Обобщенный ранг достоверен.';
      badgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
    } else {
      interpretation = 'Очень высокая (практически идеальная) согласованность!';
      badgeColor = 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300';
    }

    // 7. General ranks by sum of ranks (lowest sum = rank 1)
    const indexedSums = sumRanks.map((s, idx) => ({ idx, sum: s }));
    indexedSums.sort((a, b) => a.sum - b.sum);

    const finalRanks = new Array(n);
    let curr = 0;
    while (curr < n) {
      let next = curr;
      while (next < n && indexedSums[next].sum === indexedSums[curr].sum) {
        next++;
      }
      // Tied places from curr+1 to next
      let rankAvg = 0;
      for (let p = curr + 1; p <= next; p++) rankAvg += p;
      rankAvg /= (next - curr);
      for (let p = curr; p < next; p++) {
        finalRanks[indexedSums[p].idx] = rankAvg;
      }
      curr = next;
    }

    // Render results
    calc1ResultsContainer.innerHTML = `
      <div class="mt-5 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h4 class="font-bold text-base md:text-lg text-slate-900 dark:text-white">Результат расчета конкордации</h4>
            <p class="text-xs text-slate-500">По формуле Кендалла с учетом связок $T_s$</p>
          </div>
          <div class="text-right">
            <span class="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">K = ${K.toFixed(4)}</span>
          </div>
        </div>

        <div class="p-3 rounded-lg ${badgeColor} text-sm font-medium">
          <strong>Оценка согласованности:</strong> ${interpretation}
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full text-xs text-center border border-slate-200 dark:border-slate-700">
            <thead class="bg-slate-200 dark:bg-slate-800">
              <tr>
                <th class="p-2 border">Показатель</th>
                ${sumRanks.map((_, i) => `<th class="p-2 border font-bold">x${i + 1}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="p-2 border font-semibold">Сумма рангов ($S_i$)</td>
                ${sumRanks.map(s => `<td class="p-2 border font-mono font-bold">${s}</td>`).join('')}
              </tr>
              <tr>
                <td class="p-2 border font-semibold">Отклонение ($S_i - \\bar{r}$)</td>
                ${deviations.map(d => `<td class="p-2 border font-mono">${d.toFixed(1)}</td>`).join('')}
              </tr>
              <tr class="bg-indigo-50/70 dark:bg-indigo-950/40">
                <td class="p-2 border font-bold text-indigo-700 dark:text-indigo-300">Обобщенный ранг</td>
                ${finalRanks.map(r => `<td class="p-2 border font-mono font-bold text-indigo-600 dark:text-indigo-400">${r}</td>`).join('')}
              </tr>
            </tbody>
          </table>
        </div>

        <div class="text-xs text-slate-600 dark:text-slate-400 space-y-1">
          <p>• Среднее значение суммы рангов $\\bar{r} = ${meanR.toFixed(2)}$</p>
          <p>• Сумма квадратов отклонений $\\sum d_i^2 = ${sumSqDev.toFixed(2)}$</p>
          <p>• Поправка на связки $\\sum T_s = ${totalT}$</p>
          <p>• Статистика Пирсона $\\chi^2 = m(n-1)K = ${(m * (n - 1) * K).toFixed(3)}$ (число степеней свободы $\\nu = ${n - 1}$)</p>
        </div>
      </div>
    `;
    renderMath();
  }

  if (calc1ComputeBtn) {
    calc1ComputeBtn.addEventListener('click', computeConcordance);
  }

  if (calc1LoadExampleBtn) {
    calc1LoadExampleBtn.addEventListener('click', () => {
      calc1ExpertsInput.value = 3;
      calc1ObjectsInput.value = 7;
      buildCalc1Grid(3, 7, calc1Matrix);
      computeConcordance();
    });
  }

  if (calc1ExpertsInput && calc1ObjectsInput) {
    const rebuildGrid = () => {
      const m = Math.max(2, Math.min(10, parseInt(calc1ExpertsInput.value, 10) || 3));
      const n = Math.max(3, Math.min(12, parseInt(calc1ObjectsInput.value, 10) || 5));
      buildCalc1Grid(m, n);
    };
    calc1ExpertsInput.addEventListener('change', rebuildGrid);
    calc1ObjectsInput.addEventListener('change', rebuildGrid);
  }

  // Calculator 2: Pairwise Comparison Matrix
  const calc2Container = document.getElementById('calc2-matrix-container');
  const calc2ResultsContainer = document.getElementById('calc2-results');
  const calc2SizeSelect = document.getElementById('calc2-size');
  let calc2Size = 4;
  let pairwiseMatrix = [
    [1, 1, 1, 1],
    [0, 1, 0, 0],
    [0, 1, 1, 1],
    [0, 1, 0, 1]
  ];

  function buildCalc2Matrix(size) {
    calc2Size = size;
    // ensure matrix dimensions
    const mat = [];
    for (let i = 0; i < size; i++) {
      mat[i] = [];
      for (let j = 0; j < size; j++) {
        if (i === j) mat[i][j] = 1;
        else if (pairwiseMatrix[i] && pairwiseMatrix[i][j] !== undefined) mat[i][j] = pairwiseMatrix[i][j];
        else mat[i][j] = i < j ? 1 : 0;
      }
    }
    pairwiseMatrix = mat;

    let html = `<table class="min-w-full text-xs text-center border border-slate-300 dark:border-slate-700">`;
    html += `<thead class="bg-slate-100 dark:bg-slate-700"><tr><th class="p-2 border">C_ij</th>`;
    for (let j = 0; j < size; j++) html += `<th class="p-2 border font-bold">x${j + 1}</th>`;
    html += `</tr></thead><tbody>`;

    for (let i = 0; i < size; i++) {
      html += `<tr><td class="p-2 border font-bold bg-slate-50 dark:bg-slate-800">x${i + 1}</td>`;
      for (let j = 0; j < size; j++) {
        if (i === j) {
          html += `<td class="p-2 border bg-slate-200 dark:bg-slate-700 font-bold">1</td>`;
        } else {
          html += `
            <td class="p-1 border">
              <button class="calc2-toggle w-8 h-8 rounded font-mono font-bold transition ${pairwiseMatrix[i][j] === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}" data-i="${i}" data-j="${j}">
                ${pairwiseMatrix[i][j]}
              </button>
            </td>
          `;
        }
      }
      html += `</tr>`;
    }
    html += `</tbody></table>`;
    calc2Container.innerHTML = html;

    calc2Container.querySelectorAll('.calc2-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.i, 10);
        const j = parseInt(btn.dataset.j, 10);
        const newVal = pairwiseMatrix[i][j] === 1 ? 0 : 1;
        pairwiseMatrix[i][j] = newVal;
        pairwiseMatrix[j][i] = 1 - newVal; // strict antisymmetry
        buildCalc2Matrix(calc2Size);
        computePairwise();
      });
    });
  }

  function computePairwise() {
    const n = calc2Size;
    const rowSums = new Array(n).fill(0);
    const colSums = new Array(n).fill(0);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        rowSums[i] += pairwiseMatrix[i][j];
        colSums[j] += pairwiseMatrix[i][j];
      }
    }

    // Determine ranks by row sum: larger sum = higher rank (1 is best)
    const sortedRow = rowSums.map((s, idx) => ({ idx, sum: s })).sort((a, b) => b.sum - a.sum);
    const ranksByRow = new Array(n);
    sortedRow.forEach((item, pos) => {
      ranksByRow[item.idx] = pos + 1;
    });

    // Check Transitivity: If A > B and B > C, must have A > C
    const violations = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        for (let k = 0; k < n; k++) {
          if (i !== j && j !== k && i !== k) {
            if (pairwiseMatrix[i][j] === 1 && pairwiseMatrix[j][k] === 1 && pairwiseMatrix[i][k] === 0) {
              violations.push(`x${i + 1} ≻ x${j + 1} и x${j + 1} ≻ x${k + 1}, но x${k + 1} ≻ x${i + 1} (цикл противоречия)`);
            }
          }
        }
      }
    }

    const isTransitive = violations.length === 0;

    calc2ResultsContainer.innerHTML = `
      <div class="mt-4 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
        <div class="flex items-center justify-between border-b pb-2">
          <span class="font-bold text-sm">Проверка согласованности (транзитивности):</span>
          <span class="px-2.5 py-1 text-xs rounded-full font-bold ${isTransitive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
            ${isTransitive ? '✓ Матрица согласована' : '⚠ Есть нарушения транзитивности'}
          </span>
        </div>

        ${!isTransitive ? `
          <div class="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs rounded">
            <strong>Найдены интранзитивные циклы:</strong>
            <ul class="list-disc pl-4 mt-1">${violations.slice(0, 3).map(v => `<li>${v}</li>`).join('')}</ul>
          </div>
        ` : ''}

        <div class="overflow-x-auto">
          <table class="min-w-full text-xs text-center border">
            <thead class="bg-slate-200 dark:bg-slate-800 font-semibold">
              <tr>
                <th class="p-2 border">Объект</th>
                ${rowSums.map((_, i) => `<th class="p-2 border">x${i + 1}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="p-2 border font-medium">Сумма по строке (победы)</td>
                ${rowSums.map(s => `<td class="p-2 border font-mono font-bold">${s}</td>`).join('')}
              </tr>
              <tr>
                <td class="p-2 border font-medium">Сумма по столбцу (поражения)</td>
                ${colSums.map(s => `<td class="p-2 border font-mono">${s}</td>`).join('')}
              </tr>
              <tr class="bg-emerald-50 dark:bg-emerald-950/50 font-bold">
                <td class="p-2 border text-emerald-700">Итоговый ранг (по строкам)</td>
                ${ranksByRow.map(r => `<td class="p-2 border text-emerald-600 font-mono text-sm">${r}</td>`).join('')}
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-xs text-slate-500">Примечание: Ранг 1 присвоен объекту с максимальной суммой по строке (наибольшее число преимуществ).</p>
      </div>
    `;
    renderMath();
  }

  if (calc2SizeSelect) {
    calc2SizeSelect.addEventListener('change', (e) => {
      buildCalc2Matrix(parseInt(e.target.value, 10));
      computePairwise();
    });
  }

  // Calculator 3: Direct Rating & Expert Weights
  const calc3ComputeBtn = document.getElementById('calc3-compute-btn');
  const calc3NormalizeWeightsBtn = document.getElementById('calc3-norm-weights-btn');
  const calc3ResultsContainer = document.getElementById('calc3-results');

  function normalizeCalc3Weights() {
    const weightInputs = document.querySelectorAll('.calc3-w');
    let sum = 0;
    weightInputs.forEach(inp => sum += parseFloat(inp.value || 0));
    if (sum > 0) {
      weightInputs.forEach(inp => {
        inp.value = (parseFloat(inp.value || 0) / sum).toFixed(3);
      });
    }
  }

  function computeDirectRating() {
    const weightInputs = document.querySelectorAll('.calc3-w');
    const weights = Array.from(weightInputs).map(inp => parseFloat(inp.value || 0));
    const sumW = weights.reduce((a, b) => a + b, 0);

    const m = 3; // experts
    const n = 4; // objects

    const matrix = [];
    for (let j = 0; j < m; j++) {
      matrix[j] = [];
      for (let i = 0; i < n; i++) {
        const inp = document.querySelector(`.calc3-score[data-expert="${j}"][data-obj="${i}"]`);
        matrix[j][i] = parseFloat(inp ? inp.value : 0) || 0;
      }
    }

    // Calculations per object:
    const simpleMeans = [];
    const weightedMeans = [];
    const stdDevs = [];
    const varCoeffs = [];

    for (let i = 0; i < n; i++) {
      const scores = matrix.map(expRow => expRow[i]);
      const mean = scores.reduce((a, b) => a + b, 0) / m;
      simpleMeans.push(mean);

      // Weighted mean
      let wMean = 0;
      for (let j = 0; j < m; j++) {
        wMean += weights[j] * scores[j];
      }
      weightedMeans.push(wMean);

      // Variance and std dev
      const variance = scores.reduce((acc, sc) => acc + Math.pow(sc - mean, 2), 0) / (m - 1);
      const s = Math.sqrt(variance);
      stdDevs.push(s);

      // Variation coefficient V = s / mean
      const v = mean > 0 ? (s / mean) : 0;
      varCoeffs.push(v);
    }

    calc3ResultsContainer.innerHTML = `
      <div class="mt-4 p-4 bg-slate-50 dark:bg-slate-900 border rounded-xl space-y-3">
        <div class="flex items-center justify-between border-b pb-2">
          <span class="font-bold text-sm">Проверка суммы весов:</span>
          <span class="font-mono text-xs px-2 py-0.5 rounded font-bold ${Math.abs(sumW - 1) < 0.05 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
            ∑ k_j = ${sumW.toFixed(3)} ${Math.abs(sumW - 1) < 0.05 ? '(Нормировано ✓)' : '(Не равно 1! Нажмите кнопку нормировки)'}
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full text-xs text-center border">
            <thead class="bg-slate-200 dark:bg-slate-800 font-semibold">
              <tr>
                <th class="p-2 border">Показатель</th>
                <th class="p-2 border">x1</th>
                <th class="p-2 border">x2</th>
                <th class="p-2 border">x3</th>
                <th class="p-2 border">x4</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="p-2 border font-medium">Простая средняя (без весов)</td>
                ${simpleMeans.map(mVal => `<td class="p-2 border font-mono">${mVal.toFixed(2)}</td>`).join('')}
              </tr>
              <tr class="bg-indigo-50 dark:bg-indigo-950/40 font-bold">
                <td class="p-2 border text-indigo-700 dark:text-indigo-300">Взвешенная оценка (с k_j)</td>
                ${weightedMeans.map(wVal => `<td class="p-2 border font-mono text-indigo-600 dark:text-indigo-400 font-bold text-sm">${wVal.toFixed(2)}</td>`).join('')}
              </tr>
              <tr>
                <td class="p-2 border font-medium">Коэффициент вариации V</td>
                ${varCoeffs.map(v => `
                  <td class="p-2 border font-mono font-bold ${v <= 0.33 ? 'text-emerald-600' : v <= 0.5 ? 'text-orange-500' : 'text-rose-600'}">
                    ${(v * 100).toFixed(1)}% ${v <= 0.33 ? '✓' : '⚠'}
                  </td>
                `).join('')}
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-xs text-slate-500">
          Зеленый флаг (V ≤ 33%) означает высокую степень согласованности мнений экспертов по объекту.
        </p>
      </div>
    `;
    renderMath();
  }

  if (calc3NormalizeWeightsBtn) {
    calc3NormalizeWeightsBtn.addEventListener('click', () => {
      normalizeCalc3Weights();
      computeDirectRating();
    });
  }

  if (calc3ComputeBtn) {
    calc3ComputeBtn.addEventListener('click', computeDirectRating);
  }

  // Calculator 4: Churchman-Ackoff Interactive Simulator
  const caWeights = [1.0, 0.8, 0.5, 0.3, 0.2];
  const caStepText = document.getElementById('ca-step-text');
  const caDisplayContainer = document.getElementById('ca-table-display');
  const caGreaterBtn = document.getElementById('ca-greater-btn');
  const caLessBtn = document.getElementById('ca-less-btn');
  const caEqualBtn = document.getElementById('ca-equal-btn');
  const caResetBtn = document.getElementById('ca-reset-btn');

  let caCurrentStep = 1; // 1: x1 vs (x2+x3+x4+x5), 2: x2 vs (x3+x4+x5), 3: x3 vs (x4+x5), 4: x4 vs x5

  function renderChurchmanAckoff() {
    let sumRemaining = 0;
    for (let i = caCurrentStep; i < 5; i++) sumRemaining += caWeights[i];

    if (caStepText) {
      if (caCurrentStep <= 3) {
        caStepText.innerHTML = `
          Шаг ${caCurrentStep}: Сравнение объекта <strong>x${caCurrentStep}</strong> (текущий вес: ${caWeights[caCurrentStep - 1].toFixed(2)}) 
          с суммой остальных [${Array.from({ length: 5 - caCurrentStep }, (_, k) => `x${caCurrentStep + 1 + k}`).join(' + ')}] = ${sumRemaining.toFixed(2)}.
          <br><span class="text-xs text-slate-500">Вопрос эксперту: Превосходит ли x${caCurrentStep} сумму всех последующих объектов по предпочтительности?</span>
        `;
      } else if (caCurrentStep === 4) {
        caStepText.innerHTML = `
          Шаг 4: Сравнение объекта <strong>x4</strong> (вес: ${caWeights[3].toFixed(2)}) с последним объектом <strong>x5</strong> (вес: ${caWeights[4].toFixed(2)}).
        `;
      } else {
        caStepText.innerHTML = `
          <strong>Все шаги завершены!</strong> Веса согласованы и приведены к единице. Нажмите «Сбросить», чтобы пройти заново.
        `;
      }
    }

    // Normalized to sum 1
    const totalW = caWeights.reduce((a, b) => a + b, 0);
    const normW = caWeights.map(w => (w / totalW).toFixed(3));
    const maxW = Math.max(...caWeights);
    const normToMax = caWeights.map(w => (w / maxW).toFixed(2));

    caDisplayContainer.innerHTML = `
      <div class="overflow-x-auto my-3">
        <table class="min-w-full text-xs text-center border">
          <thead class="bg-slate-100 dark:bg-slate-700 font-semibold">
            <tr>
              <th class="p-2 border">Объект</th>
              <th class="p-2 border">Текущий вес f(x_i)</th>
              <th class="p-2 border font-bold text-indigo-600">Нормировано к [0, 1]</th>
              <th class="p-2 border font-bold text-emerald-600">Доля в сумме (∑=1)</th>
            </tr>
          </thead>
          <tbody>
            ${caWeights.map((w, idx) => `
              <tr class="${idx === caCurrentStep - 1 ? 'bg-amber-50 dark:bg-amber-950/40 font-bold' : ''}">
                <td class="p-2 border">x${idx + 1} ${idx === caCurrentStep - 1 ? '👉' : ''}</td>
                <td class="p-2 border font-mono">${w.toFixed(2)}</td>
                <td class="p-2 border font-mono font-bold text-indigo-600">${normToMax[idx]}</td>
                <td class="p-2 border font-mono font-bold text-emerald-600">${normW[idx]}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    renderMath();
  }

  function handleCAStep(relation) {
    if (caCurrentStep > 4) return;
    let sumRemaining = 0;
    for (let i = caCurrentStep; i < 5; i++) sumRemaining += caWeights[i];

    const currIdx = caCurrentStep - 1;
    if (relation === 'greater') {
      if (caWeights[currIdx] <= sumRemaining) {
        caWeights[currIdx] = parseFloat((sumRemaining + 0.3).toFixed(2));
      }
    } else if (relation === 'less') {
      if (caWeights[currIdx] >= sumRemaining) {
        caWeights[currIdx] = parseFloat(Math.max(0.05, sumRemaining - 0.2).toFixed(2));
      }
    } else if (relation === 'equal') {
      caWeights[currIdx] = parseFloat(sumRemaining.toFixed(2));
    }

    caCurrentStep++;
    renderChurchmanAckoff();
  }

  if (caGreaterBtn) caGreaterBtn.addEventListener('click', () => handleCAStep('greater'));
  if (caLessBtn) caLessBtn.addEventListener('click', () => handleCAStep('less'));
  if (caEqualBtn) caEqualBtn.addEventListener('click', () => handleCAStep('equal'));
  if (caResetBtn) {
    caResetBtn.addEventListener('click', () => {
      caWeights[0] = 1.0;
      caWeights[1] = 0.8;
      caWeights[2] = 0.5;
      caWeights[3] = 0.3;
      caWeights[4] = 0.2;
      caCurrentStep = 1;
      renderChurchmanAckoff();
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

    flashcardCategory.innerText = card.category;
    flashcardFront.innerHTML = `<div class="text-base md:text-lg font-semibold text-slate-900 dark:text-white">${card.front}</div>`;
    flashcardBack.innerHTML = `<div class="text-sm md:text-base text-slate-800 dark:text-slate-200 leading-relaxed">${card.back}</div>`;

    const isKnown = state.knownCards.has(card.id);
    flashcardProgressText.innerText = `Карточка ${state.currentCardIndex + 1} из ${state.flashcards.length} | Изучено: ${state.knownCards.size}`;

    if (flashcardKnownBtn) {
      flashcardKnownBtn.innerHTML = isKnown ? '✓ Знаю эту тему' : 'Отметить: знаю';
      flashcardKnownBtn.className = isKnown
        ? 'px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs md:text-sm font-semibold transition'
        : 'px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs md:text-sm font-semibold hover:bg-slate-200 transition';
    }

    renderMath();
  }

  function flipCard() {
    state.isCardFlipped = !state.isCardFlipped;
    flashcardInner.classList.toggle('flipped', state.isCardFlipped);
    renderMath();
  }

  if (flashcardEl) {
    flashcardEl.addEventListener('click', flipCard);
  }
  if (flashcardFlipBtn) {
    flashcardFlipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      flipCard();
    });
  }

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
      localStorage.setItem('sa_known_cards', JSON.stringify(Array.from(state.knownCards)));
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
    const questions = APP_DATA.quiz;
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
            Вопрос ${state.quizIndex + 1} из ${questions.length}
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
                btnClass += 'border-slate-200 dark:border-slate-700 opacity-60 text-slate-500';
              }
            }

            return `
              <button class="quiz-opt-btn ${btnClass}" data-opt-idx="${optIdx}" ${answered ? 'disabled' : ''}>
                <span class="font-mono mr-2">${String.fromCharCode(65 + optIdx)})</span> ${opt}
              </button>
            `;
          }).join('')}
        </div>

        ${answered ? `
          <div class="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 mb-5">
            <h5 class="text-xs font-bold uppercase tracking-wider ${userSelected === currentQ.correct ? 'text-emerald-600' : 'text-rose-600'} mb-1">
              ${userSelected === currentQ.correct ? '✓ Правильно!' : '✕ Ошибка!'}
            </h5>
            <p class="text-sm text-slate-700 dark:text-slate-300">${currentQ.explanation}</p>
          </div>
        ` : ''}

        <div class="flex items-center justify-between pt-2">
          <button id="quiz-prev-btn" class="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 ${state.quizIndex === 0 ? 'invisible' : ''}">
            ← Назад
          </button>

          ${answered ? `
            <button id="quiz-next-btn" class="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-xs md:text-sm font-semibold hover:bg-indigo-700 transition">
              ${state.quizIndex < questions.length - 1 ? 'Следующий вопрос →' : 'Завершить тест 🏆'}
            </button>
          ` : ''}
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

    document.getElementById('quiz-prev-btn')?.addEventListener('click', () => {
      if (state.quizIndex > 0) {
        state.quizIndex--;
        renderQuiz();
      }
    });

    document.getElementById('quiz-next-btn')?.addEventListener('click', () => {
      if (state.quizIndex < questions.length - 1) {
        state.quizIndex++;
        renderQuiz();
      } else {
        state.quizFinished = true;
        renderQuiz();
      }
    });

    renderMath();
  }

  function renderQuizResults() {
    const total = APP_DATA.quiz.length;
    const score = state.quizScore;
    const pct = Math.round((score / total) * 100);

    let message = '';
    if (pct >= 85) message = 'Отличный результат! Вы блестяще готовы ответить на любой каверзный вопрос преподавателя.';
    else if (pct >= 65) message = 'Хороший уровень! Повторите слабые моменты в разделе шпаргалки.';
    else message = 'Рекомендуется еще раз внимательно прочитать шпаргалку и потренироваться на карточках.';

    // Run confetti if high score
    if (pct >= 80 && window.confetti) {
      window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }

    quizContainer.innerHTML = `
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 text-center shadow-sm space-y-4">
        <div class="inline-flex p-3 rounded-full ${pct >= 70 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}">
          <svg class="w-10 h-10" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg>
        </div>
        <h3 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Тестирование завершено</h3>
        <p class="text-3xl font-black text-indigo-600 font-mono">${score} из ${total} (${pct}%)</p>
        <p class="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">${message}</p>
        <div class="pt-3">
          <button id="quiz-restart-btn" class="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition">
            Пройти тест заново 🔄
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
  renderQuestions();
  renderTheory();
  updateProgressHeader();

  // Initialize Calculators
  buildCalc1Grid(3, 7, calc1Matrix);
  computeConcordance();
  buildCalc2Matrix(4);
  computePairwise();
  computeDirectRating();
  renderChurchmanAckoff();

  // Initialize Flashcards
  renderFlashcard();

  // Initialize Quiz
  renderQuiz();
});
