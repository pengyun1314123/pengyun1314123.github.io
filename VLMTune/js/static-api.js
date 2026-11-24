/* VLMTune 静态模式：浏览器端复刻后端计算，使 GitHub Pages 上交互仍可用。
   由 tools/build_static.py 复制到 site/js/static-api.js，请勿直接编辑副本。 */
(function (global) {
  'use strict';

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function toInt(v, d) { const n = parseInt(v, 10); return isNaN(n) ? d : n; }
  function toFloat(v, d) { const n = parseFloat(v); return isNaN(n) ? d : n; }
  function round(v, digits) { const p = Math.pow(10, digits); return Math.round(v * p) / p; }

  /* ---- Python random.Random 兼容实现（MT19937 + gauss） ----
     必须逐位复刻，否则训练模拟的 loss 数值会与后端不一致。
     Python random.seed(int) 走 init_by_array([abs(seed)])，gauss 用
     x2pi / g2rad 形式并缓存第二个正态样本。 */
  function pyRandom(seed) {
    const N = 624, M = 397, MATRIX_A = 0x9908b0df;
    const upper = 0x80000000, lower = 0x7fffffff;
    const mag01 = [0, MATRIX_A];
    const mt = new Array(N);
    let mti = N + 1;

    function initGenrand(s) {
      mt[0] = s >>> 0;
      for (let i = 1; i < N; i++) {
        mt[i] = (Math.imul(1812433253, mt[i - 1] ^ (mt[i - 1] >>> 30)) + i) >>> 0;
      }
      mti = N;
    }

    function initByArray(key) {
      initGenrand(19650218);
      let i = 1, j = 0;
      let k = Math.max(N, key.length);
      for (; k > 0; k--) {
        mt[i] = ((mt[i] ^ Math.imul(mt[i - 1] ^ (mt[i - 1] >>> 30), 1664525)) +
                 key[j] + j) >>> 0;
        i++; j++;
        if (i >= N) { mt[0] = mt[N - 1]; i = 1; }
        if (j >= key.length) j = 0;
      }
      for (k = N - 1; k > 0; k--) {
        mt[i] = ((mt[i] ^ Math.imul(mt[i - 1] ^ (mt[i - 1] >>> 30), 1566083941)) -
                 i) >>> 0;
        i++;
        if (i >= N) { mt[0] = mt[N - 1]; i = 1; }
      }
      mt[0] = 0x80000000;
    }

    initByArray([seed >>> 0]);

    function genrandUint32() {
      let y;
      if (mti >= N) {
        let kk = 0;
        for (; kk < N - M; kk++) {
          y = (mt[kk] & upper) | (mt[kk + 1] & lower);
          mt[kk] = (mt[kk + M] ^ (y >>> 1) ^ mag01[y & 1]) >>> 0;
        }
        for (; kk < N - 1; kk++) {
          y = (mt[kk] & upper) | (mt[kk + 1] & lower);
          mt[kk] = (mt[kk + (M - N)] ^ (y >>> 1) ^ mag01[y & 1]) >>> 0;
        }
        y = (mt[N - 1] & upper) | (mt[0] & lower);
        mt[N - 1] = (mt[M - 1] ^ (y >>> 1) ^ mag01[y & 1]) >>> 0;
        mti = 0;
      }
      y = mt[mti++];
      y ^= y >>> 11;
      y ^= (y << 7) & 0x9d2c5680;
      y ^= (y << 15) & 0xefc60000;
      y ^= y >>> 18;
      return y >>> 0;
    }

    function random() {
      const a = genrandUint32() >>> 5, b = genrandUint32() >>> 6;
      return (a * 67108864.0 + b) / 9007199254740992.0;
    }

    let gaussNext = null;
    function gauss(mu, sigma) {
      let z = gaussNext;
      gaussNext = null;
      if (z === null) {
        const x2pi = random() * 2 * Math.PI;
        const g2rad = Math.sqrt(-2.0 * Math.log(1.0 - random()));
        z = Math.cos(x2pi) * g2rad;
        gaussNext = Math.sin(x2pi) * g2rad;
      }
      return mu + z * sigma;
    }

    random.gauss = gauss;
    return random;
  }

  function gaussianFactory(seed) {
    return pyRandom(seed).gauss;
  }

  /* ---- LoRA 参数量 / 显存计算器（对应 backend/demos/finetuning.py） ---- */
  function lora(q) {
    const d = toInt(q.d, 4096), k = toInt(q.k, 4096);
    const r = toInt(q.r, 16), alpha = toInt(q.alpha, 32);
    const layers = toInt(q.layers, 32);
    const nAttn = toInt(q.n_attn, 4), nFfn = toInt(q.n_ffn, 3);

    const fullSingle = d * k;
    const loraSingle = r * (d + k);
    const compression = fullSingle / loraSingle;

    const perLayerFull = nAttn * d * d + nFfn * (d * 4 * d);
    const perLayerLora = (nAttn + nFfn) * r * (d + d);
    const totalFull = perLayerFull * layers;
    const totalLora = perLayerLora * layers;

    function mem(params, baseBits, trainable) {
      const w = params * (baseBits / 8) / 1e9;
      const g = trainable ? params * 2 / 1e9 : 0;
      const o = trainable ? params * 8 / 1e9 : 0;
      return w + g + o;
    }
    const memFull = mem(totalFull, 16, true);
    const memLora = mem(totalFull - totalLora, 16, false) + mem(totalLora, 16, true);
    const memQlora = mem(totalFull - totalLora, 4, false) + mem(totalLora, 16, true);

    return {
      single_layer: {
        full_params: fullSingle,
        lora_params: loraSingle,
        compression_ratio: round(compression, 1)
      },
      whole_model: {
        total_full_params: totalFull,
        total_lora_params: totalLora,
        trainable_percent: round(totalLora / totalFull * 100, 4),
        compression_ratio: round(totalFull / totalLora, 1)
      },
      memory_gb: {
        full_finetune: round(memFull, 1),
        lora: round(memLora, 1),
        qlora: round(memQlora, 1)
      },
      effective_scaling: round(alpha / r, 4),
      note: 'α/r = ' + alpha + '/' + r + ' = ' + (alpha / r).toFixed(2) +
        '。若只把 r 翻倍而不改 α，缩放会减半，等效学习率被悄悄改变。'
    };
  }

  /* ---- 训练过程模拟器（对应 backend/demos/training.py） ---- */
  function simulate(q) {
    const steps = clamp(toInt(q.steps, 200), 20, 500);
    const method = q.method || 'lora';
    const quality = clamp(toFloat(q.quality, 0.85), 0.1, 1.0);
    const lr = 2e-4, warmup = 20;
    const gauss = gaussianFactory(42);
    const baseLoss = 3.2;
    const finalLoss = 1.1 + (1 - quality) * 1.5;
    const losses = [], lrs = [], checkpoints = [];

    for (let step = 1; step <= steps; step++) {
      let curLr;
      if (step <= warmup) {
        curLr = lr * step / warmup;
      } else {
        const progress = (step - warmup) / Math.max(steps - warmup, 1);
        curLr = lr * (0.1 + 0.9 * 0.5 * (1 + Math.cos(Math.PI * progress)));
      }
      lrs.push(round(curLr, 8));

      const decay = Math.exp(-4.0 * step / steps);
      let value = finalLoss + (baseLoss - finalLoss) * decay;
      value += gauss(0, 0.04 + 0.06 * decay);
      losses.push(round(Math.max(value, 0.3), 4));

      if (step % 50 === 0) {
        checkpoints.push({
          step: step,
          loss: losses[losses.length - 1],
          ppl: round(Math.exp(losses[losses.length - 1]), 2),
          artifact: (method === 'lora' || method === 'qlora')
            ? 'adapter_model.safetensors (~40MB)'
            : 'model.safetensors (~14GB)'
        });
      }
    }

    const methodMeta = {
      full: { trainable: '7.0B (100%)', mem_gb: 84, speed: '1.0x', adapter_mb: 14000 },
      lora: { trainable: '7.2M (0.10%)', mem_gb: 18, speed: '0.95x', adapter_mb: 40 },
      qlora: { trainable: '7.2M (0.10%)', mem_gb: 6, speed: '0.7x', adapter_mb: 40 }
    };
    const meta = methodMeta[method] || methodMeta.lora;
    return {
      steps: steps, losses: losses, lrs: lrs, checkpoints: checkpoints,
      method: method, meta: meta,
      summary: '使用 ' + method.toUpperCase() + ' 训练 ' + steps + ' 步：loss 从 ' +
        losses[0].toFixed(3) + ' 降到 ' + losses[losses.length - 1].toFixed(3) +
        '，最终困惑度 PPL≈' + Math.exp(losses[losses.length - 1]).toFixed(2) +
        '。可训练参数 ' + meta.trainable + '，峰值显存约 ' + meta.mem_gb + 'GB。'
    };
  }

  /* ---- BPE 分词（对应 backend/demos/tokenizer.py） ----
     词表与合并规则由后端预生成到 api/tokenizer.json，浏览器只做 encode。 */
  let bpePromise = null;
  function loadBPE() {
    if (!bpePromise) {
      bpePromise = fetch('api/tokenizer.json')
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(d => {
          const merges = {};
          (d.merges || []).forEach(pair => {
            merges[pair[0][0] + '\u0000' + pair[0][1]] = pair[1];
          });
          return { vocab: d.vocab, merges: merges };
        });
    }
    return bpePromise;
  }

  function getPairs(tokens) {
    const pairs = [];
    for (let i = 0; i < tokens.length - 1; i++) pairs.push([tokens[i], tokens[i + 1]]);
    return pairs;
  }

  function bpeWord(word, vocab, merges) {
    let tokens = Array.from(word).concat(['</w>']);
    while (true) {
      const pairs = getPairs(tokens);
      if (!pairs.length) break;
      let best = null, bestRank = Infinity;
      for (const p of pairs) {
        const rank = merges[p[0] + '\u0000' + p[1]];
        const r = rank === undefined ? Infinity : rank;
        if (r < bestRank) { bestRank = r; best = p; }
      }
      if (!best || bestRank === Infinity) break;
      const merged = best[0] + best[1];
      const out = [];
      let i = 0;
      while (i < tokens.length) {
        if (i < tokens.length - 1 && tokens[i] === best[0] && tokens[i + 1] === best[1]) {
          out.push(merged); i += 2;
        } else {
          out.push(tokens[i]); i += 1;
        }
      }
      tokens = out;
    }
    return tokens;
  }

  function tokenize(text) {
    const raw = String(text || '').slice(0, 200);
    return loadBPE().then(function (bpe) {
      const vocab = bpe.vocab, merges = bpe.merges;
      const words = raw.match(/\S+/g) || [];
      const tokens = [];
      words.forEach(w => { tokens.push.apply(tokens, bpeWord(w, vocab, merges)); });
      const unk = vocab['<UNK>'];
      const ids = tokens.map(t => (vocab[t] === undefined ? unk : vocab[t]));

      const applied = [];
      Object.keys(merges)
        .sort((a, b) => merges[a] - merges[b])
        .slice(0, 8)
        .forEach(key => {
          const parts = key.split('\u0000');
          if (vocab[parts[0] + parts[1]] !== undefined) {
            applied.push([parts[0], parts[1], parts[0] + parts[1]]);
          }
        });

      const inverse = {};
      Object.keys(vocab).forEach(t => { inverse[vocab[t]] = t; });
      const decoded = ids.map(id => inverse[id] === undefined ? '<UNK>' : inverse[id])
        .join('').replace(/<\/w>/g, ' ').trim();

      return {
        text: raw, tokens: tokens, ids: ids,
        merge_examples: applied,
        vocab_size: Object.keys(vocab).length,
        decoded: decoded
      };
    });
  }

  global.VLMStaticAPI = { lora: lora, simulate: simulate, tokenize: tokenize };
})(window);
