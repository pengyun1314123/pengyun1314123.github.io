/* VLMTune 前端交互逻辑 */
const API = '';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const fmt = n => Number(n).toLocaleString('en-US');

async function get(path) {
  const parts = path.split('?');
  const route = parts[0];
  const q = new URLSearchParams(parts[1] || '');
  const json = async name => {
    const r = await fetch('api/' + name + '.json');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  };
  switch (route) {
    case '/api/health':    return json('health');
    case '/api/pipeline':  return json('pipeline');
    case '/api/sft':       return json('sft');
    case '/api/multimodal':return json('multimodal');
    case '/api/methods':   return json('methods');
    case '/api/attention': return json('attention');
    case '/api/lora':
      return VLMStaticAPI.lora({
        r: q.get('r'), alpha: q.get('alpha'), d: q.get('d'), layers: q.get('layers')
      });
    case '/api/training/simulate':
      return VLMStaticAPI.simulate({
        steps: q.get('steps'), method: q.get('method'), quality: q.get('quality')
      });
    case '/api/tokenize':
      return VLMStaticAPI.tokenize(q.get('text') || '大模型训练');
    default:
      throw new Error('未知静态接口: ' + route);
  }
}

/* ---------- NAV ---------- */
const SECTION_NAMES = { overview: '总览首页', architecture: '架构实验室', pipeline: '数据流水线', finetune: '微调游乐场', multimodal: '多模态世界', docs: '知识文档' };
function goto(name, skipHash) {
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.section === name));
  $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + name));
  $('#crumb').textContent = SECTION_NAMES[name] || name;
  if (!skipHash && location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
}
window.addEventListener('hashchange', () => {
  const n = location.hash.replace('#', '');
  if (SECTION_NAMES[n]) goto(n, true);
});
$$('.nav-item').forEach(n => n.addEventListener('click', () => goto(n.dataset.section)));
$$('[data-goto]').forEach(b => b.addEventListener('click', () => goto(b.dataset.goto)));
const initialSection = location.hash.replace('#', '');
if (SECTION_NAMES[initialSection]) goto(initialSection, true);

/* ---------- CARDS ---------- */
const LEARNING = [
  { s: 1, ico: '⬡', t: '架构实验室', d: '3D 看 Transformer 结构，真实数值算注意力热力图，亲手试试 BPE 分词。', to: 'architecture' },
  { s: 2, ico: '⇶', t: '数据流水线', d: '8 篇故意埋了脏数据的样例，走完 12 道工序，看每一步的输入与产物。', to: 'pipeline' },
  { s: 3, ico: '◉', t: '微调游乐场', d: '拖动 r / α 看 LoRA 参数量与显存变化，读带注解代码，模拟 loss 曲线。', to: 'finetune' },
  { s: 4, ico: '▣', t: '多模态世界', d: '理解 ViT + 投影层 + LLM 的对齐桥梁，看图像 token 如何逐阶段流转。', to: 'multimodal' },
  { s: 5, ico: '▤', t: '知识文档', d: '三篇系统化 Markdown 文档：架构与公式、微调原理与代码、数据全流程。', to: 'docs' },
  { s: 6, ico: '▶', t: '直接开跑', d: '后端还提供分词、参数计算、注意力、训练模拟等 API，可自由调用扩展。', to: 'pipeline' },
];
$('#learningPath').innerHTML = LEARNING.map(l => `<div class="lp-card" data-goto="${l.to}"><span class="lp-step">STEP ${l.s}</span><div class="lp-ico">${l.ico}</div><h4>${l.t}</h4><p>${l.d}</p></div>`).join('');
$$('#learningPath [data-goto]').forEach(c => c.addEventListener('click', () => goto(c.dataset.goto)));

const DOCS = [
  { ico: '⬡', t: '01 · 架构知识点与核心公式', d: '语言建模目标、Transformer 全解、RoPE / SwiGLU / GQA、多模态架构、公式速查表。', file: 'docs/01-architecture.html' },
  { ico: '◉', t: '02 · 微调方法原理与代码注解', d: '全量 / LoRA / QLoRA / Adapter / Prefix / P-Tuning / RLHF / DPO，逐行代码注解。', file: 'docs/02-finetuning.html' },
  { ico: '⇶', t: '03 · 训练数据全流程', d: '12 个阶段逐一拆解，含样例数据集各阶段输入输出产物、SFT 与多模态数据。', file: 'docs/03-data-pipeline.html' },
];
$('#docGrid').innerHTML = DOCS.map(d => `<div class="doc-card"><a href="${d.file}" target="_blank"><div class="doc-ico">${d.ico}</div><h4>${d.t}</h4><p>${d.d}</p><span class="doc-link">打开文档 ↗</span></a></div>`).join('');

