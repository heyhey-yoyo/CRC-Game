(() => {
  'use strict';

  const APP_VERSION = '0.7.0';
  const AUTO_SLOT = 'autosave';
  const MILESTONES = [0, 2, 4, 6, 8];
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  let content = null;
  let state = null;
  let simulation = null;
  let busy = false;
  let activeFilter = 'all';
  let comparisonRuns = null;
  let installPrompt = null;
  let landingAnimation = 0;
  let mapRegions = [];
  let selectedRegionIndex = 0;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function defaultState() {
    return {
      schemaVersion: 2,
      appVersion: APP_VERSION,
      caseId: 'case-b2m-escape',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      phase: 'planning',
      pathwayId: 'pembro',
      hypotheses: ['presentation'],
      selectedTests: ['ctdna', 'b2m', 'imaging'],
      predictions: ['disease_control'],
      run: null,
      events: [
        { week: 0, type: 'clinical', title: '病例基线建立', text: 'MSI-H / dMMR 已确认；当前尚无治疗后影像结果。' },
        { week: 0, type: 'mechanism', title: '保留不确定性', text: 'B2M / MHC-I 异质性被记录为假设，而不是确定性耐药结论。' }
      ],
      ui: {
        view: 'command',
        textScale: 'normal',
        highContrast: false,
        reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false,
        autosave: true,
        layer: 'cells',
        regionIndex: 0
      }
    };
  }

  function sanitizeState(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== 'object') return base;
    const pathwayIds = new Set((content?.pathways?.pathways || []).map((item) => item.id));
    const hypothesisIds = new Set((content?.caseData?.hypotheses || []).map((item) => item.id));
    const testIds = new Set((content?.caseData?.tests || []).map((item) => item.id));
    const predictionIds = new Set((content?.caseData?.predictions || []).map((item) => item.id));
    const ui = raw.ui && typeof raw.ui === 'object' ? raw.ui : {};
    const normalized = {
      ...base,
      ...raw,
      schemaVersion: 2,
      appVersion: APP_VERSION,
      phase: ['planning', 'active', 'completed'].includes(raw.phase) ? raw.phase : base.phase,
      pathwayId: pathwayIds.has(raw.pathwayId) ? raw.pathwayId : base.pathwayId,
      hypotheses: Array.isArray(raw.hypotheses) ? [...new Set(raw.hypotheses.filter((id) => hypothesisIds.has(id)))].slice(0, 3) : base.hypotheses,
      selectedTests: Array.isArray(raw.selectedTests) ? [...new Set(raw.selectedTests.filter((id) => testIds.has(id)))] : base.selectedTests,
      predictions: Array.isArray(raw.predictions) ? [...new Set(raw.predictions.filter((id) => predictionIds.has(id)))] : base.predictions,
      run: raw.run && typeof raw.run === 'object' ? raw.run : null,
      events: Array.isArray(raw.events)
        ? raw.events.slice(-160).map((event) => ({
            week: Math.max(0, Math.min(8, Number(event?.week) || 0)),
            type: ['clinical', 'research', 'mechanism', 'warning'].includes(event?.type) ? event.type : 'mechanism',
            title: String(event?.title || '事件').slice(0, 120),
            text: String(event?.text || '').slice(0, 800)
          }))
        : base.events,
      ui: {
        view: ['command', 'ecology', 'evidence', 'compare'].includes(ui.view) ? ui.view : base.ui.view,
        textScale: ['normal', 'large', 'xlarge'].includes(ui.textScale) ? ui.textScale : base.ui.textScale,
        highContrast: Boolean(ui.highContrast),
        reducedMotion: Boolean(ui.reducedMotion),
        autosave: ui.autosave !== false,
        layer: ['cells', 'presentation', 'contact', 'perfusion'].includes(ui.layer) ? ui.layer : base.ui.layer,
        regionIndex: Number.isInteger(ui.regionIndex) ? Math.max(0, Math.min(5, ui.regionIndex)) : 0
      }
    };
    if (!normalized.hypotheses.length) normalized.hypotheses = base.hypotheses;
    if (!normalized.predictions.length) normalized.predictions = base.predictions;
    if (!normalized.selectedTests.includes('imaging')) normalized.selectedTests.push('imaging');
    if (normalized.phase !== 'planning' && !normalized.run) normalized.phase = 'planning';
    return normalized;
  }

  function currentWeek() {
    return state?.run ? Math.round(Number(state.run.currentWeek) || 0) : 0;
  }

  function currentPathway() {
    return content.pathways.pathways.find((item) => item.id === state.pathwayId) || content.pathways.pathways[0];
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function formatDate(value) {
    try {
      return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
    } catch {
      return String(value || '');
    }
  }

  function setBootMessage(message) {
    $('#bootMessage').textContent = message;
  }

  function showFatal(error) {
    console.error(error);
    $('#bootScreen').classList.add('is-hidden');
    $('#landing').classList.add('is-hidden');
    $('#appShell').classList.add('is-hidden');
    $('#fatalScreen').classList.remove('is-hidden');
    $('#fatalMessage').textContent = error?.message || String(error);
  }

  function toast(title, text) {
    const node = document.createElement('div');
    node.className = 'toast';
    node.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span>`;
    $('#toastRegion').appendChild(node);
    window.setTimeout(() => node.remove(), 4600);
  }

  function applyUiPreferences() {
    document.body.dataset.textScale = state.ui.textScale;
    document.body.classList.toggle('high-contrast', state.ui.highContrast);
    document.body.classList.toggle('reduce-motion', state.ui.reducedMotion);
    $('#textScaleSelect').value = state.ui.textScale;
    $('#contrastToggle').checked = state.ui.highContrast;
    $('#motionToggle').checked = state.ui.reducedMotion;
    $('#autosaveToggle').checked = state.ui.autosave;
    $('#textScaleButton').textContent = state.ui.textScale === 'normal' ? 'A+' : state.ui.textScale === 'large' ? 'A++' : 'A';
  }

  function addEvent(type, title, text, week = currentWeek()) {
    const item = { week, type, title, text };
    state.events.push(item);
    state.events = state.events.slice(-160);
    if (state.run) {
      state.run.events = [...(state.run.events || []), item].slice(-160);
    }
  }

  async function persist(showToast = false) {
    state.updatedAt = new Date().toISOString();
    if (!state.ui.autosave && !showToast) return;
    const result = await window.CRC_STORAGE.save(AUTO_SLOT, state);
    $('#saveMetric').textContent = result.backend === 'indexedDB' ? '已保存' : '兼容存储';
    if (showToast) toast('存档完成', result.backend === 'indexedDB' ? '已保存到浏览器本地数据库。' : '已保存到浏览器兼容存储。');
  }

  function createSimulationClient() {
    let worker = null;
    let sequence = 0;
    const pending = new Map();
    let fallback = false;

    function useFallback(reason) {
      if (!fallback) {
        fallback = true;
        console.warn('Simulation worker fallback:', reason);
        toast('兼容模式', 'Web Worker 不可用，模拟已回退到主线程。核心结果保持确定性。');
      }
    }

    try {
      if (window.__CRC_EMBEDDED_WORKER__) {
        const blob = new Blob([window.__CRC_EMBEDDED_WORKER__], { type: 'text/javascript' });
        worker = new Worker(URL.createObjectURL(blob));
      } else {
        worker = new Worker('./js/sim-worker.js');
      }
      worker.addEventListener('message', (event) => {
        const message = event.data || {};
        const entry = pending.get(message.id);
        if (!entry) return;
        pending.delete(message.id);
        window.clearTimeout(entry.timeout);
        if (message.ok) entry.resolve(message.payload);
        else entry.reject(new Error(message.error?.message || 'Simulation worker failed.'));
      });
      worker.addEventListener('error', (event) => {
        useFallback(event.message || 'Worker error');
        for (const entry of pending.values()) entry.reject(new Error('Simulation worker unavailable.'));
        pending.clear();
        worker?.terminate();
        worker = null;
      });
    } catch (error) {
      useFallback(error.message);
      worker = null;
    }

    function direct(type, payload) {
      const engine = window.CRC_SIM_ENGINE;
      if (type === 'INIT') return engine.initializeRun(payload);
      if (type === 'ADVANCE') return engine.advanceRun(payload.run, payload.pathways, payload.targetWeek);
      if (type === 'SIMULATE_COMPLETE') return engine.simulateComplete(payload.input, payload.pathways);
      throw new Error(`Unknown direct simulation call: ${type}`);
    }

    function request(type, payload) {
      if (!worker || fallback) return Promise.resolve().then(() => direct(type, payload));
      const id = `sim-${Date.now()}-${sequence += 1}`;
      return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          pending.delete(id);
          useFallback('Worker timeout');
          Promise.resolve().then(() => direct(type, payload)).then(resolve, reject);
        }, 12000);
        pending.set(id, { resolve, reject, timeout });
        worker.postMessage({ id, type, payload });
      });
    }

    return {
      init: (payload) => request('INIT', payload),
      advance: (payload) => request('ADVANCE', payload),
      simulateComplete: (payload) => request('SIMULATE_COMPLETE', payload),
      terminate: () => worker?.terminate()
    };
  }

  function showLanding() {
    $('#bootScreen').classList.add('is-hidden');
    $('#appShell').classList.add('is-hidden');
    $('#landing').classList.remove('is-hidden');
    if (state.phase !== 'planning' || state.run || state.events.length > 2) $('#continueCaseButton').classList.remove('is-hidden');
    else $('#continueCaseButton').classList.add('is-hidden');
    startLandingAnimation();
  }

  function enterApp() {
    cancelAnimationFrame(landingAnimation);
    $('#landing').classList.add('is-hidden');
    $('#appShell').classList.remove('is-hidden');
    applyUiPreferences();
    renderAll();
    showView(state.ui.view || 'command', false);
    $('#mainContent').focus({ preventScroll: true });
  }

  function startNewCase() {
    const preferences = state?.ui ? clone(state.ui) : null;
    state = defaultState();
    if (preferences) state.ui = { ...state.ui, ...preferences };
    comparisonRuns = null;
    persist(false).catch(console.error);
    enterApp();
    toast('新病例已建立', '固定病例种子 2101；可先形成假设，再提交路径。');
  }

  function renderAll() {
    renderHeader();
    renderProgress();
    renderCaseBrief();
    renderHypotheses();
    renderPathways();
    renderTestsAndTimeline();
    renderPredictions();
    renderForecast();
    renderEvents();
    renderEvidence();
    renderMap();
    renderCompare();
    updateControlLocking();
  }

  function renderHeader() {
    const week = currentWeek();
    $('#weekMetric').textContent = `W${week}`;
    $('#pathMetric').textContent = state.phase === 'planning' ? '未提交' : currentPathway().shortName;
    $('#caseEyebrow').textContent = `${content.caseData.title} · ${content.caseData.durationMinutes} 分钟`;
    $('#caseSubtitle').textContent = content.caseData.subtitle;
    $('#footerVersion').textContent = `内容 ${content.manifest.contentVersion} · 医学基线 ${content.manifest.medicalBaseline}`;
    $('#contentBaseline').textContent = `医学内容基线：${content.manifest.medicalBaseline}`;
    const next = MILESTONES.find((item) => item > week);
    if (state.phase === 'planning') $('#advanceButton').textContent = '提交计划并推进到 W2';
    else if (state.phase === 'completed') $('#advanceButton').textContent = '病例已完成';
    else $('#advanceButton').textContent = `推进到 W${next}`;
    $('#advanceButton').disabled = busy || state.phase === 'completed';
  }

  function renderProgress() {
    const labels = { 0: '基线与计划', 2: '研究证据', 4: '安全复核', 6: '继续治疗', 8: '分类影像' };
    const week = currentWeek();
    $('#progressRail').innerHTML = MILESTONES.map((item) => {
      const className = item === week ? 'is-current' : item < week ? 'is-complete' : '';
      return `<div class="progress-node ${className}"><strong>W${item}</strong><span>${labels[item]}</span></div>`;
    }).join('');
  }

  function renderCaseBrief() {
    const frame = content.caseData.clinicalFrame;
    const run = state.run;
    const facts = [
      ['已知', 'MSI-H / dMMR', '适应证前提已确认'],
      ['评估节点', 'W8', '不在一周内报告疗效'],
      ['当前状态', state.phase === 'planning' ? '尚未提交路径' : currentPathway().shortName, state.phase === 'completed' ? 'W8 已完成' : `当前 W${currentWeek()}`]
    ];
    let html = `<div class="fact-grid">${facts.map(([label, value, note]) => `<div class="fact"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`).join('')}</div>`;
    const risks = [...frame.unknown];
    if (run?.outcome) risks.unshift(`${run.outcome.imaging}；${run.outcome.ecology}`);
    html += `<ul class="risk-list">${risks.slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
    html += `<div class="notice"><b>病例边界</b><span>${escapeHtml(frame.disclaimer)}</span></div>`;
    $('#caseBrief').innerHTML = html;
  }

  function renderHypotheses() {
    $('#hypothesisCount').textContent = `${state.hypotheses.length} / 3`;
    $('#hypothesisList').innerHTML = content.caseData.hypotheses.map((item, index) => {
      const selected = state.hypotheses.includes(item.id);
      return `<button class="hypothesis ${selected ? 'is-selected' : ''}" data-hypothesis="${item.id}" aria-pressed="${selected}"><span>H${index + 1}</span><div><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.summary)}</p><small>证据层：${escapeHtml(item.evidenceTier)}</small></div></button>`;
    }).join('');
  }

  function renderPathways() {
    $('#pathwayList').innerHTML = content.pathways.pathways.map((item) => {
      const selected = state.pathwayId === item.id;
      const code = item.id === 'pembro' ? 'P' : item.id === 'nivoipi' ? 'N+I' : 'F+B';
      return `<button class="pathway ${selected ? 'is-selected' : ''}" data-pathway="${item.id}" role="radio" aria-checked="${selected}"><span class="pathway-code">${code}</span><div><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.clinicalStatus)}</p><small>${escapeHtml(item.gameBoundary)}</small></div><em>${escapeHtml(item.shortName)}</em></button>`;
    }).join('');
    const pathway = currentPathway();
    $('#pathwaySummary').innerHTML = `<strong>机制：</strong>${pathway.mechanism.map(escapeHtml).join('；')}<br><strong>主要代价：</strong>${pathway.risks.map(escapeHtml).join('；')}`;
  }

  function renderTestsAndTimeline() {
    const locked = state.phase !== 'planning';
    $('#testOptions').innerHTML = content.caseData.tests.map((test) => {
      const selected = state.selectedTests.includes(test.id);
      const fixed = test.id === 'imaging';
      const label = test.classification === 'clinical' ? '临床节点' : test.classification === 'research' ? '研究性' : '转化研究';
      return `<label class="test-option"><input type="checkbox" data-test="${test.id}" ${selected ? 'checked' : ''} ${fixed || locked ? 'disabled' : ''}><span><strong>${escapeHtml(test.name)} · ${label}</strong><p>W${test.collectWeek} 采样 / W${test.returnWeek} 返回</p><small>${escapeHtml(test.limitations.join('；'))}</small></span></label>`;
    }).join('');

    const pathway = currentPathway();
    const weekNow = currentWeek();
    const selectedTests = content.caseData.tests.filter((test) => state.selectedTests.includes(test.id));
    $('#timeline').innerHTML = Array.from({ length: 9 }, (_, week) => {
      const treatmentEvents = pathway.schedule.filter((event) => event.week === week);
      const testEvents = selectedTests.flatMap((test) => {
        const events = [];
        if (test.collectWeek === week && test.returnWeek !== week) events.push({ label: `${test.name}采样`, type: test.classification === 'clinical' ? 'clinical' : 'research' });
        if (test.returnWeek === week) events.push({ label: `${test.name}${test.collectWeek === week ? '' : '返回'}`, type: test.classification === 'clinical' ? 'clinical' : 'research' });
        return events;
      });
      return `<div class="timeline-week ${week === weekNow ? 'is-current' : ''}"><strong>W${week}</strong>${treatmentEvents.map((event) => `<div class="timeline-event clinical">${escapeHtml(event.label)}</div>`).join('')}${testEvents.map((event) => `<div class="timeline-event ${event.type}">${escapeHtml(event.label)}</div>`).join('')}</div>`;
    }).join('');
  }

  function renderPredictions() {
    $('#predictionGrid').innerHTML = content.caseData.predictions.map((item) => {
      const selected = state.predictions.includes(item.id);
      return `<button class="prediction ${selected ? 'is-selected' : ''}" data-prediction="${item.id}" aria-pressed="${selected}"><span>${escapeHtml(item.dimension)}</span><strong>${escapeHtml(item.label)}</strong></button>`;
    }).join('');
  }

  function renderForecast() {
    const pathway = currentPathway();
    const uncertainty = state.selectedTests.includes('ctdna') && state.selectedTests.includes('b2m') ? '中等' : '较高';
    const toxicity = pathway.id === 'nivoipi' ? 'irAE 风险较高' : pathway.id === 'folfoxbev' ? '骨髓与神经毒性累积' : 'irAE 风险存在';
    const timing = pathway.id === 'folfoxbev' ? 'q2w-like 固定周期' : 'q3w-like 固定节点';
    $('#forecast').innerHTML = [
      ['路径节奏', timing],
      ['主要安全信号', toxicity],
      ['结论不确定性', uncertainty]
    ].map(([label, value]) => `<div class="forecast-item"><span>${label}</span><strong>${value}</strong></div>`).join('');
  }

  function renderEvents() {
    const list = state.events.filter((item) => activeFilter === 'all' || item.type === activeFilter).slice().reverse();
    $('#eventList').innerHTML = list.length
      ? list.map((item) => `<article class="event-item" data-type="${item.type}"><time>W${item.week}</time><span class="event-dot" aria-hidden="true"></span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></div></article>`).join('')
      : '<p class="empty-state">当前筛选下没有事件。</p>';
  }

  function renderEvidence() {
    const conceptCards = [
      {
        code: 'B', title: 'B2M / MHC-I', subtitle: '风险因子，不是必然失败开关',
        rows: [['已知', 'B2M 改变可影响 MHC-I 相关呈递。'], ['不确定', 'MSI-H CRC 中，B2M 缺失并不稳定预测检查点治疗无获益。'], ['游戏实现', '改变响应分布与生态风险，不直接强制耐药。']],
        refs: ['b2m-msih-crc']
      },
      {
        code: 'D', title: 'ctDNA 动态', subtitle: '研究信号，不是即时雷达',
        rows: [['可用信息', '输出检出 / 未检出、趋势和置信度。'], ['限制', '低释放、低频克隆和技术灵敏度可造成假阴性。'], ['游戏实现', '研究结果不会自动触发换药。']],
        refs: ['esmo-ctdna-2022']
      },
      {
        code: 'I', title: '影像与疑似进展', subtitle: '按评估节点，而非逐周判疗效',
        rows: [['常规原则', '影像在预设节点分类评估。'], ['免疫研究框架', '疑似进展在临床稳定时可能需要后续确认。'], ['游戏实现', 'W8 分类；疑似进展不自动判定终局。']],
        refs: ['irecist-2017']
      },
      {
        code: 'T', title: '免疫相关不良事件', subtitle: '器官与等级，而非单一百分比',
        rows: [['临床框架', '识别具体器官系统并按严重程度处理。'], ['游戏实现', '以甲状腺炎、皮疹或结肠炎等事件呈现。'], ['边界', '不把模型阈值写成临床处置规则。']],
        refs: ['asco-irae-2021']
      }
    ];
    const pathwayCards = content.pathways.pathways.map((pathway) => ({
      code: pathway.id === 'pembro' ? 'P' : pathway.id === 'nivoipi' ? 'N+I' : 'F+B',
      title: pathway.name,
      subtitle: pathway.clinicalStatus,
      rows: [['机制证据', pathway.mechanism.join('；')], ['主要风险', pathway.risks.join('；')], ['游戏抽象', pathway.gameBoundary]],
      refs: pathway.id === 'pembro' ? ['fda-pembro-crc-2020'] : pathway.id === 'nivoipi' ? ['fda-nivo-ipi-crc-2025'] : ['dailymed-bevacizumab']
    }));
    const refs = new Map(content.evidence.items.map((item) => [item.id, item]));
    $('#evidenceGrid').innerHTML = [...pathwayCards, ...conceptCards].map((card) => {
      const sources = card.refs.map((id) => refs.get(id)).filter(Boolean);
      return `<article class="evidence-card"><header><span>${card.code}</span><div><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.subtitle)}</p></div></header><dl>${card.rows.map(([term, description]) => `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(description)}</dd></div>`).join('')}</dl><footer>${sources.map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.organization)} · ${escapeHtml(source.date)}</a>`).join('<br>')}</footer></article>`;
    }).join('');
  }

  function createMapRegions() {
    const traits = state.run?.traits || window.CRC_SIM_ENGINE.deriveHiddenTraits(content.caseData.seed);
    const outcome = state.run?.outcome;
    const escape = outcome?.internal?.escapeFraction ?? (traits.b2mAltered ? 0.08 : 0.035);
    return [
      { id: 0, name: '肿瘤中心', x: 0.5, y: 0.5, presentation: traits.b2mAltered ? '低至中' : '中', contact: '低', perfusion: '低', clone: escape > 0.16 ? '逃逸表型富集' : '主克隆为主', note: '低灌注与空间拥挤降低有效接触。' },
      { id: 1, name: '侵袭边缘', x: 0.28, y: 0.34, presentation: '中', contact: '中至高', perfusion: '中', clone: '混合', note: 'CD8 聚集不等于已经形成有效杀伤。' },
      { id: 2, name: '血管邻近区', x: 0.72, y: 0.28, presentation: '中', contact: '中', perfusion: '较高', clone: '主克隆为主', note: '局部暴露较高，但不能代表整个病灶。' },
      { id: 3, name: '间质屏障', x: 0.73, y: 0.66, presentation: '未知', contact: '低', perfusion: '中低', clone: '未充分取样', note: '基质和趋化不匹配可造成排斥型结构。' },
      { id: 4, name: '活检区域', x: 0.34, y: 0.7, presentation: traits.mhcRetained ? '部分保留' : '局灶降低', contact: '中', perfusion: '中', clone: traits.b2mAltered ? '可能含 B2M 异常' : '未见明确异常', note: '组织面板只代表这个取样区域。' },
      { id: 5, name: '坏死邻近区', x: 0.52, y: 0.22, presentation: '不稳定', contact: '低', perfusion: '低', clone: '检测质量受限', note: '坏死和低氧可影响样本质量与局部免疫功能。' }
    ];
  }

  function renderMap() {
    mapRegions = createMapRegions();
    selectedRegionIndex = Math.max(0, Math.min(mapRegions.length - 1, state.ui.regionIndex || 0));
    const canvas = $('#ecologyCanvas');
    if (!canvas || canvas.offsetParent === null) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(640, Math.round(rect.width * dpr));
    canvas.height = Math.max(420, Math.round(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createRadialGradient(width * 0.5, height * 0.48, 20, width * 0.5, height * 0.5, width * 0.48);
    gradient.addColorStop(0, '#1a3a3f');
    gradient.addColorStop(0.58, '#0d272c');
    gradient.addColorStop(1, '#061214');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const seed = content.caseData.seed;
    const rng = window.CRC_SIM_ENGINE.mulberry32(seed + 720);
    const layer = state.ui.layer;
    for (let i = 0; i < 380; i += 1) {
      const angle = rng() * Math.PI * 2;
      const radius = Math.sqrt(rng()) * Math.min(width, height) * 0.43;
      const x = width * 0.5 + Math.cos(angle) * radius * 1.25;
      const y = height * 0.5 + Math.sin(angle) * radius * 0.84;
      const size = 1.8 + rng() * 4.2;
      if (layer === 'presentation') ctx.fillStyle = rng() > 0.38 ? 'rgba(99,230,213,.52)' : 'rgba(255,141,131,.30)';
      else if (layer === 'contact') ctx.fillStyle = rng() > 0.72 ? 'rgba(131,185,255,.72)' : 'rgba(123,69,91,.35)';
      else if (layer === 'perfusion') ctx.fillStyle = `rgba(240,195,107,${0.12 + rng() * 0.48})`;
      else ctx.fillStyle = rng() > 0.84 ? 'rgba(131,185,255,.72)' : rng() > 0.64 ? 'rgba(255,141,131,.45)' : 'rgba(99,230,213,.32)';
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    mapRegions.forEach((region, index) => {
      const x = region.x * width;
      const y = region.y * height;
      ctx.strokeStyle = index === selectedRegionIndex ? '#f0c36b' : 'rgba(238,248,245,.62)';
      ctx.lineWidth = index === selectedRegionIndex ? 3 : 1.5;
      ctx.beginPath();
      ctx.arc(x, y, index === selectedRegionIndex ? 18 : 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = index === selectedRegionIndex ? '#f0c36b' : '#eef8f5';
      ctx.font = '700 12px system-ui';
      ctx.fillText(String(index + 1), x - 3.5, y + 4);
    });

    $$('.layer-tabs button').forEach((button) => button.classList.toggle('is-active', button.dataset.layer === layer));
    $('#regionButtons').innerHTML = mapRegions.map((region, index) => `<button data-region="${index}" class="${index === selectedRegionIndex ? 'is-selected' : ''}">${index + 1}. ${escapeHtml(region.name)}</button>`).join('');
    renderRegionInspector(mapRegions[selectedRegionIndex]);
  }

  function renderRegionInspector(region) {
    if (!region) return;
    $('#regionInspector').innerHTML = `<h3>${escapeHtml(region.name)}</h3><p>${escapeHtml(region.note)}</p><div class="inspector-grid"><div><span>抗原呈递</span><strong>${escapeHtml(region.presentation)}</strong></div><div><span>CD8 有效接触</span><strong>${escapeHtml(region.contact)}</strong></div><div><span>灌注</span><strong>${escapeHtml(region.perfusion)}</strong></div><div><span>克隆信息</span><strong>${escapeHtml(region.clone)}</strong></div></div>`;
  }

  function renderCompare() {
    const ready = state.phase === 'completed' && comparisonRuns;
    $('#compareEmpty').classList.toggle('is-hidden', ready);
    $('#compareBoard').classList.toggle('is-hidden', !ready);
    if (!ready) return;
    $('#compareBoard').innerHTML = content.pathways.pathways.map((pathway) => {
      const run = comparisonRuns[pathway.id];
      const outcome = run?.outcome;
      if (!outcome) return '';
      const current = pathway.id === state.pathwayId;
      return `<article class="compare-card ${current ? 'is-current' : ''}"><p class="eyebrow">${current ? '当前路径' : '同种子反事实'}</p><h3>${escapeHtml(pathway.name)}</h3><p>${escapeHtml(pathway.gameBoundary)}</p><div class="dimension-list"><div class="dimension"><span>疾病控制</span><strong>${escapeHtml(outcome.imaging)}</strong><small>${escapeHtml(outcome.interpretation[0])}</small></div><div class="dimension"><span>生态风险</span><strong>${escapeHtml(outcome.ecology)}</strong><small>${escapeHtml(outcome.interpretation[1])}</small></div><div class="dimension"><span>治疗可持续性</span><strong>${escapeHtml(outcome.sustainability)}</strong><small>${escapeHtml(outcome.interpretation[2])}</small></div></div></article>`;
    }).join('');
  }

  function updateControlLocking() {
    const pathwayLocked = state.phase !== 'planning' || busy;
    const planLocked = state.phase !== 'planning' || busy;
    $$('.pathway').forEach((button) => { button.disabled = pathwayLocked; });
    $$('.prediction').forEach((button) => { button.disabled = planLocked; });
    $$('.hypothesis').forEach((button) => { button.disabled = busy; });
  }

  function showView(viewName, focus = true) {
    const allowed = ['command', 'ecology', 'evidence', 'compare'];
    const name = allowed.includes(viewName) ? viewName : 'command';
    state.ui.view = name;
    $$('.view').forEach((view) => view.classList.toggle('is-active', view.id === `view-${name}`));
    $$('.nav-button').forEach((button) => button.classList.toggle('is-active', button.dataset.view === name));
    if (name === 'ecology') requestAnimationFrame(renderMap);
    if (name === 'compare') renderCompare();
    if (focus) $(`#view-${name} h2`)?.focus?.({ preventScroll: false });
    persist(false).catch(console.error);
  }

  function toggleHypothesis(id) {
    if (busy) return;
    const selected = state.hypotheses.includes(id);
    if (selected && state.hypotheses.length === 1) return toast('至少保留一个假设', '机制假设板不能完全为空。');
    if (!selected && state.hypotheses.length >= 3) return toast('假设槽已满', '最多同时保留三个重点假设。');
    state.hypotheses = selected ? state.hypotheses.filter((item) => item !== id) : [...state.hypotheses, id];
    if (state.run) state.run.plan.hypotheses = [...state.hypotheses];
    addEvent('mechanism', '机制假设已修订', `当前假设：${state.hypotheses.map((item) => content.caseData.hypotheses.find((h) => h.id === item)?.name).filter(Boolean).join('、')}`);
    renderHypotheses();
    renderEvents();
    updateControlLocking();
    persist(false).catch(console.error);
  }

  function setPathway(id) {
    if (state.phase !== 'planning' || busy) return;
    if (!content.pathways.pathways.some((item) => item.id === id)) return;
    state.pathwayId = id;
    renderPathways();
    renderTestsAndTimeline();
    renderForecast();
    renderHeader();
    updateControlLocking();
    persist(false).catch(console.error);
  }

  function setTest(id, checked) {
    if (state.phase !== 'planning' || busy || id === 'imaging') return;
    state.selectedTests = checked ? [...new Set([...state.selectedTests, id])] : state.selectedTests.filter((item) => item !== id);
    renderTestsAndTimeline();
    renderForecast();
    persist(false).catch(console.error);
  }

  function togglePrediction(id) {
    if (state.phase !== 'planning' || busy) return;
    const selected = state.predictions.includes(id);
    if (selected && state.predictions.length === 1) return toast('至少保留一项预测', '提交前需要明确至少一个方向性预测。');
    state.predictions = selected ? state.predictions.filter((item) => item !== id) : [...state.predictions, id];
    renderPredictions();
    updateControlLocking();
    persist(false).catch(console.error);
  }

  async function advance() {
    if (busy || state.phase === 'completed') return;
    busy = true;
    renderHeader();
    updateControlLocking();
    try {
      if (state.phase === 'planning') {
        if (!state.hypotheses.length || !state.predictions.length) throw new Error('请先选择机制假设和方向性预测。');
        state.run = await simulation.init({
          caseData: content.caseData,
          pathways: content.pathways,
          pathwayId: state.pathwayId,
          hypotheses: state.hypotheses,
          selectedTests: state.selectedTests,
          predictions: state.predictions,
          seed: content.caseData.seed
        });
        state.phase = 'active';
        state.events = [...state.run.events];
        addEvent('clinical', '计划已提交', `路径锁定为 ${currentPathway().name}；研究性检测已订阅。`, 0);
      }
      const week = currentWeek();
      const targetWeek = MILESTONES.find((item) => item > week);
      if (!targetWeek) return;
      const result = await simulation.advance({ run: state.run, pathways: content.pathways, targetWeek });
      state.run = result.run;
      state.events = [...result.run.events];
      if (targetWeek === 8) {
        state.phase = 'completed';
        await prepareComparisons();
      }
      await persist(false);
      renderAll();
      showMilestone(result);
    } catch (error) {
      console.error(error);
      toast('无法推进', error.message || '模拟发生错误。');
    } finally {
      busy = false;
      renderHeader();
      updateControlLocking();
    }
  }

  function showMilestone(result) {
    const week = result.run.currentWeek;
    let label = `W${week} 暂停节点`;
    let title = '重新形成判断';
    let body = '';
    if (week === 2) {
      title = '研究性证据返回';
      const evidence = result.evidence || result.run.state.evidence;
      body = Object.entries(evidence || {}).map(([key, item]) => `<section class="recap-card"><strong>${key === 'ctdna' ? 'ctDNA 趋势' : 'B2M / MHC-I 面板'}</strong><p>${escapeHtml(item.status)}</p><p>${escapeHtml(item.confidence)} · ${escapeHtml(item.interpretation)}</p></section>`).join('');
      body += '<div class="notice"><b>决策边界</b><span>研究性证据只能修正置信度，不会自动更换治疗路径。</span></div>';
    } else if (week === 4) {
      title = '安全复核';
      const safety = result.safety || result.run.outcome?.safety;
      body = `<section class="recap-card"><strong>${escapeHtml(safety.label)}</strong><p>${escapeHtml(safety.action)}</p><p>血液学耐受带：${escapeHtml(safety.marrowBand)}</p></section>`;
    } else if (week === 6) {
      title = '继续治疗前复核';
      body = '<section class="recap-card"><strong>当前没有单一“正确答案”</strong><p>你可以修订机制假设，但已提交的治疗路径保持锁定。下一节点是 W8 分类影像评估。</p></section>';
    } else if (week === 8) {
      showRecap();
      return;
    }
    $('#eventDialogLabel').textContent = label;
    $('#eventDialogTitle').textContent = title;
    $('#eventDialogBody').innerHTML = body;
    $('#eventDialog').showModal();
  }

  function showRecap() {
    const outcome = state.run?.outcome;
    if (!outcome) return;
    const cards = [
      ['疾病控制', outcome.imaging, outcome.interpretation[0]],
      ['生态风险', outcome.ecology, outcome.interpretation[1]],
      ['治疗可持续性', outcome.sustainability, outcome.interpretation[2]],
      ['关键安全事件', outcome.iraeEvent?.label || '未见显著免疫相关事件', outcome.iraeEvent?.action || '仍需按路径风险继续监测']
    ];
    $('#recapGrid').innerHTML = cards.map(([label, value, text]) => `<section class="recap-card"><span class="eyebrow">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><p>${escapeHtml(text)}</p></section>`).join('');
    const labels = new Map(content.caseData.predictions.map((item) => [item.id, item.label]));
    $('#predictionReview').innerHTML = `<h3>预测复盘</h3>${state.predictions.map((id) => {
      const supported = Boolean(outcome.predictionResults[id]);
      return `<div class="prediction-result"><span>${escapeHtml(labels.get(id) || id)}</span><b class="${supported ? 'supported' : 'not-supported'}">${supported ? '得到支持' : '未得到支持 / 仍无法判断'}</b></div>`;
    }).join('')}`;
    $('#recapDialog').showModal();
  }

  async function prepareComparisons() {
    const entries = await Promise.all(content.pathways.pathways.map(async (pathway) => {
      if (pathway.id === state.pathwayId) return [pathway.id, clone(state.run)];
      const run = await simulation.simulateComplete({
        input: {
          caseData: content.caseData,
          pathways: content.pathways,
          pathwayId: pathway.id,
          hypotheses: state.hypotheses,
          selectedTests: state.selectedTests,
          predictions: state.predictions,
          seed: content.caseData.seed
        },
        pathways: content.pathways
      });
      return [pathway.id, run];
    }));
    comparisonRuns = Object.fromEntries(entries);
  }

  async function refreshSaveList() {
    const records = await window.CRC_STORAGE.list();
    $('#saveList').innerHTML = records.length
      ? records.map((record) => `<div class="save-record"><div><strong>${record.slot === AUTO_SLOT ? '自动存档' : escapeHtml(record.slot)}</strong><small>${formatDate(record.updatedAt)} · 校验 ${escapeHtml(record.checksum || '—')}</small></div><div class="save-record-actions"><button type="button" data-load-slot="${escapeHtml(record.slot)}">载入</button><button type="button" data-delete-slot="${escapeHtml(record.slot)}">删除</button></div></div>`).join('')
      : '<p class="empty-state">尚无本地存档。</p>';
  }

  function download(filename, text, type = 'application/json') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function exportSave() {
    const text = window.CRC_STORAGE.exportText(state);
    download(`crc-immune-frontier-save-${new Date().toISOString().slice(0, 10)}.json`, text);
    toast('存档已导出', '文件包含游戏状态，不包含账号或真实患者数据。');
  }

  async function importSave(file) {
    if (!file) return;
    const text = await file.text();
    const imported = window.CRC_STORAGE.importText(text);
    state = sanitizeState(imported);
    comparisonRuns = state.phase === 'completed' ? null : comparisonRuns;
    await persist(false);
    applyUiPreferences();
    renderAll();
    if (state.phase === 'completed') await prepareComparisons().then(renderCompare);
    toast('存档已导入', `已恢复到 W${currentWeek()}。`);
  }

  async function resetCase() {
    if (!window.confirm('确定重置当前病例吗？本地导出文件不会被删除。')) return;
    await window.CRC_STORAGE.remove(AUTO_SLOT);
    const preferences = state?.ui ? clone(state.ui) : null;
    state = defaultState();
    if (preferences) state.ui = { ...state.ui, ...preferences };
    comparisonRuns = null;
    $('#saveDialog').close();
    enterApp();
    toast('病例已重置', '已恢复固定种子和默认计划。');
  }

  function cycleTextScale() {
    const values = ['normal', 'large', 'xlarge'];
    const next = values[(values.indexOf(state.ui.textScale) + 1) % values.length];
    state.ui.textScale = next;
    applyUiPreferences();
    requestAnimationFrame(renderMap);
    persist(false).catch(console.error);
    toast('字号已调整', next === 'normal' ? '舒适字号（桌面默认约 18–19px）。' : next === 'large' ? '大字号模式。' : '特大字号模式。');
  }

  function startLandingAnimation() {
    const canvas = $('#landingCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const particles = Array.from({ length: 120 }, (_, index) => ({
      angle: (index / 120) * Math.PI * 2,
      radius: 65 + ((index * 47) % 230),
      speed: 0.00025 + (index % 9) * 0.00004,
      size: 2 + (index % 5),
      type: index % 11
    }));
    const draw = (time = 0) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
        canvas.width = Math.max(500, Math.round(rect.width * dpr));
        canvas.height = Math.max(400, Math.round(rect.height * dpr));
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const width = rect.width;
      const height = rect.height;
      ctx.clearRect(0, 0, width, height);
      const centerX = width * 0.5;
      const centerY = height * 0.5;
      const glow = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, Math.min(width, height) * 0.47);
      glow.addColorStop(0, 'rgba(50,160,150,.22)');
      glow.addColorStop(0.52, 'rgba(17,64,67,.34)');
      glow.addColorStop(1, 'rgba(4,15,17,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
      particles.forEach((particle) => {
        const motion = state?.ui?.reducedMotion ? 0 : time * particle.speed;
        const x = centerX + Math.cos(particle.angle + motion) * particle.radius * (width / 760);
        const y = centerY + Math.sin(particle.angle + motion) * particle.radius * 0.68 * (height / 620);
        ctx.fillStyle = particle.type === 0 ? 'rgba(131,185,255,.78)' : particle.type < 4 ? 'rgba(255,141,131,.48)' : 'rgba(99,230,213,.44)';
        ctx.beginPath();
        ctx.arc(x, y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      });
      if (!document.hidden && !$('#landing').classList.contains('is-hidden')) landingAnimation = requestAnimationFrame(draw);
    };
    cancelAnimationFrame(landingAnimation);
    landingAnimation = requestAnimationFrame(draw);
  }

  function bindEvents() {
    $('#reloadButton').addEventListener('click', () => location.reload());
    $('#clearRecoveryButton').addEventListener('click', async () => {
      await window.CRC_STORAGE.remove(AUTO_SLOT);
      location.reload();
    });
    $('#newCaseButton').addEventListener('click', startNewCase);
    $('#continueCaseButton').addEventListener('click', enterApp);
    $('#homeLink').addEventListener('click', (event) => { event.preventDefault(); showLanding(); });
    $('#landingTextButton').addEventListener('click', cycleTextScale);
    $('#textScaleButton').addEventListener('click', cycleTextScale);
    $('#advanceButton').addEventListener('click', advance);
    $('#methodButton').addEventListener('click', () => $('#methodDialog').showModal());
    $('#settingsButton').addEventListener('click', () => $('#settingsDialog').showModal());
    $('#saveButton').addEventListener('click', async () => { await refreshSaveList(); $('#saveDialog').showModal(); });
    $('#manualSaveButton').addEventListener('click', () => persist(true).then(refreshSaveList));
    $('#exportSaveButton').addEventListener('click', exportSave);
    $('#importSaveInput').addEventListener('change', (event) => importSave(event.target.files?.[0]).catch((error) => toast('导入失败', error.message)));
    $('#resetCaseButton').addEventListener('click', resetCase);

    $('#textScaleSelect').addEventListener('change', (event) => { state.ui.textScale = event.target.value; applyUiPreferences(); requestAnimationFrame(renderMap); persist(false); });
    $('#contrastToggle').addEventListener('change', (event) => { state.ui.highContrast = event.target.checked; applyUiPreferences(); persist(false); });
    $('#motionToggle').addEventListener('change', (event) => { state.ui.reducedMotion = event.target.checked; applyUiPreferences(); persist(false); });
    $('#autosaveToggle').addEventListener('change', (event) => { state.ui.autosave = event.target.checked; applyUiPreferences(); persist(true); });

    document.addEventListener('click', async (event) => {
      const nav = event.target.closest('[data-view]');
      if (nav) return showView(nav.dataset.view);
      const pathway = event.target.closest('[data-pathway]');
      if (pathway) return setPathway(pathway.dataset.pathway);
      const hypothesis = event.target.closest('[data-hypothesis]');
      if (hypothesis) return toggleHypothesis(hypothesis.dataset.hypothesis);
      const prediction = event.target.closest('[data-prediction]');
      if (prediction) return togglePrediction(prediction.dataset.prediction);
      const filter = event.target.closest('[data-filter]');
      if (filter) {
        activeFilter = filter.dataset.filter;
        $$('[data-filter]').forEach((button) => button.classList.toggle('is-active', button === filter));
        return renderEvents();
      }
      const layer = event.target.closest('[data-layer]');
      if (layer) {
        state.ui.layer = layer.dataset.layer;
        persist(false);
        return renderMap();
      }
      const region = event.target.closest('[data-region]');
      if (region) {
        state.ui.regionIndex = Number(region.dataset.region);
        persist(false);
        return renderMap();
      }
      const loadSlot = event.target.closest('[data-load-slot]');
      if (loadSlot) {
        const loaded = await window.CRC_STORAGE.load(loadSlot.dataset.loadSlot);
        if (loaded) {
          state = sanitizeState(loaded.payload);
          applyUiPreferences();
          renderAll();
          if (state.phase === 'completed') await prepareComparisons().then(renderCompare);
          $('#saveDialog').close();
          toast('存档已载入', `已恢复到 W${currentWeek()}。`);
        }
        return;
      }
      const deleteSlot = event.target.closest('[data-delete-slot]');
      if (deleteSlot && window.confirm('删除这个本地存档吗？')) {
        await window.CRC_STORAGE.remove(deleteSlot.dataset.deleteSlot);
        return refreshSaveList();
      }
    });

    document.addEventListener('change', (event) => {
      const input = event.target.closest('[data-test]');
      if (input) setTest(input.dataset.test, input.checked);
    });

    $('#ecologyCanvas').addEventListener('click', (event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      let best = 0;
      let bestDistance = Infinity;
      mapRegions.forEach((region, index) => {
        const distance = Math.hypot(x - region.x * rect.width, y - region.y * rect.height);
        if (distance < bestDistance) { best = index; bestDistance = distance; }
      });
      if (bestDistance < 60) {
        state.ui.regionIndex = best;
        persist(false);
        renderMap();
      }
    });
    $('#ecologyCanvas').addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'ArrowLeft') state.ui.regionIndex = (selectedRegionIndex - 1 + mapRegions.length) % mapRegions.length;
      if (event.key === 'ArrowRight') state.ui.regionIndex = (selectedRegionIndex + 1) % mapRegions.length;
      persist(false);
      renderMap();
    });

    $('#eventDialog').addEventListener('close', () => {
      if ($('#eventDialog').returnValue === 'evidence') showView('evidence');
    });
    $('#recapDialog').addEventListener('close', () => {
      if ($('#recapDialog').returnValue === 'compare') showView('compare');
    });
    $('#eventEvidenceButton').addEventListener('click', () => { $('#eventDialog').close('evidence'); });

    window.addEventListener('resize', () => {
      if ($('#view-ecology').classList.contains('is-active')) requestAnimationFrame(renderMap);
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !$('#landing').classList.contains('is-hidden')) startLandingAnimation();
      else cancelAnimationFrame(landingAnimation);
    });

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      installPrompt = event;
      $('#installButton').hidden = false;
    });
    $('#installButton').addEventListener('click', async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      $('#installButton').hidden = true;
    });
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    const registration = await navigator.serviceWorker.register('./sw.js');
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) $('#updateBanner').classList.remove('is-hidden');
      });
    });
    $('#updateButton').addEventListener('click', () => {
      registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
      location.reload();
    });
  }

  async function bootstrap() {
    try {
      setBootMessage('载入版本化内容包……');
      content = await window.CRC_CONTENT_LOADER.load();
      setBootMessage('检查本地存档与迁移……');
      const saved = await window.CRC_STORAGE.load(AUTO_SLOT);
      state = sanitizeState(saved?.payload || defaultState());
      applyUiPreferences();
      simulation = createSimulationClient();
      bindEvents();
      if (state.phase === 'completed') await prepareComparisons();
      $('#saveMetric').textContent = saved ? '可继续' : '新病例';
      showLanding();
      registerServiceWorker().catch((error) => console.warn('Service worker:', error));
    } catch (error) {
      showFatal(error);
    }
  }

  window.addEventListener('error', (event) => {
    if (!state) return;
    console.error(event.error || event.message);
    toast('页面发生错误', '已保留本地存档。可尝试刷新或导出存档。');
  });
  window.addEventListener('unhandledrejection', (event) => {
    console.error(event.reason);
    if (state) toast('操作未完成', event.reason?.message || '发生未处理错误。');
  });

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
