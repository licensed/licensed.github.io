/**
 * upload.js
 * Handles file input, drag-and-drop, JSON parsing and validation.
 *
 * ── Supported JSON formats ──────────────────────────────────────────────────
 * Format A (real export): [[{respondent1}, {respondent2}, ...]]
 *   The outer array wraps a single inner array of respondent objects.
 *   Each object has slugified numeric-prefixed keys:
 *     "1vocgostoudaorganizaodasalavirtual" → question 1
 *     "11assuasexpectativas..."           → question 11
 *     "12esseespaco..."                   → comments (ignored)
 *     "respostanumrica"                   → row number (ignored)
 *
 * Format B (single array): [{respondent1}, ...]
 *   Same as A but without the outer wrapper.
 *
 * Format C (legacy / custom): {"Pergunta 1": ["Sim","Não",...], ...}
 *   One key per question, values are arrays (or strings) of answers.
 * ────────────────────────────────────────────────────────────────────────────
 */

export const QUESTIONS = [
  "Você gostou da organização da sala virtual?",
  "A carga horária foi suficiente?",
  "Você acha que os objetivos desse componente curricular foram atingidos?",
  "O material didático (livro) lhe ajudou ao longo do seu processo de aprendizagem?",
  "Os tutores a DISTÂNCIA esclareceram suas dúvidas?",
  "Os tutores PRESENCIAIS estavam sempre presentes, lhe ajudando no uso das tecnologias?",
  "No(s) encontro(s) presencial(is) o professor demonstrou domínio do conteúdo?",
  "A webconferência contribuiu para o seu processo de aprendizagem?",
  "As atividades desenvolvidas no ambiente virtual serviram de suporte para você realizar a avaliação presencial?",
  "A quantidade de atividade foi suficiente para o seu aprendizado?",
  "As suas expectativas em relação a esse componente curricular foram atendidas?"
];

/**
 * Parse a JSON text string and map answers to the 11 ordered questions.
 * @param {string} text - Raw JSON string
 * @param {string} filename - Original filename (used for error context)
 * @returns {{ discipline: string, questions: string[][], raw: any }}
 */
export function parseJSON(text, filename) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`"${filename}" contém JSON inválido.`);
  }

  // ─── Format A: [[{respondent}, ...]] ─────────────────────────────────────
  if (
    Array.isArray(raw) &&
    raw.length >= 1 &&
    Array.isArray(raw[0]) &&
    raw[0].length >= 1 &&
    typeof raw[0][0] === 'object' && !Array.isArray(raw[0][0])
  ) {
    return {
      discipline: filename.replace(/\.json$/i, ''),
      questions: parseRespondentArray(raw[0], filename),
      raw
    };
  }

  // ─── Format B: [{respondent}, ...] ───────────────────────────────────────
  if (
    Array.isArray(raw) &&
    raw.length >= 1 &&
    typeof raw[0] === 'object' && !Array.isArray(raw[0])
  ) {
    return {
      discipline: filename.replace(/\.json$/i, ''),
      questions: parseRespondentArray(raw, filename),
      raw
    };
  }

  // ─── Format C: {question_key: [answers...]} ───────────────────────────────
  if (typeof raw === 'object' && !Array.isArray(raw) && raw !== null) {
    const keys = Object.keys(raw);
    if (keys.length < 1) throw new Error(`"${filename}": o JSON está vazio.`);
    return {
      discipline: filename.replace(/\.json$/i, ''),
      questions: mapByKeyIndex(raw, filename),
      raw
    };
  }

  throw new Error(
    `"${filename}": formato não reconhecido. ` +
    `Esperado: [[{...}]], [{...}] ou {"pergunta": ["resposta"...]}.`
  );
}

// ─── Format A / B parser ─────────────────────────────────────────────────────

/**
 * Iterate an array of respondent objects and aggregate answers into 11 buckets.
 * Keys must begin with a digit 1–11 identifying the question.
 * Key 12+ = comments/metadata → ignored.
 */
function parseRespondentArray(respondents, filename) {
  if (!Array.isArray(respondents) || respondents.length === 0) {
    throw new Error(`"${filename}": a lista de respondentes está vazia.`);
  }

  // 11 answer buckets, one per question (0-indexed)
  const buckets = Array.from({ length: 11 }, () => []);

  for (const respondent of respondents) {
    if (typeof respondent !== 'object' || Array.isArray(respondent)) continue;

    for (const [key, value] of Object.entries(respondent)) {
      const qIdx = extractQuestionIndex(key);
      if (qIdx === null) continue; // metadata or comments → skip

      const answer = String(value ?? '').trim();
      if (answer) buckets[qIdx].push(answer);
    }
  }

  const answeredCount = buckets.filter(b => b.length > 0).length;
  if (answeredCount === 0) {
    throw new Error(
      `"${filename}": nenhuma resposta encontrada. ` +
      `Verifique se as chaves começam com o número da pergunta (ex: "1vocgostou...").`
    );
  }

  return buckets;
}