/* ---------- HEALTH ---------- */
get('/api/health').then(d => {
  $('#backendStatus').textContent = '静态版已就绪 · ' + d.service;
  $('.status-dot').classList.add('ok');
}).catch(() => { $('#backendStatus').textContent = '后端未连接'; });

/* ---------- 3D ---------- */
window.addEventListener('load', () => {
  try {
    VLMVisuals.initHero($('#heroCanvas'));
    VLMVisuals.initArch($('#archCanvas'));
    VLMVisuals.initMM($('#mmCanvas'));
  } catch (e) { console.warn('3D init failed', e); }
});

/* ---------- ATTENTION HEATMAP ---------- */
function renderHeatmap(d) {
  const el = $('#attnHeatmap'); const n = d.tokens.length;
  el.style.gridTemplateColumns = `60px repeat(${n}, 46px)`;
  let html = '<div></div>' + d.tokens.map(t => `<div class="hm-label">${esc(t)}</div>`).join('');
  d.attention.forEach((row, i) => {
    html += `<div class="hm-label">${esc(d.tokens[i])}</div>`;
    row.forEach((v, j) => {
      const alpha = 0.12 + v * 0.88;
      const color = j > i ? `rgba(90,105,140,0.10)` : `rgba(34,211,238,${alpha.toFixed(3)})`;
      html += `<div class="hm-cell" style="background:${color}" title="${esc(d.tokens[i])} → ${esc(d.tokens[j])}: ${v}">${j > i ? '' : v.toFixed(2)}</div>`;
    });
  });
  el.innerHTML = html;
  $('#attnNote').textContent = d.explanation;
}
get('/api/attention').then(renderHeatmap).catch(e => $('#attnNote').textContent = '加载失败：' + e.message);

/* ---------- TOKENIZER ---------- */
async function doTokenize() {
  const text = $('#tokenInput').value.trim() || '大模型训练';
  $('#tokenResult').textContent = '计算中…';
  try {
    const d = await get('/api/tokenize?text=' + encodeURIComponent(text));
    $('#tokenResult').innerHTML = d.tokens.map((t, i) =>
      `<div class="tok">${esc(t === '</w>' ? '␣' : t)}<span class="tok-id">${d.ids[i]}</span></div>`).join('') +
      `<div style="width:100%;font-size:11px;color:var(--muted);margin-top:8px">词表大小 ${d.vocab_size} · token 数 ${d.tokens.length} · 合并示例：${d.merge_examples.slice(0, 3).map(m => esc(m[0]) + '+' + esc(m[1]) + '→' + esc(m[2])).join(' , ') || '（输入词未在迷你语料中出现，退化为字符级）'}</div>`;
  } catch (e) { $('#tokenResult').textContent = '失败：' + e.message; }
}
$('#tokenBtn').addEventListener('click', doTokenize);
$('#tokenInput').addEventListener('keydown', e => { if (e.key === 'Enter') doTokenize(); });

/* ---------- PIPELINE ---------- */
let pipelineData = null;
get('/api/pipeline').then(d => {
  pipelineData = d;
  $('#pipelineMeta').textContent = `原始 ${d.raw_count} 篇 → 安全语料 ${d.safe_count} 篇 · 共 ${d.total_tokens} tokens · 词表 ${d.tokenizer_info.vocab_size}`;
  $('#stageStrip').innerHTML = d.stages.map((s, i) =>
    `<div class="stage-chip ${i === 0 ? 'active' : ''}" data-i="${i}"><div class="sc-n">${String(s.id).padStart(2, '0')}</div><div class="sc-name">${esc(s.name)}</div></div>`).join('');
  $$('.stage-chip').forEach(c => c.addEventListener('click', () => {
    $$('.stage-chip').forEach(x => x.classList.remove('active'));
    c.classList.add('active'); renderStage(d.stages[+c.dataset.i]);
  }));
  renderStage(d.stages[0]);
}).catch(e => $('#stageBody').textContent = '加载失败：' + e.message);

