const state = {
  allRows: [],
  filteredRows: [],
  selectedId: null,
  experimentDescriptions: new Map(),
  lang: new URLSearchParams(window.location.search).get("lang") || localStorage.getItem("lang") || "it"
};

const urlFilterParamAliases = {
  level: ["level", "livello"],
  topic: ["topic", "argomento", "area"],
  professor: ["professor", "docente", "relatore"],
  experiment: ["experiment", "esperimento"],
  query: ["q", "query", "search", "cerca"]
};

const columnAliases = {
  title: ["titolo", "title", "argomento"],
  professor: ["docente", "relatore", "supervisor", "professor", "referenti"],
  topic: ["area", "topic", "settore", "categoria", "ambito"],
  experiment: ["esperimento", "experiment"],
  language: ["lingua", "language"],
  level: ["livello", "level"],
  description: ["descrizione", "description", "abstract", "sommario"],
  requirements: ["requisiti", "requirements", "prerequisiti"],
  email: ["email", "mail", "contatto"],
  link: ["link", "url", "modulo", "form", "application"]
};

const experimentSheetAliases = {
  name: ["esperimento", "experiment", "nome", "name", "sigla", "acronimo"],
  description: ["descrizione", "description", "dettagli", "details", "info"]
};

const translations = {
  it: {
    pageTitle: "Proposte Tesi - Fisica delle Particelle UNIMIB",
    eyebrow: "UNIMIB Fisica delle Particelle",
    heading: "Proposte di tesi in Fisica delle Particelle",
    subtitle: "Esplora, filtra e trova rapidamente il tema più adatto.",
    filtersHeading: "Filtri",
    searchLabel: "Cerca per titolo, docente o parole chiave",
    searchPlaceholder: "Es. LHC, machine learning...",
    levelLabel: "Livello",
    topicLabel: "Argomento",
    professorLabel: "Docente",
    experimentLabel: "Esperimento",
    allOption: "Tutti",
    clearFilters: "Azzera filtri",
    detailEmpty: "Seleziona una proposta dalla lista.",
    loading: "Caricamento proposte...",
    noConfig: "Configura config.js con l'URL CSV pubblico di Google Sheets per caricare le proposte.",
    noRows: "Nessuna proposta trovata nel foglio.",
    loadError: "Errore durante il caricamento del foglio. Controlla che il link CSV sia pubblico e valido.",
    noResults: "Nessuna proposta trovata con i filtri attuali.",
    resultsCount: (n) => `${n} risultat${n === 1 ? "o" : "i"}`,
    detailProfessor: "Docente",
    detailArea: "Area",
    detailExperiment: "Esperimento",
    detailDescription: "Descrizione",
    detailRequirements: "Requisiti",
    detailExperimentDesc: "Descrizione esperimento",
    detailExperimentOpen: "Apri dettagli esperimento",
    detailContact: "Contatto",
    detailApplyLink: "Apri link candidatura",
    detailNoDetails: "Nessun dettaglio aggiuntivo disponibile.",
    langToggle: "EN"
  },
  en: {
    pageTitle: "Thesis Proposals – Particle Physics UNIMIB",
    eyebrow: "UNIMIB Particle Physics",
    heading: "Thesis Proposals in Particle Physics",
    subtitle: "Explore, filter and quickly find the most suitable topic.",
    filtersHeading: "Filters",
    searchLabel: "Search by title, supervisor or keywords",
    searchPlaceholder: "E.g. LHC, machine learning...",
    levelLabel: "Level",
    topicLabel: "Topic",
    professorLabel: "Supervisor",
    experimentLabel: "Experiment",
    allOption: "All",
    clearFilters: "Clear filters",
    detailEmpty: "Select a proposal from the list.",
    loading: "Loading proposals...",
    noConfig: "Configure config.js with the public CSV URL from Google Sheets to load proposals.",
    noRows: "No proposals found in the sheet.",
    loadError: "Error loading the sheet. Make sure the CSV link is public and valid.",
    noResults: "No proposals found with the current filters.",
    resultsCount: (n) => `${n} result${n === 1 ? "" : "s"}`,
    detailProfessor: "Supervisor",
    detailArea: "Area",
    detailExperiment: "Experiment",
    detailDescription: "Description",
    detailRequirements: "Requirements",
    detailExperimentDesc: "Experiment description",
    detailExperimentOpen: "Open experiment details",
    detailContact: "Contact",
    detailApplyLink: "Open application link",
    detailNoDetails: "No additional details available.",
    langToggle: "IT"
  }
};

