(() => {
  // ---------- Utilities ----------
  const splitSentences = (text) => {
    if (!text || !text.trim()) return [];
    return text.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  };

  const tokenize = (text) => {
    if (!text) return [];
    const m = text.match(/[A-Za-z]+(?:[-'][A-Za-z]+)*/g);
    return m ? m : [];
  };

  const normalizeSentence = (s) => s.toLowerCase().replace(/[\s\W_]+/g, " ").trim();

  const countSyllables = (word) => {
    if (!word) return 0;
    const w = word.toLowerCase();
    if (w.length <= 3) return 1;
    // Remove trailing 'e'
    let t = w.replace(/(?:e|es|ed)$/i, "");
    // Count vowel groups (a, e, i, o, u, y)
    const groups = t.match(/[aeiouy]{1,2}/g);
    const base = groups ? groups.length : 0;
    return Math.max(1, base);
  };

  const lettersCount = (text) => (text.match(/[A-Za-z]/g) || []).length;
  const alnumCount = (text) => (text.match(/[A-Za-z0-9]/g) || []).length;

  // ---------- Readability ----------
  const analyzeReadability = (text) => {
    const sentences = splitSentences(text);
    const words = tokenize(text);
    const sCount = sentences.length;
    const wCount = words.length;
    const syllables = words.reduce((acc, w) => acc + countSyllables(w), 0);
    const polys = words.reduce((acc, w) => acc + (countSyllables(w) >= 3 ? 1 : 0), 0);
    const letters = lettersCount(text);
    const chars = alnumCount(text); // for ARI, use alphanumeric chars

    if (!wCount || !sCount) {
      return {
        flesch_reading_ease: null,
        flesch_kincaid_grade: null,
        gunning_fog: null,
        smog_index: null,
        automated_readability_index: null,
        coleman_liau_index: null,
        dale_chall: null,
        difficult_words: 0,
        polysyllables: polys,
        lexicon_count: wCount,
        sentence_count: sCount,
      };
    }

    const wps = wCount / sCount;
    const spw = syllables / wCount;
    const complex = polys; // approximation

    const fre = 206.835 - 1.015 * wps - 84.6 * spw;
    const fk = 0.39 * wps + 11.8 * spw - 15.59;
    const gf = 0.4 * (wps + 100 * (complex / wCount));
    const smog = polys > 0 ? 1.043 * Math.sqrt(polys * (30 / sCount)) + 3.1291 : 0;
    const ari = 4.71 * (chars / wCount) + 0.5 * wps - 21.43;
    const L = (letters / wCount) * 100;
    const S = (sCount / wCount) * 100;
    const cli = 0.0588 * L - 0.296 * S - 15.8;

    return {
      flesch_reading_ease: fre,
      flesch_kincaid_grade: fk,
      gunning_fog: gf,
      smog_index: smog,
      automated_readability_index: ari,
      coleman_liau_index: cli,
      dale_chall: null, // not computed in-browser without word list
      difficult_words: 0,
      polysyllables: polys,
      lexicon_count: wCount,
      sentence_count: sCount,
    };
  };

  // ---------- Style ----------
  const analyzeStyle = (text, longSentenceThreshold) => {
    const sentences = splitSentences(text);
    const long_sentences = [];
    const passive_voice = [];

    sentences.forEach((s, i) => {
      const wc = tokenize(s).length;
      if (wc > longSentenceThreshold) {
        long_sentences.push({ index: i, word_count: wc, text: s });
      }
    });

    const beVerbs = "am|is|are|was|were|be|been|being";
    const passiveRe = new RegExp(`\\b(?:${beVerbs})\\b\\s+\\b(\\\\")?([A-Za-z]+ed)\\b`, "gi");
    sentences.forEach((s, i) => {
      let m;
      const re = new RegExp(`\\b(?:${beVerbs})\\b\\s+([A-Za-z]+ed)`, "gi");
      while ((m = re.exec(s)) !== null) {
        passive_voice.push({ index: i, match: m[0], sentence: s });
      }
    });

    const words = tokenize(text).map((w) => w.toLowerCase());
    const adverbCounts = words.reduce((acc, w) => {
      if (w.length > 3 && w.endsWith("ly")) acc[w] = (acc[w] || 0) + 1;
      return acc;
    }, {});
    const skip = new Set(["family", "only", "supply", "reply", "apply", "imply"]);
    const adverbs = Object.entries(adverbCounts)
      .filter(([w]) => !skip.has(w))
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => (b.count - a.count) || a.word.localeCompare(b.word));

    return { long_sentences, passive_voice, adverbs };
  };

  // ---------- Repetition ----------
  const analyzeRepetition = (text, maxDuplicateSentences) => {
    const words = tokenize(text).map((w) => w.toLowerCase());
    const duplicate_words_positions = {};
    let prev = null;
    words.forEach((w, i) => {
      if (w === prev) {
        if (!duplicate_words_positions[w]) duplicate_words_positions[w] = [];
        duplicate_words_positions[w].push(i);
      }
      prev = w;
    });

    const dup_words = Object.entries(duplicate_words_positions)
      .filter(([, pos]) => pos && pos.length)
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .map(([word, occurrences]) => ({ word, occurrences }));

    const sentences = splitSentences(text);
    const normalized = sentences.map((s) => normalizeSentence(s));
    const counts = normalized.reduce((acc, n) => {
      if (!n) return acc;
      acc[n] = (acc[n] || 0) + 1;
      return acc;
    }, {});

    const dup_sentences_raw = sentences.map((s, i) => ({ sentence: s, count: counts[normalized[i]] || 0 }))
      .filter((_, i) => normalized[i] && (counts[normalized[i]] > maxDuplicateSentences));

    const seen = new Set();
    const duplicate_sentences = [];
    dup_sentences_raw.forEach((item) => {
      const key = normalizeSentence(item.sentence);
      if (!seen.has(key)) {
        seen.add(key);
        duplicate_sentences.push(item);
      }
    });

    return { duplicate_words: dup_words, duplicate_sentences };
  };

  // ---------- Spelling (optional) ----------
  let typoLibLoaded = false;
  let spellInstance = null;

  const loadScript = (src) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });

  async function ensureTypoLoaded() {
    if (typoLibLoaded) return true;
    const cdn = window.TYPO_CDN || "https://cdn.jsdelivr.net/npm/typo-js@1.2.1";
    try {
      await loadScript(`${cdn}/typo.js`);
      typoLibLoaded = true;
      return true;
    } catch (e) {
      console.warn('Typo.js failed to load', e);
      return false;
    }
  }

  async function initSpell(lang) {
    spellInstance = null;
    const ok = await ensureTypoLoaded();
    if (!ok || typeof Typo === 'undefined') return null;

    // Try loading dictionaries from local repo (docs/dictionaries/<lang>.aff|.dic)
    async function fetchText(url) {
      const res = await fetch(url, { cache: 'force-cache' });
      if (!res.ok) throw new Error(`Failed ${url}`);
      return res.text();
    }

    const dictBase = `./dictionaries/${lang}`;
    try {
      const [aff, dic] = await Promise.all([
        fetchText(`${dictBase}.aff`),
        fetchText(`${dictBase}.dic`),
      ]);
      // Typo constructor signature with raw data
      // eslint-disable-next-line no-undef
      spellInstance = new Typo(lang, aff, dic, { platform: 'any' });
      return spellInstance;
    } catch (e) {
      console.warn(`Dictionary ${lang} not found in ./dictionaries. Spellcheck disabled.`, e);
      return null;
    }
  }

  function analyzeSpelling(text, lang) {
    const tokens = (text.match(/\b\w+\b/g) || []);
    const lower = tokens.filter((t) => /[A-Za-z]/.test(t)).filter((t) => !(t.split('').some((c) => /[A-Z]/.test(c)))).map((t) => t.toLowerCase());

    if (!spellInstance) {
      return { total_unknown: 0, issues: [], note: 'Spellcheck disabled: no dictionary loaded' };
    }

    const uniq = Array.from(new Set(lower));
    const issues = [];
    uniq.forEach((w) => {
      if (!spellInstance.check(w)) {
        const sug = spellInstance.suggest(w);
        issues.push({ word: w, suggestion: sug && sug.length ? sug[0] : null });
      }
    });
    return { total_unknown: issues.length, issues };
  }

  // ---------- Main analyzer ----------
  function analyzeText(text, options) {
    const readability = analyzeReadability(text);
    const spelling = analyzeSpelling(text, options.lang);
    const style = analyzeStyle(text, options.long_sentence_threshold);
    const repetition = analyzeRepetition(text, options.max_duplicate_sentences);

    const summary = {
      characters: text.length,
      words: tokenize(text).length,
      sentences: splitSentences(text).length,
    };

    return {
      summary,
      readability,
      spelling,
      style,
      repetition,
      options,
    };
  }

  // ---------- Formatting ----------
  function formatHuman(result) {
    const lines = [];
    const s = result.summary;
    lines.push(`Summary: ${s.words} words, ${s.sentences} sentences, ${s.characters} chars`);

    const r = result.readability;
    lines.push('Readability:');
    [
      'flesch_reading_ease',
      'flesch_kincaid_grade',
      'gunning_fog',
      'smog_index',
      'automated_readability_index',
    ].forEach((k) => {
      const v = r && r[k];
      if (v === null || typeof v === 'undefined') return;
      const name = k.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
      lines.push(`  - ${name}: ${Number(v).toFixed(2)}`);
    });

    const sp = result.spelling || { total_unknown: 0, issues: [], note: 'disabled' };
    if (sp.note) {
      lines.push(`Spelling: ${sp.note}`);
    } else {
      lines.push(`Spelling: ${sp.total_unknown} potential issue(s)`);
      sp.issues.slice(0, 20).forEach((issue) => {
        lines.push(`  - '${issue.word}' -> suggestion: ${issue.suggestion}`);
      });
      if (sp.total_unknown > 20) {
        lines.push(`  ... and ${sp.total_unknown - 20} more`);
      }
    }

    const st = result.style || { long_sentences: [], passive_voice: [], adverbs: [] };
    if (st.long_sentences && st.long_sentences.length) {
      lines.push('Style: Long sentences');
      st.long_sentences.slice(0, 10).forEach((item) => {
        lines.push(`  - #${item.index} (${item.word_count} words): ${item.text}`);
      });
    }
    if (st.passive_voice && st.passive_voice.length) {
      lines.push('Style: Possible passive voice');
      st.passive_voice.slice(0, 10).forEach((item) => {
        lines.push(`  - #${item.index}: ${item.match}`);
      });
    }
    if (st.adverbs && st.adverbs.length) {
      lines.push('Style: Adverbs (-ly)');
      st.adverbs.slice(0, 10).forEach((item) => {
        lines.push(`  - ${item.word} x${item.count}`);
      });
    }

    const rep = result.repetition || { duplicate_words: [], duplicate_sentences: [] };
    if (rep.duplicate_words && rep.duplicate_words.length) {
      lines.push('Repetition: Immediate duplicate words');
      rep.duplicate_words.slice(0, 10).forEach((item) => {
        const posPreview = (item.occurrences || []).slice(0, 5).join(', ');
        lines.push(`  - '${item.word}' at positions ${posPreview}`);
      });
    }
    if (rep.duplicate_sentences && rep.duplicate_sentences.length) {
      lines.push('Repetition: Duplicate sentences');
      rep.duplicate_sentences.slice(0, 5).forEach((item) => {
        lines.push(`  - x${item.count}: ${item.sentence}`);
      });
    }

    return lines.join('\n');
  }

  // ---------- UI wiring ----------
  function getOptions() {
    const lang = document.getElementById('lang').value || 'en_US';
    const long_sentence_threshold = Number(document.getElementById('longThreshold').value) || 30;
    const max_duplicate_sentences = Number(document.getElementById('maxDup').value) || 1;
    return { lang, long_sentence_threshold, max_duplicate_sentences };
  }

  async function maybeInitSpell() {
    const enabled = document.getElementById('enableSpell').checked;
    if (!enabled) { spellInstance = null; return; }

    const lang = document.getElementById('lang').value || 'en_US';
    const ok = await initSpell(lang);
    if (!ok) {
      // Turn off checkbox to reflect disabled state
      document.getElementById('enableSpell').checked = false;
    }
  }

  function runAnalyze() {
    const text = document.getElementById('text').value || '';
    const options = getOptions();
    const result = analyzeText(text, options);
    const showJson = document.getElementById('showJson').checked;

    const humanEl = document.getElementById('human');
    const jsonEl = document.getElementById('json');

    humanEl.textContent = formatHuman(result);
    jsonEl.textContent = JSON.stringify(result, null, 2);
    jsonEl.classList.toggle('hidden', !showJson);
  }

  function loadExample() {
    const sample = `This is a simple sample text. It is intended to demonstrate the features of the AI Checker. The text contains some adverbs, like clearly and quickly, which might be flagged. Sometimes words words repeat. A long sentence that keeps going without much punctuation can be considered difficult to read because it contains many words and clauses and therefore could exceed a configured threshold easily. The ball was thrown by the boy.`;
    document.getElementById('text').value = sample;
  }

  window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('analyzeBtn').addEventListener('click', runAnalyze);
    document.getElementById('exampleBtn').addEventListener('click', () => { loadExample(); runAnalyze(); });

    document.getElementById('showJson').addEventListener('change', runAnalyze);
    document.getElementById('lang').addEventListener('change', async () => { await maybeInitSpell(); runAnalyze(); });
    document.getElementById('enableSpell').addEventListener('change', async () => { await maybeInitSpell(); runAnalyze(); });
    document.getElementById('longThreshold').addEventListener('change', runAnalyze);
    document.getElementById('maxDup').addEventListener('change', runAnalyze);

    // Try to init spellcheck if enabled and dictionaries exist
    maybeInitSpell().finally(() => {
      loadExample();
      runAnalyze();
    });
  });
})();