function renderStage(s) {
  $('#stageTitle').textContent = `${String(s.id).padStart(2, '0')} · ${s.name}`;
  $('#stageEn').textContent = s.en;
  let stats = '';
  for (const [k, v] of Object.entries(s.stats || {})) {
    if (Array.isArray(v)) continue;
    stats += `<span class="stat-pill">${esc(k)}: <b>${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</b></span>`;
  }
  // 数组类统计用样例块呈现
  let samples = '';
  (s.samples || []).slice(0, 3).forEach((sm, idx) => {
    samples += `<div class="sample-box">${Object.entries(sm).map(([k, v]) =>
      `<span class="key">${esc(k)}:</span> ${esc(typeof v === 'object' ? JSON.stringify(v) : v)}`).join('\n')}</div>`;
  });
  $('#stageBody').innerHTML = `
    <div class="stage-detail">
      <div class="sd-block"><div class="sd-label">输入 Input</div><div class="sd-val">${esc(s.input)}</div></div>
      <div class="sd-block"><div class="sd-label">产物 Output</div><div class="sd-val"><code>${esc(s.output)}</code></div></div>
      <div class="sd-block full"><div class="sd-label">处理逻辑 Process</div><div class="sd-val">${esc(s.process)}</div>
        ${s.formula ? `<div class="formula-box" style="margin-top:10px">${esc(s.formula)}</div>` : ''}
        <div class="stat-row">${stats}</div></div>
      ${samples ? `<div class="sd-block full"><div class="sd-label">真实样例 / 产物片段</div>${samples}</div>` : ''}
    </div>
    <div class="sd-tip">💡 ${esc(s.tip)}</div>`;
}

/* ---------- SFT ---------- */
let sftData = null;
get('/api/sft').then(d => { sftData = d; renderSFT('sample'); }).catch(e => $('#sftContent').textContent = '加载失败');
function renderSFT(mode) {
  if (!sftData) return;
  const list = mode === 'sample' ? sftData.samples : sftData.rendered;
  $('#sftContent').innerHTML = list.map(x => `<div class="sft-item"><div class="sf-h">${esc(x.id)}</div>
    <div class="sample-box" style="margin-top:0">${esc(mode === 'sample' ? JSON.stringify(x, null, 2) : x.rendered)}</div></div>`).join('') +
    `<p class="cap">${esc(sftData.note)}</p>`;
}
$$('[data-sfttab]').forEach(t => t.addEventListener('click', () => {
  $$('[data-sfttab]').forEach(x => x.classList.remove('active'));
  t.classList.add('active'); renderSFT(t.dataset.sfttab);
}));

/* ---------- LORA CALC ---------- */
const LORA_INPUTS = ['loraR', 'loraAlpha', 'loraD', 'loraLayers'];
LORA_INPUTS.forEach(id => {
  const el = $('#' + id), out = $('#' + id + 'Val');
  el.addEventListener('input', () => { out.textContent = el.value; updateLoRA(); });
});
async function updateLoRA() {
  const q = `?r=${$('#loraR').value}&alpha=${$('#loraAlpha').value}&d=${$('#loraD').value}&layers=${$('#loraLayers').value}`;
  try {
    const d = await get('/api/lora' + q);
    $('#loraMetrics').innerHTML = `
      <div class="metric"><b>${fmt(d.single_layer.full_params)}</b><span>单层全量参数</span></div>
      <div class="metric"><b>${fmt(d.single_layer.lora_params)}</b><span>单层 LoRA 参数</span></div>
      <div class="metric"><b>${d.single_layer.compression_ratio}×</b><span>单层压缩比</span></div>
      <div class="metric"><b>${d.whole_model.trainable_percent}%</b><span>整模型可训练占比</span></div>`;
    const mem = d.memory_gb, max = Math.max(...Object.values(mem));
    const bar = (label, val, cls) => `<div class="bar-row"><span class="bar-label">${label}</span><div class="bar-track"><div class="bar-fill ${cls}" style="width:${(val / max * 100).toFixed(1)}%">${val} GB</div></div></div>`;
    $('#memChart').innerHTML = bar('全量微调', mem.full_finetune, 'bar-full') + bar('LoRA', mem.lora, 'bar-lora') + bar('QLoRA', mem.qlora, 'bar-qlora');
    $('#loraNote').textContent = d.note + ` 若用 7B 级配置：全量需 ${mem.full_finetune}GB、LoRA ${mem.lora}GB、QLoRA 仅 ${mem.qlora}GB（含权重+梯度+优化器状态估算）。`;
  } catch (e) { console.error(e); }
}
updateLoRA();