function t(key, ...args) {
  const val = (translations[state.lang] || translations.it)[key];
  return typeof val === "function" ? val(...args) : (val ?? key);
}

function applyTranslations() {
  document.documentElement.lang = state.lang;
  document.title = t("pageTitle");

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n;
    const attr = node.dataset.i18nAttr;
    if (attr) {
      node.setAttribute(attr, t(key));
    } else {
      node.textContent = t(key);
    }
  });

  el.langToggle.textContent = t("langToggle");

  [el.levelFilter, el.topicFilter, el.professorFilter, el.experimentFilter].forEach((sel) => {
    if (sel.options[0] && sel.options[0].value === "") {
      sel.options[0].textContent = t("allOption");
    }
  });

  if (state.allRows.length > 0) {
    renderList();
    if (state.selectedId) {
      selectThesis(state.selectedId);
    }
    el.resultsCount.textContent = t("resultsCount", state.filteredRows.length);
  }
}

const el = {
  statusMessage: document.getElementById("statusMessage"),
  thesisList: document.getElementById("thesisList"),
  detailEmpty: document.getElementById("detailEmpty"),
  thesisDetail: document.getElementById("thesisDetail"),
  searchInput: document.getElementById("searchInput"),
  topicFilter: document.getElementById("topicFilter"),
  levelFilter: document.getElementById("levelFilter"),
  professorFilter: document.getElementById("professorFilter"),
  experimentFilter: document.getElementById("experimentFilter"),
  clearFiltersBtn: document.getElementById("clearFiltersBtn"),
  resultsCount: document.getElementById("resultsCount"),
  langToggle: document.getElementById("langToggle")
};

init();

async function init() {
  bindEvents();
  applyTranslations();

  if (!window.SHEETS_CONFIG || !window.SHEETS_CONFIG.csvUrl) {
    setStatus(t("noConfig"), true);
    return;
  }

  try {
    setStatus(t("loading"));
    const csv = await fetchCsv(window.SHEETS_CONFIG.csvUrl);
    const parsed = parseCsv(csv);
    state.allRows = normalizeRows(parsed);

    if (window.SHEETS_CONFIG.experimentsCsvUrl) {
      try {
        const experimentsCsv = await fetchCsv(window.SHEETS_CONFIG.experimentsCsvUrl);
        const experimentsParsed = parseCsv(experimentsCsv);
        state.experimentDescriptions = buildExperimentDescriptionMap(experimentsParsed);
      } catch (experimentError) {
        console.warn("Impossibile caricare il foglio descrizioni esperimenti:", experimentError);
      }
    }

    if (state.allRows.length === 0) {
      setStatus(t("noRows"), true);
      return;
    }

    populateFilters(state.allRows);
    applyFiltersFromUrl();
    applyFilters();

    const hashId = window.location.hash.replace("#", "").trim();
    if (hashId) {
      selectThesis(hashId);
    } else {
      selectThesis(state.filteredRows[0]?.id);
    }

    setStatus("");
  } catch (error) {
    console.error(error);
    setStatus(t("loadError"), true);
  }
}

function bindEvents() {
  el.searchInput.addEventListener("input", applyFilters);
  el.levelFilter.addEventListener("change", applyFilters);
  el.topicFilter.addEventListener("change", applyFilters);
  el.professorFilter.addEventListener("change", applyFilters);
  el.experimentFilter.addEventListener("change", applyFilters);

  el.clearFiltersBtn.addEventListener("click", () => {
    el.searchInput.value = "";
    el.levelFilter.value = "";
    el.topicFilter.value = "";
    el.professorFilter.value = "";
    el.experimentFilter.value = "";
    applyFilters();
  });

  el.langToggle.addEventListener("click", () => {
    state.lang = state.lang === "it" ? "en" : "it";
    try { localStorage.setItem("lang", state.lang); } catch (_) {}
    applyTranslations();
  });

  window.addEventListener("hashchange", () => {
    const hashId = window.location.hash.replace("#", "").trim();
    if (hashId) {
      selectThesis(hashId);
    }
  });
}

function setStatus(message, isWarning = false) {
  el.statusMessage.textContent = message;
  el.statusMessage.style.display = message ? "block" : "none";
  el.statusMessage.style.borderColor = isWarning ? "rgba(222, 95, 42, 0.35)" : "";
}

async function fetchCsv(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(current);
      if (row.some((cell) => cell.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((cell) => cell.trim().length > 0)) {
      rows.push(row);
    }
  }

  const headers = (rows.shift() || []).map((h) => h.trim());
  return rows.map((values) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = (values[index] || "").trim();
    });
    return obj;
  });
}

