const state = {
  allRows: [],
  filteredRows: [],
  selectedId: null
};

const columnAliases = {
  title: ["titolo", "title", "argomento"],
  professor: ["docente", "relatore", "supervisor", "professor"],
  topic: ["area", "topic", "settore", "categoria", "ambito"],
  experiment: ["esperimetno", "experiment"],
  language: ["lingua", "language"],
  description: ["descrizione", "description", "abstract", "sommario"],
  requirements: ["requisiti", "requirements", "prerequisiti"],
  email: ["email", "mail", "contatto"],
  link: ["link", "url", "modulo", "form", "application"]
};

const el = {
  statusMessage: document.getElementById("statusMessage"),
  thesisList: document.getElementById("thesisList"),
  detailEmpty: document.getElementById("detailEmpty"),
  thesisDetail: document.getElementById("thesisDetail"),
  searchInput: document.getElementById("searchInput"),
  topicFilter: document.getElementById("topicFilter"),
  professorFilter: document.getElementById("professorFilter"),
  languageFilter: document.getElementById("languageFilter"),
  clearFiltersBtn: document.getElementById("clearFiltersBtn"),
  resultsCount: document.getElementById("resultsCount")
};

init();

async function init() {
  bindEvents();

  if (!window.SHEETS_CONFIG || !window.SHEETS_CONFIG.csvUrl) {
    setStatus(
      "Configura config.js con l'URL CSV pubblico di Google Sheets per caricare le proposte.",
      true
    );
    return;
  }

  try {
    setStatus("Caricamento proposte...");
    const csv = await fetchCsv(window.SHEETS_CONFIG.csvUrl);
    const parsed = parseCsv(csv);
    state.allRows = normalizeRows(parsed);

    if (state.allRows.length === 0) {
      setStatus("Nessuna proposta trovata nel foglio.", true);
      return;
    }

    populateFilters(state.allRows);
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
    setStatus(
      "Errore durante il caricamento del foglio. Controlla che il link CSV sia pubblico e valido.",
      true
    );
  }
}

function bindEvents() {
  el.searchInput.addEventListener("input", applyFilters);
  el.topicFilter.addEventListener("change", applyFilters);
  el.professorFilter.addEventListener("change", applyFilters);
  el.languageFilter.addEventListener("change", applyFilters);

  el.clearFiltersBtn.addEventListener("click", () => {
    el.searchInput.value = "";
    el.topicFilter.value = "";
    el.professorFilter.value = "";
    el.languageFilter.value = "";
    applyFilters();
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
  fillSelect(el.topicFilter, uniqueValues(rows.map((r) => r.topic)));
  fillSelect(el.professorFilter, uniqueValues(rows.map((r) => r.professor)));
  fillSelect(el.languageFilter, uniqueValues(rows.map((r) => r.language)));
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

function applyFilters() {
  const query = el.searchInput.value.trim().toLowerCase();
  const selectedTopic = el.topicFilter.value;
  const selectedProfessor = el.professorFilter.value;
  const selectedLanguage = el.languageFilter.value;

  state.filteredRows = state.allRows.filter((row) => {
    const matchesQuery =
      !query ||
      [row.title, row.professor, row.topic, row.description, row.requirements]
        .join(" ")
        .toLowerCase()
        .includes(query);

    const matchesTopic = !selectedTopic || row.topic === selectedTopic;
    const matchesProfessor = !selectedProfessor || row.professor === selectedProfessor;
    const matchesLanguage = !selectedLanguage || row.language === selectedLanguage;

    return matchesQuery && matchesTopic && matchesProfessor && matchesLanguage;
  });

  renderList();

  if (!state.filteredRows.some((item) => item.id === state.selectedId)) {
    selectThesis(state.filteredRows[0]?.id);
  } else {
    highlightSelection();
  }

  el.resultsCount.textContent = `${state.filteredRows.length} risultat${state.filteredRows.length === 1 ? "o" : "i"}`;
}

function renderList() {
  el.thesisList.innerHTML = "";

  if (state.filteredRows.length === 0) {
    const empty = document.createElement("li");
    empty.className = "status";
    empty.textContent = "Nessuna proposta trovata con i filtri attuali.";
    el.thesisList.appendChild(empty);
    return;
  }

  state.filteredRows.forEach((row) => {
    const item = document.createElement("li");
    item.className = "thesis-item";
    item.dataset.id = row.id;

    const metaChunks = [];
    if (row.professor) metaChunks.push(`<span class="badge">${escapeHtml(row.professor)}</span>`);
    if (row.topic) metaChunks.push(`<span class="badge highlight">${escapeHtml(row.topic)}</span>`);
    if (row.language) metaChunks.push(`<span class="badge">${escapeHtml(row.language)}</span>`);

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
    detailRow("Docente", selected.professor),
    detailRow("Area", selected.topic),
    detailRow("Lingua", selected.language),
    detailRow("Requisiti", selected.requirements),
    detailRow("Contatto", selected.email),
    detailRow("Descrizione", selected.description)
  ]
    .filter(Boolean)
    .join("");

  const linkMarkup = selected.link
    ? `<a class="link-btn" href="${escapeAttr(selected.link)}" target="_blank" rel="noreferrer">Apri link candidatura</a>`
    : "";

  el.thesisDetail.innerHTML = `
    <h2>${escapeHtml(selected.title)}</h2>
    <div class="detail-grid">${detailRows || "<p>Nessun dettaglio aggiuntivo disponibile.</p>"}</div>
    ${linkMarkup}
  `;

  highlightSelection();
}

function detailRow(label, value) {
  if (!value) return "";
  return `
    <div class="detail-row">
      <strong>${escapeHtml(label)}</strong>
      <p>${escapeHtml(value)}</p>
    </div>
  `;
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