/* ---------- METHODS ---------- */
get('/api/methods').then(d => {
  $('#methodsTable').innerHTML = `<table class="method-table"><thead><tr><th>方法</th><th>可训练参数</th><th>推理延迟</th><th>显存</th><th>优势</th><th>局限 / 场景</th></tr></thead><tbody>` +
    d.methods.map(m => `<tr><td class="mname">${esc(m.name)}<br><span style="font-size:10px;color:var(--muted);font-family:var(--mono)">${esc(m.en)}</span></td>
      <td><span class="pill">${esc(m.params)}</span></td><td>${esc(m.latency)}</td><td>${esc(m.memory)}</td>
      <td>${esc(m.pros)}</td><td>${esc(m.cons)}<br><span style="color:var(--cyan)">→ ${esc(m.use)}</span></td></tr>`).join('') + '</tbody></table>';
}).catch(() => {});

/* ---------- TRAINING SIM ---------- */
function drawChart(d) {
  const c = $('#lossChart'), ctx = c.getContext('2d');
  const W = c.width = c.clientWidth * 2, H = c.height = c.clientHeight * 2;
  ctx.scale(2, 2); const w = W / 2, h = H / 2;
  ctx.clearRect(0, 0, w, h);
  const pad = { l: 42, r: 12, t: 14, b: 26 };
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
  const maxLoss = Math.max(...d.losses), minLoss = Math.min(...d.losses);
  const maxLr = Math.max(...d.lrs);
  // grid
  ctx.strokeStyle = 'rgba(90,110,150,0.16)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ph * i / 4;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.fillStyle = '#6b7c9c'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
    ctx.fillText((maxLoss - (maxLoss - minLoss) * i / 4).toFixed(1), pad.l - 6, y + 3);
  }
  function line(data, color, max, min) {
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
    data.forEach((v, i) => {
      const x = pad.l + pw * i / (data.length - 1);
      const y = pad.t + ph * (1 - (v - (min || 0)) / (max - (min || 0) || 1));
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
  }
  line(d.losses, '#22d3ee', maxLoss, minLoss - 0.1);
  line(d.lrs, '#a78bfa', maxLr, 0);
  // checkpoints
  d.checkpoints.forEach(cp => {
    const x = pad.l + pw * (cp.step - 1) / (d.steps - 1);
    const idx = cp.step - 1, y = pad.t + ph * (1 - (d.losses[idx] - (minLoss - 0.1)) / (maxLoss - (minLoss - 0.1)));
    ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
  });
  ctx.fillStyle = '#6b7c9c'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
  ctx.fillText('0', pad.l, h - 8); ctx.fillText('step ' + d.steps, w - pad.r - 20, h - 8);
}
async function runSim() {
  const q = `?steps=${$('#simSteps').value}&method=${$('#simMethod').value}&quality=${(+$('#simQuality').value / 100).toFixed(2)}`;
  try {
    const d = await get('/api/training/simulate' + q);
    drawChart(d);
    $('#simResult').innerHTML = `<div>${esc(d.summary)}</div><div class="ck-list">${d.checkpoints.map(c =>
      `<span class="ck">step ${c.step} · loss ${c.loss} · PPL ${c.ppl}</span>`).join('')}</div>`;
  } catch (e) { $('#simResult').textContent = '失败：' + e.message; }
}
$('#simBtn').addEventListener('click', runSim);
$('#simQuality').addEventListener('input', e => $('#simQualityVal').textContent = e.target.value + '%');
runSim();

/* ---------- MULTIMODAL ---------- */
get('/api/multimodal').then(d => {
  $('#mmFlow').innerHTML = d.steps.map(s => `<div class="mm-step"><div class="ms-n">${esc(s.stage)}</div><h5>${esc(s.artifact.split('（')[0].slice(0, 28))}</h5><div class="ms-art">${esc(s.artifact)}</div><div class="ms-shape">${esc(s.shape)}</div></div>`).join('');
  const c = d.sample.conversations;
  $('#mmSample').innerHTML = `<div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:10px">样例：${esc(d.sample.image)} · ${esc(d.sample.image_meta.size)} · ${esc(d.sample.image_meta.num_patches)} patches</div>` +
    c.map(x => `<div style="margin:6px 0"><span style="color:${x.from === 'human' ? 'var(--cyan)' : 'var(--green)'};font-family:var(--mono);font-size:11px">${x.from === 'human' ? '👤 用户' : '🤖 助手'}:</span> ${esc(x.value)}</div>`).join('');
}).catch(() => {});