function normalizeRows(rows) {
  return rows.map((row, index) => {
    const resolved = {
      id: makeStableId(row, index),
      raw: row,
      title: pickByAlias(row, columnAliases.title) || `Proposta ${index + 1}`,
      professor: pickByAlias(row, columnAliases.professor),
      topic: pickByAlias(row, columnAliases.topic),
      language: pickByAlias(row, columnAliases.language),
      experiment: pickByAlias(row, columnAliases.experiment),
      level: pickByAlias(row, columnAliases.level),
      description: pickByAlias(row, columnAliases.description),
      requirements: pickByAlias(row, columnAliases.requirements),
      email: pickByAlias(row, columnAliases.email),
      link: pickByAlias(row, columnAliases.link)
    };
    return resolved;
  });
}

function makeStableId(row, index) {
  const custom = row.id || row.ID || row.Id;
  if (custom) {
    return slugify(custom);
  }
  const title = pickByAlias(row, columnAliases.title) || `proposta-${index + 1}`;
  return `${slugify(title)}-${index + 1}`;
}

function pickByAlias(row, aliases) {
  const entries = Object.entries(row);
  const lowerEntries = entries.map(([key, value]) => [key.toLowerCase().trim(), value]);

  for (const alias of aliases) {
    const found = lowerEntries.find(([key]) => key === alias);
    if (found && found[1]) {
      return found[1].trim();
    }
  }

  return "";
}

function populateFilters(rows) {
  setSelectOptions(el.levelFilter, uniqueValues(rows.flatMap((r) => splitLevels(r.level))));
  setSelectOptions(el.topicFilter, uniqueValues(rows.map((r) => r.topic)));
  setSelectOptions(el.professorFilter, uniqueValues(rows.flatMap((r) => splitProfessors(r.professor))));
  setSelectOptions(el.experimentFilter, uniqueValues(rows.map((r) => r.experiment)));
}

function fillSelect(select, values) {
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "it"));
}

function setSelectOptions(select, values) {
  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = t("allOption");
  select.appendChild(placeholder);

  fillSelect(select, values);
}

function getFirstQueryParam(params, aliases) {
  for (const alias of aliases) {
    const value = params.get(alias);
    if (value) return value;
  }
  return "";
}

function normalizeText(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function fuzzyMatchValue(raw, availableValues) {
  if (!raw) return "";
  const needle = normalizeText(raw);
  return availableValues.find((v) => normalizeText(v) === needle) || "";
}

function applyFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);

  const allLevels      = uniqueValues(state.allRows.flatMap((r) => splitLevels(r.level)));
  const allTopics      = uniqueValues(state.allRows.map((r) => r.topic));
  const allProfessors  = uniqueValues(state.allRows.flatMap((r) => splitProfessors(r.professor)));
  const allExperiments = uniqueValues(state.allRows.map((r) => r.experiment));

  el.searchInput.value    = getFirstQueryParam(params, urlFilterParamAliases.query);
  el.levelFilter.value      = fuzzyMatchValue(getFirstQueryParam(params, urlFilterParamAliases.level),      allLevels);
  el.topicFilter.value      = fuzzyMatchValue(getFirstQueryParam(params, urlFilterParamAliases.topic),      allTopics);
  el.professorFilter.value  = fuzzyMatchValue(getFirstQueryParam(params, urlFilterParamAliases.professor),  allProfessors);
  el.experimentFilter.value = fuzzyMatchValue(getFirstQueryParam(params, urlFilterParamAliases.experiment), allExperiments);
}

function syncUrlWithFilters(query, filters) {
  const params = new URLSearchParams();

  if (query) params.set("q", query);
  if (filters.level) params.set("level", filters.level);
  if (filters.topic) params.set("topic", filters.topic);
  if (filters.professor) params.set("professor", filters.professor);
  if (filters.experiment) params.set("experiment", filters.experiment);

  const queryString = params.toString();
  const target = `${window.location.pathname}${queryString ? `?${queryString}` : ""}${window.location.hash}`;
  try {
    window.history.replaceState(null, "", target);
  } catch (_) {
    // replaceState is unavailable in some environments (e.g. file:// origin)
  }
}

