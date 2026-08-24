(function initSimulationEngine(scope) {
  'use strict';

  const ENGINE_VERSION = '0.7.0';
  const TICKS_PER_DAY = 4;
  const DAYS_PER_WEEK = 7;
  const MILESTONES = Object.freeze([0, 2, 4, 6, 8]);

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function random() {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function deriveHiddenTraits(seed) {
    const rng = mulberry32(seed + 1103);
    return {
      b2mAltered: rng() < 0.62,
      mhcRetained: rng() < 0.48,
      nkCompensation: rng() < 0.52,
      spatialBarrier: 0.18 + rng() * 0.46,
      ctDnaShedding: 0.28 + rng() * 0.62,
      immuneReserve: 0.48 + rng() * 0.42,
      iraeSusceptibility: 0.35 + rng() * 0.65,
      marrowReserve: 0.72 + rng() * 0.25,
      ifnSignalLoss: rng() < 0.18
    };
  }

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function pathwayById(pathways, pathwayId) {
    const list = pathways && Array.isArray(pathways.pathways) ? pathways.pathways : [];
    return list.find((item) => item.id === pathwayId) || list[0];
  }

  function initializeRun({ caseData, pathways, pathwayId, hypotheses, selectedTests, predictions, seed }) {
    if (!caseData || !pathways) throw new Error('Missing case or pathway content.');
    const pathway = pathwayById(pathways, pathwayId);
    if (!pathway) throw new Error('No valid pathway is available.');
    const resolvedSeed = Number.isFinite(Number(seed)) ? Number(seed) : Number(caseData.seed) || 2107;
    const traits = deriveHiddenTraits(resolvedSeed);
    const escapeBaseline = traits.b2mAltered ? 0.055 : 0.026;
    const sensitiveBaseline = 1 - escapeBaseline;
    return {
      engineVersion: ENGINE_VERSION,
      caseId: caseData.id,
      pathwayId: pathway.id,
      seed: resolvedSeed,
      currentTick: 0,
      currentWeek: 0,
      targetWeek: 0,
      plan: {
        hypotheses: [...new Set(hypotheses || [])].slice(0, 3),
        selectedTests: [...new Set(selectedTests || [])],
        predictions: [...new Set(predictions || [])]
      },
      traits,
      state: {
        sensitive: sensitiveBaseline,
        escape: escapeBaseline,
        immuneActivity: traits.immuneReserve,
        reversibleExhaustion: 0.58,
        immuneExposure: 0,
        cytotoxicExposure: 0,
        vascularEffect: 0,
        perfusion: 0.46,
        marrow: traits.marrowReserve,
        neuropathy: 0.02,
        iraeLoad: 0,
        iraeEvent: null,
        contactEfficiency: clamp(0.72 - traits.spatialBarrier * 0.55, 0.25, 0.75),
        evidence: {},
        stopped: false
      },
      snapshots: [],
      events: [
        {
          week: 0,
          type: 'clinical',
          title: '基线已建立',
          text: 'MSI-H / dMMR 已确认；B2M / MHC-I 状态和空间异质性仍未知。'
        }
      ],
      completed: false,
      outcome: null
    };
  }

  function scheduledAtTick(pathway, tick) {
    const day = tick / TICKS_PER_DAY;
    return (pathway.schedule || []).filter((event) => event.week < 8 && Math.abs(day - event.week * DAYS_PER_WEEK) < 0.001);
  }

  function applyTreatmentPulse(run, pathway, event) {
    const model = pathway.model || {};
    if (pathway.id === 'pembro' || pathway.id === 'nivoipi') {
      run.state.immuneExposure = clamp(run.state.immuneExposure + Number(model.immunePressure || 0.6) * 0.72, 0, 1.5);
      run.events.push({ week: event.week, type: 'clinical', title: event.label, text: '按固定路径节点执行；游戏不模拟真实剂量。' });
    } else {
      run.state.cytotoxicExposure = clamp(run.state.cytotoxicExposure + Number(model.cytotoxicPressure || 0.6), 0, 1.5);
      run.state.vascularEffect = clamp(run.state.vascularEffect + 0.62, 0, 1.3);
      run.state.marrow = clamp(run.state.marrow - Number(model.marrowRisk || 0) * 0.13, 0.05, 1);
      run.state.neuropathy = clamp(run.state.neuropathy + Number(model.neuropathyRisk || 0) * 0.055, 0, 1);
      run.events.push({ week: event.week, type: 'clinical', title: event.label, text: '联合周期已执行；抗 VEGF 仅作为方案组成影响暴露分布。' });
    }
  }

  function tickRun(run, pathway, rng) {
    const s = run.state;
    for (const event of scheduledAtTick(pathway, run.currentTick)) applyTreatmentPulse(run, pathway, event);

    s.immuneExposure *= 0.995;
    s.cytotoxicExposure *= 0.90;
    s.vascularEffect *= 0.965;

    const perfusionTarget = 0.44 + Math.min(0.16, s.vascularEffect * 0.18) - Math.max(0, s.vascularEffect - 0.95) * 0.14;
    s.perfusion += (perfusionTarget - s.perfusion) * 0.045;
    s.perfusion = clamp(s.perfusion, 0.22, 0.72);

    const antigenPresentationSensitive = run.traits.ifnSignalLoss ? 0.36 : 0.78;
    const antigenPresentationEscape = run.traits.ifnSignalLoss
      ? 0.09
      : run.traits.b2mAltered
        ? (run.traits.mhcRetained ? 0.42 : 0.16)
        : 0.68;
    const contact = clamp(s.contactEfficiency * (0.82 + s.perfusion * 0.38), 0.18, 0.92);
    const exhaustionRecovery = s.immuneExposure * (0.0048 + (run.plan.hypotheses.includes('exhaustion') ? 0.0008 : 0));
    s.reversibleExhaustion = clamp(s.reversibleExhaustion - exhaustionRecovery + 0.0012, 0.12, 0.88);
    const immuneFunction = clamp(s.immuneActivity * (1 - s.reversibleExhaustion * 0.58) * (run.traits.ifnSignalLoss ? 0.58 : 1), 0.05, 0.92);

    const immuneKillSensitive = s.immuneExposure * immuneFunction * antigenPresentationSensitive * contact * 0.022;
    const immuneKillEscape = s.immuneExposure * immuneFunction * antigenPresentationEscape * contact * 0.013;
    const nkKillEscape = run.traits.nkCompensation * (1 - antigenPresentationEscape) * (0.0016 + s.immuneExposure * 0.0012);
    const cytotoxicModifier = 0.62 + s.perfusion * 0.68;
    const chemoKillSensitive = s.cytotoxicExposure * cytotoxicModifier * 0.027;
    const chemoKillEscape = s.cytotoxicExposure * cytotoxicModifier * 0.021;

    const carrying = 1.55;
    const total = s.sensitive + s.escape;
    const density = clamp(1 - total / carrying, -0.45, 1);
    const sensitiveGrowth = 0.0033 * density;
    const escapeCost = run.traits.b2mAltered ? 0.00055 : 0.0002;
    const escapeGrowth = (0.00335 - escapeCost) * density;

    const noiseS = (rng() - 0.5) * 0.0008;
    const noiseE = (rng() - 0.5) * 0.0008;
    s.sensitive = Math.max(0.002, s.sensitive * (1 + sensitiveGrowth + noiseS - immuneKillSensitive - chemoKillSensitive));
    s.escape = Math.max(0.001, s.escape * (1 + escapeGrowth + noiseE - immuneKillEscape - nkKillEscape - chemoKillEscape));

    s.immuneActivity = clamp(s.immuneActivity + s.immuneExposure * 0.0018 - s.cytotoxicExposure * 0.0024 - 0.0005, 0.12, 0.95);
    const marrowDamage = s.cytotoxicExposure * Number(pathway.model?.marrowRisk || 0) * 0.012;
    s.marrow = clamp(s.marrow - marrowDamage + (s.cytotoxicExposure < 0.08 ? 0.0018 : 0.00025), 0.05, 1);
    s.neuropathy = clamp(s.neuropathy + s.cytotoxicExposure * Number(pathway.model?.neuropathyRisk || 0) * 0.0042, 0, 1);

    if (!s.iraeEvent && Number(pathway.model?.iraeRisk || 0) > 0) {
      s.iraeLoad += s.immuneExposure * Number(pathway.model.iraeRisk) * run.traits.iraeSusceptibility * 0.0038;
      const trigger = 0.14 + rng() * 0.06;
      if (s.iraeLoad > trigger) {
        const selector = rng();
        s.iraeEvent = selector < 0.22
          ? { organ: '结肠', grade: 'G2', label: '结肠炎样事件 · G2', action: '暂停并评估处理' }
          : selector < 0.58
            ? { organ: '内分泌', grade: 'G1', label: '甲状腺炎样事件 · G1', action: '监测并进行器官特异评估' }
            : { organ: '皮肤', grade: 'G1', label: '皮疹样事件 · G1', action: '观察并进行支持处理' };
      }
    }

    run.currentTick += 1;
    run.currentWeek = run.currentTick / (TICKS_PER_DAY * DAYS_PER_WEEK);
  }

  function snapshot(run, week) {
    const s = run.state;
    const total = s.sensitive + s.escape;
    const escapeFraction = s.escape / total;
    return {
      week,
      burdenIndex: Number(total.toFixed(4)),
      escapeFraction: Number(escapeFraction.toFixed(4)),
      immuneActivity: Number(s.immuneActivity.toFixed(4)),
      perfusion: Number(s.perfusion.toFixed(4)),
      marrow: Number(s.marrow.toFixed(4)),
      neuropathy: Number(s.neuropathy.toFixed(4)),
      iraeEvent: s.iraeEvent ? copy(s.iraeEvent) : null
    };
  }

  function evidenceAtWeek2(run, rng) {
    const s = run.state;
    const total = s.sensitive + s.escape;
    const escapeFraction = s.escape / total;
    const evidence = {};
    if (run.plan.selectedTests.includes('ctdna')) {
      const detectionProbability = clamp(run.traits.ctDnaShedding * (0.28 + escapeFraction * 5.6), 0.08, 0.94);
      const detected = rng() < detectionProbability;
      evidence.ctdna = detected
        ? {
            status: '检出相关低水平信号',
            confidence: detectionProbability > 0.65 ? '中等置信' : '低至中置信',
            interpretation: '信号支持继续关注克隆异质性，但不能单独决定换药。'
          }
        : {
            status: '未检出明确相关信号',
            confidence: run.traits.ctDnaShedding < 0.45 ? '低置信' : '中等置信',
            interpretation: '未检出不能排除低释放或低频克隆造成的假阴性。'
          };
    }
    if (run.plan.selectedTests.includes('b2m')) {
      const sampleHitsAlteredRegion = run.traits.b2mAltered && rng() < 0.72;
      evidence.b2m = sampleHitsAlteredRegion
        ? run.traits.mhcRetained
          ? {
              status: '检出 B2M 异常信号；MHC-I 仍部分保留',
              confidence: '区域性中等置信',
              interpretation: '结果支持呈递异质性，但不能推断全病灶或必然耐药。'
            }
          : {
              status: '局灶 B2M 蛋白下降并伴 MHC-I 降低',
              confidence: '区域性中等置信',
              interpretation: '可能降低部分 CD8 识别；仍需考虑取样偏差与非 CD8 压力。'
            }
        : {
            status: '本次取样未见明确 B2M / MHC-I 缺失',
            confidence: '有限置信',
            interpretation: '结果仅代表取样区域，不能排除未取样区域的异质性。'
          };
    }
    run.state.evidence = { ...run.state.evidence, ...evidence };
    return evidence;
  }

  function safetyAtWeek4(run) {
    const s = run.state;
    let label = '可继续当前路径';
    let action = '保持监测';
    if (s.marrow < 0.42) {
      label = '血液学耐受需要调整';
      action = '游戏内建议延迟下一周期；不对应真实临床阈值';
    }
    if (s.iraeEvent?.grade === 'G2') {
      label = s.iraeEvent.label;
      action = s.iraeEvent.action;
    } else if (s.iraeEvent) {
      label = s.iraeEvent.label;
      action = s.iraeEvent.action;
    }
    return { label, action, marrowBand: s.marrow >= 0.68 ? '充足' : s.marrow >= 0.42 ? '下降' : '明显下降' };
  }

  function finalOutcome(run, pathway) {
    const initial = run.snapshots.find((item) => item.week === 0) || { burdenIndex: 1 };
    const latest = snapshot(run, 8);
    const ratio = latest.burdenIndex / initial.burdenIndex;
    const immunePathway = pathway.id !== 'folfoxbev';
    let imaging;
    if (ratio <= 0.72) imaging = '明确控制';
    else if (ratio <= 1.08) imaging = '基本稳定';
    else imaging = immunePathway ? '疑似进展（临床稳定时需后续确认）' : '进展趋势';

    const initialEscape = initial.escapeFraction || 0.04;
    const escapeChange = latest.escapeFraction - initialEscape;
    let ecology;
    if (escapeChange > 0.11) ecology = '生态风险上升';
    else if (escapeChange > 0.035 || run.state.evidence.b2m) ecology = '仍有不确定性';
    else ecology = '风险相对较低';

    let sustainability = '可持续';
    if (latest.marrow < 0.42 || latest.neuropathy > 0.58 || run.state.iraeEvent?.grade === 'G2') sustainability = '需要暂停或调整';
    else if (latest.marrow < 0.67 || latest.neuropathy > 0.28 || run.state.iraeEvent) sustainability = '需要密切管理';

    const predictionResults = {};
    for (const id of run.plan.predictions) {
      if (id === 'disease_control') predictionResults[id] = imaging === '明确控制' || imaging === '基本稳定';
      if (id === 'ecology_risk') predictionResults[id] = ecology === '生态风险上升';
      if (id === 'ctdna_uncertain') predictionResults[id] = Boolean(run.state.evidence.ctdna);
      if (id === 'toxicity') predictionResults[id] = sustainability !== '可持续';
    }

    return {
      imaging,
      ecology,
      sustainability,
      safety: safetyAtWeek4(run),
      evidence: copy(run.state.evidence),
      iraeEvent: run.state.iraeEvent ? copy(run.state.iraeEvent) : null,
      internal: {
        burdenRatio: Number(ratio.toFixed(4)),
        escapeFraction: latest.escapeFraction,
        marrow: latest.marrow,
        neuropathy: latest.neuropathy
      },
      predictionResults,
      interpretation: [
        imaging === '明确控制'
          ? '疾病负荷方向支持当前路径产生控制。'
          : imaging === '基本稳定'
            ? '当前评估更接近稳定，尚不能把短期稳定解释为长期生态胜利。'
            : '当前出现进展方向；免疫路径中的疑似进展不自动等于确认进展。',
        ecology === '生态风险上升'
          ? '低频逃逸表型的相对比例上升，疾病控制与生态控制发生分离。'
          : ecology === '仍有不确定性'
            ? '现有检测提供了线索，但取样、检测下限或机制替代使结论仍不完整。'
            : '当前未见强烈生态恶化信号，但不等于已排除低频异质性。',
        sustainability === '可持续'
          ? '在本模型的简化安全维度中，当前路径仍可持续。'
          : '毒性或生理储备已影响后续治疗窗口，需要管理、暂停或调整。'
      ]
    };
  }

  function advanceRun(runInput, pathways, targetWeek) {
    const run = copy(runInput);
    const pathway = pathwayById(pathways, run.pathwayId);
    if (!pathway) throw new Error('Pathway not found.');
    const normalizedTarget = MILESTONES.includes(Number(targetWeek)) ? Number(targetWeek) : 8;
    if (normalizedTarget < run.currentWeek) throw new Error('Cannot move simulation backward.');
    const rng = mulberry32(run.seed + run.currentTick * 17 + normalizedTarget * 101);

    if (!run.snapshots.some((item) => item.week === 0)) run.snapshots.push(snapshot(run, 0));
    const targetTick = normalizedTarget * DAYS_PER_WEEK * TICKS_PER_DAY;
    while (run.currentTick < targetTick && !run.state.stopped) tickRun(run, pathway, rng);
    run.currentWeek = normalizedTarget;
    if (!run.snapshots.some((item) => item.week === normalizedTarget)) run.snapshots.push(snapshot(run, normalizedTarget));

    const milestone = { week: normalizedTarget, type: 'mechanism', title: `W${normalizedTarget} 节点已到达`, text: '系统在预设的临床或研究节点暂停，等待重新判断。' };
    const payload = { run, milestone, evidence: null, safety: null, outcome: null };

    if (normalizedTarget === 2) {
      payload.evidence = evidenceAtWeek2(run, rng);
      run.events.push({ week: 2, type: 'research', title: '研究性证据返回', text: 'ctDNA 与组织面板只能修正置信度，不能自动替玩家决定治疗。' });
    }
    if (normalizedTarget === 4) {
      payload.safety = safetyAtWeek4(run);
      run.events.push({ week: 4, type: 'clinical', title: '安全复核', text: `${payload.safety.label}；${payload.safety.action}` });
    }
    if (normalizedTarget === 6) {
      run.events.push({ week: 6, type: 'mechanism', title: '继续治疗前复核', text: '重新比较疾病方向、生态风险和治疗可持续性。' });
    }
    if (normalizedTarget === 8) {
      run.completed = true;
      run.outcome = finalOutcome(run, pathway);
      payload.outcome = copy(run.outcome);
      run.events.push({ week: 8, type: 'clinical', title: 'W8 分类评估完成', text: `${run.outcome.imaging}；${run.outcome.ecology}；${run.outcome.sustainability}` });
    }
    run.events.push(milestone);
    payload.run = run;
    return payload;
  }

  function simulateComplete(input, pathways) {
    let run = initializeRun(input);
    for (const week of [2, 4, 6, 8]) run = advanceRun(run, pathways, week).run;
    return run;
  }

  const api = Object.freeze({
    ENGINE_VERSION,
    TICKS_PER_DAY,
    DAYS_PER_WEEK,
    MILESTONES,
    clamp,
    mulberry32,
    deriveHiddenTraits,
    initializeRun,
    advanceRun,
    simulateComplete
  });

  scope.CRC_SIM_ENGINE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