/**
 * Extract the 0-based question index from a slugified key.
 * Returns null for non-question keys.
 *
 * Examples:
 *   "1vocgostoudaorganizaodasalavirtual"  → 0
 *   "11assuasexpectativas..."              → 10
 *   "12esseespaco..."                      → null  (comments)
 *   "respostanumrica"                      → null  (metadata)
 */
function extractQuestionIndex(key) {
  const match = String(key).match(/^(\d+)/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  if (n < 1 || n > 11) return null; // 12 = comments; anything else = ignore
  return n - 1; // 0-based
}

// ─── Format C parser ─────────────────────────────────────────────────────────

function mapByKeyIndex(raw, filename) {
  const keys = Object.keys(raw);
  const result = Array.from({ length: 11 }, () => []);

  // If exactly 11 keys → assign positionally
  if (keys.length === 11) {
    keys.forEach((k, i) => { result[i] = normalizeAnswers(raw[k], k, filename); });
    return result;
  }

  // Fuzzy text / number matching
  let matched = 0;
  for (const key of keys) {
    const idx = findBestMatch(key);
    if (idx !== -1) {
      result[idx] = normalizeAnswers(raw[key], key, filename);
      matched++;
    }
  }

  if (matched === 0) {
    throw new Error(
      `"${filename}": não foi possível mapear nenhuma chave. ` +
      `Certifique-se de que o JSON possui 11 chaves no formato correto.`
    );
  }

  return result;
}

function findBestMatch(key) {
  const normalized = key.toLowerCase().trim();
  const exact = QUESTIONS.findIndex(q => q.toLowerCase() === normalized);
  if (exact !== -1) return exact;
  const prefix30 = QUESTIONS.findIndex(q =>
    q.toLowerCase().startsWith(normalized.substring(0, 30))
  );
  if (prefix30 !== -1) return prefix30;
  const numMatch = normalized.match(/\b(\d{1,2})\b/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 1 && n <= 11) return n - 1;
  }
  if (normalized.length >= 15) {
    const sub = QUESTIONS.findIndex(q => q.toLowerCase().includes(normalized));
    if (sub !== -1) return sub;
  }
  return -1;
}

function normalizeAnswers(val, key, filename) {
  if (Array.isArray(val)) return val.map(v => String(v).trim()).filter(Boolean);
  if (typeof val === 'string') return val.trim() ? [val.trim()] : [];
  if (typeof val === 'object' && val !== null) {
    const out = [];
    for (const [answer, count] of Object.entries(val)) {
      const n = parseInt(count, 10);
      if (!isNaN(n)) {
        for (let i = 0; i < n; i++) out.push(String(answer));
      } else {
        out.push(String(answer));
      }
    }
    return out;
  }
  console.warn(`[upload] Formato inesperado para chave "${key}" em "${filename}":`, val);
  return [];
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Read multiple File objects and return parsed discipline data.
 * @param {FileList|File[]} files
 * @returns {Promise<{ results: Array, errors: string[] }>}
 */
export async function handleFiles(files) {
  const results = [];
  const errors  = [];

  await Promise.all(Array.from(files).map(async (file) => {
    try {
      const text   = await file.text();
      const parsed = parseJSON(text, file.name);
      results.push(parsed);
    } catch (err) {
      errors.push(err.message);
    }
  }));

  return { results, errors };
}

/** Setup drag-and-drop and click events on the upload zone */
export function setupUploadZone(zoneEl, inputEl, onFiles) {
  zoneEl.addEventListener('click', (e) => {
    if (e.target !== inputEl) inputEl.click();
  });
  zoneEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') inputEl.click();
  });

  inputEl.addEventListener('change', () => {
    if (inputEl.files?.length) onFiles(inputEl.files);
    inputEl.value = ''; // allow re-upload of same file
  });

  zoneEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    zoneEl.classList.add('drag-over');
  });
  zoneEl.addEventListener('dragleave', () => zoneEl.classList.remove('drag-over'));
  zoneEl.addEventListener('drop', (e) => {
    e.preventDefault();
    zoneEl.classList.remove('drag-over');
    const jsonFiles = Array.from(e.dataTransfer.files).filter(f =>
      f.name.toLowerCase().endsWith('.json')
    );
    onFiles(jsonFiles.length ? jsonFiles : e.dataTransfer.files);
  });
}