function rowMatchesQuery(row, query) {
  if (!query) return true;
  return [row.title, row.professor, row.topic, row.description, row.requirements]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function matchesFilterValue(row, key, value) {
  if (!value) return true;
  const needle = normalizeText(value);
  if (key === "professor") {
    return splitProfessors(row.professor).some((p) => normalizeText(p) === needle);
  }
  if (key === "level") {
    return splitLevels(row.level).some((level) => normalizeText(level) === needle);
  }
  return normalizeText(row[key]) === needle;
}

function syncFilterOptions(query, selectedFilters) {
  const descriptors = [
    {
      key: "level",
      select: el.levelFilter,
      valuesFromRows: (rows) => uniqueValues(rows.flatMap((row) => splitLevels(row.level)))
    },
    {
      key: "topic",
      select: el.topicFilter,
      valuesFromRows: (rows) => uniqueValues(rows.map((row) => row.topic))
    },
    {
      key: "professor",
      select: el.professorFilter,
      valuesFromRows: (rows) => uniqueValues(rows.flatMap((row) => splitProfessors(row.professor)))
    },
    {
      key: "experiment",
      select: el.experimentFilter,
      valuesFromRows: (rows) => uniqueValues(rows.map((row) => row.experiment))
    }
  ];

  descriptors.forEach(({ key, select, valuesFromRows }) => {
    const compatibleRows = state.allRows.filter((row) => {
      if (!rowMatchesQuery(row, query)) return false;

      return Object.entries(selectedFilters).every(([filterKey, filterValue]) => {
        if (filterKey === key) return true;
        return matchesFilterValue(row, filterKey, filterValue);
      });
    });

    const availableValues = valuesFromRows(compatibleRows);
    setSelectOptions(select, availableValues);

    const matched = selectedFilters[key]
      ? fuzzyMatchValue(selectedFilters[key], availableValues)
      : "";
    select.value = matched;
  });

  return {
    level: el.levelFilter.value,
    topic: el.topicFilter.value,
    professor: el.professorFilter.value,
    experiment: el.experimentFilter.value
  };
}

function applyFilters() {
  const query = el.searchInput.value.trim().toLowerCase();
  const selectedFilters = syncFilterOptions(query, {
    level: el.levelFilter.value,
    topic: el.topicFilter.value,
    professor: el.professorFilter.value,
    experiment: el.experimentFilter.value
  });

  syncUrlWithFilters(query, selectedFilters);

  state.filteredRows = state.allRows.filter((row) => {
    const matchesQuery = rowMatchesQuery(row, query);

    const matchesTopic = matchesFilterValue(row, "topic", selectedFilters.topic);
    const matchesProfessor = matchesFilterValue(row, "professor", selectedFilters.professor);
    const matchesExperiment = matchesFilterValue(row, "experiment", selectedFilters.experiment);
    const matchesLevel = matchesFilterValue(row, "level", selectedFilters.level);

    return matchesQuery && matchesTopic && matchesProfessor && matchesExperiment && matchesLevel;
  });

  renderList();

  if (!state.filteredRows.some((item) => item.id === state.selectedId)) {
    selectThesis(state.filteredRows[0]?.id);
  } else {
    highlightSelection();
  }

  el.resultsCount.textContent = t("resultsCount", state.filteredRows.length);
}

function splitProfessors(value) {
  return splitCommaValues(value);
}

function splitLevels(value) {
  return splitCommaValues(value);
}

function renderList() {
  el.thesisList.innerHTML = "";

  if (state.filteredRows.length === 0) {
    const empty = document.createElement("li");
    empty.className = "status";
    empty.textContent = t("noResults");
    el.thesisList.appendChild(empty);
    return;
  }

  state.filteredRows.forEach((row) => {
    const item = document.createElement("li");
    item.className = "thesis-item";
    item.dataset.id = row.id;

    const metaChunks = [];
    if (row.level) metaChunks.push(`<span class="badge">${escapeHtml(row.level)}</span>`);
    if (row.professor) metaChunks.push(`<span class="badge">${escapeHtml(row.professor)}</span>`);
    if (row.topic) metaChunks.push(`<span class="badge highlight">${escapeHtml(row.topic)}</span>`);
    if (row.experiment) metaChunks.push(`<span class="badge">${escapeHtml(row.experiment)}</span>`);

    item.innerHTML = `
      <p class="thesis-title">${escapeHtml(row.title)}</p>
      <div class="thesis-meta">${metaChunks.join("")}</div>
    `;

    item.addEventListener("click", () => {
      selectThesis(row.id);
      window.location.hash = row.id;
    });

    el.thesisList.appendChild(item);
  });

  highlightSelection();
}

function selectThesis(id) {
  if (!id) {
    state.selectedId = null;
    el.detailEmpty.style.display = "block";
    el.thesisDetail.classList.add("hidden");
    highlightSelection();
    return;
  }

  const selected = state.filteredRows.find((row) => row.id === id) || state.allRows.find((row) => row.id === id);
  if (!selected) return;

  state.selectedId = selected.id;
  el.detailEmpty.style.display = "none";
  el.thesisDetail.classList.remove("hidden");

  const detailRows = [
    detailRow(t("detailProfessor"), selected.professor),
    detailRow(t("detailArea"), selected.topic),
    detailRow(t("detailExperiment"), selected.experiment),
    detailRow(t("detailDescription"), selected.description, { linkify: true }),
    detailRow(t("detailRequirements"), selected.requirements),
    detailDisclosureRow(
      t("detailExperimentDesc"),
      findExperimentDescription(selected.experiment),
      t("detailExperimentOpen")
    ),
    detailRow(t("detailContact"), selected.email)
  ]
    .filter(Boolean)
    .join("");

  const linkMarkup = selected.link
    ? `<a class="link-btn" href="${escapeAttr(selected.link)}" target="_blank" rel="noreferrer">${t("detailApplyLink")}</a>`
    : "";

  el.thesisDetail.innerHTML = `
    <h2>${escapeHtml(selected.title)}</h2>
    <div class="detail-grid">${detailRows || `<p>${t("detailNoDetails")}</p>`}</div>
    ${linkMarkup}
  `;

  highlightSelection();
}

function detailRow(label, value, options = {}) {
  if (!value) return "";
  const renderedValue = options.linkify ? renderTextWithLinks(value) : escapeHtml(value);
  return `
    <div class="detail-row">
      <strong>${escapeHtml(label)}</strong>
      <p>${renderedValue}</p>
    </div>
  `;
}

function detailDisclosureRow(label, value, summaryLabel) {
  if (!value) return "";
  return `
    <div class="detail-row detail-row-disclosure">
      <strong>${escapeHtml(label)}</strong>
      <details class="detail-disclosure">
        <summary>${escapeHtml(summaryLabel)}</summary>
        <div class="detail-disclosure-content">${renderTextWithLinks(value)}</div>
      </details>
    </div>
  `;
}

function renderTextWithLinks(text) {
  const markdownLinks = [];
  const markdownRegex = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|www\.[^\s)]+)\)/gi;

  const withPlaceholders = String(text).replace(markdownRegex, (_, label, rawUrl) => {
    const href = rawUrl.startsWith("www.") ? `https://${rawUrl}` : rawUrl;
    const anchor = `<a href="${escapeAttr(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
    const token = `__MD_LINK_${markdownLinks.length}__`;
    markdownLinks.push({ token, anchor });
    return token;
  });

  let rendered = escapeHtml(withPlaceholders).replace(/\n/g, "<br>");
  const urlRegex = /\b(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

  rendered = rendered.replace(urlRegex, (match) => {
    const trailingPunctuation = /[.,;:!?)]$/;
    let clean = match;
    let trailing = "";

    while (trailingPunctuation.test(clean)) {
      trailing = clean.slice(-1) + trailing;
      clean = clean.slice(0, -1);
    }

    if (!clean) return match;

    const href = clean.startsWith("www.") ? `https://${clean}` : clean;
    return `<a href="${href}" target="_blank" rel="noreferrer">${clean}</a>${trailing}`;
  });

  markdownLinks.forEach(({ token, anchor }) => {
    rendered = rendered.replace(token, anchor);
  });

  return rendered;
}

function buildExperimentDescriptionMap(rows) {
  const descriptions = new Map();

  rows.forEach((row) => {
    const name = pickByAlias(row, experimentSheetAliases.name);
    const description = pickByAlias(row, experimentSheetAliases.description);
    if (!name || !description) return;

    const key = normalizeLookupKey(name);
    const existing = descriptions.get(key);

    if (!existing) {
      descriptions.set(key, description);
      return;
    }

    if (!existing.includes(description)) {
      descriptions.set(key, `${existing}\n\n${description}`);
    }
  });

  return descriptions;
}

function findExperimentDescription(experimentValue) {
  if (!experimentValue || state.experimentDescriptions.size === 0) return "";

  const matches = splitCommaValues(experimentValue)
    .map((name) => ({
      name,
      description: state.experimentDescriptions.get(normalizeLookupKey(name))
    }))
    .filter((item) => item.description);

  if (matches.length === 0) return "";
  if (matches.length === 1) return matches[0].description;

  return matches.map((item) => `${item.name}: ${item.description}`).join("\n\n");
}

function normalizeLookupKey(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function splitCommaValues(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function highlightSelection() {
  const items = el.thesisList.querySelectorAll(".thesis-item");
  items.forEach((item) => {
    item.classList.toggle("active", item.dataset.id === state.selectedId);
  });
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/`/g, "&#96;");
}
