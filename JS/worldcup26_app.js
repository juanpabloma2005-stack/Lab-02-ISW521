"use strict";

/* ──────────────────────────────────────────────────────
   CONFIGURACIÓN Y ESTADO DE LA APLICACIÓN
────────────────────────────────────────────────────── */
const BASE = "https://worldcup26.ir";

const state = {
  teams: [],
  games: [],
  stadiums: [],
  groups: [],
  stadiumsError: false,
  teamsErrorBackoff: false,
  gamesErrorBackoff: false,
  groupsErrorBackoff: false
};

// Contadores de fallos consecutivos por endpoint para el cálculo del backoff
let failures = { stadiums: 0, teams: 0, games: 0, groups: 0 };
let countdownIntervals = {};

/* ──────────────────────────────────────────────────────
   SISTEMA DE NAVEGACIÓN ENTRE PANTALLAS
────────────────────────────────────────────────────── */
function setupNavigation() {
  const tabs = document.querySelectorAll(".nav-tab");
  const sections = document.querySelectorAll(".app-section");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetId = tab.getAttribute("data-target");

      // Limpiar clases activas en los botones de navegación
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      // Controlar visibilidad de las ventanas usando la clase CSS modular
      sections.forEach(s => s.classList.add("app-section-hidden"));
      const targetSection = document.getElementById(targetId);
      if (targetSection) targetSection.classList.remove("app-section-hidden");

      // Forzar recálculo analítico al cambiar de pestaña con datos frescos
      if (targetId === "sectionGoleadas") processGoleadas();
      if (targetId === "sectionMuro") processMuro();
      if (targetId === "sectionEstadios") processEstadios();
      if (targetId === "sectionRadar") processRadar();
    });
  });
}

/* ──────────────────────────────────────────────────────
   VENTANA 2.1: LA RUTA DEL CAMPEÓN
────────────────────────────────────────────────────── */
function populateTeamSelector() {
  const teamSelect = document.getElementById("teamSelect");
  if (!teamSelect) return;

  const sorted = [...state.teams].sort((a, b) => (a.name_en ?? "").localeCompare(b.name_en ?? ""));
  
  // Agregar indicador visual en la etiqueta del selector si los datos provienen del localStorage (modo offline)
  const isStale = localStorage.getItem("cache_teams_is_stale") === "true";
  const labelSuffix = isStale ? " (Datos desactualizados)" : "";
  
  teamSelect.innerHTML = `<option value="">— Selecciona un equipo (${sorted.length})${labelSuffix} —</option>`;

  sorted.forEach(team => {
    const opt = document.createElement("option");
    opt.value = String(team.id);
    opt.textContent = team.name_en + (isStale ? " [Offline]" : "");
    teamSelect.appendChild(opt);
  });

  teamSelect.disabled = false;
  
  teamSelect.onchange = (e) => {
    const tid = Number(e.target.value);
    if (!tid) {
      document.getElementById("teamInfo").classList.remove("visible");
      document.getElementById("statsBar").classList.remove("visible");
      document.getElementById("citiesSection").classList.remove("visible");
      document.getElementById("sectionEyebrow").classList.remove("visible");
      document.getElementById("cardsGrid").innerHTML = "";
      return;
    }
    renderRutaCampeon(tid);
  };
}

function renderRutaCampeon(teamId) {
  const team = state.teams.find(t => Number(t.id) === teamId);
  if (!team) return;
  
  const teamInfo = document.getElementById("teamInfo");
  teamInfo.classList.add("visible");
  document.getElementById("teamFlagImg").src = team.flag;
  document.getElementById("teamName").textContent = team.name_en;

  // Filtrado resiliente transformando IDs a números siempre
  const filteredGames = state.games.filter(g => Number(g.home_team_id) === teamId || Number(g.away_team_id) === teamId);
  
  // Ordenar cronológicamente usando la propiedad 'date' de la API
  filteredGames.sort((a, b) => new Date(a.date || a.local_date) - new Date(b.date || b.local_date));

  let homeCount = 0, awayCount = 0;
  const uniqueCities = new Set();
  const cardsGrid = document.getElementById("cardsGrid");
  cardsGrid.innerHTML = "";

  filteredGames.forEach(game => {
    const isHome = Number(game.home_team_id) === teamId;
    if (isHome) homeCount++; else awayCount++;

    const homeT = state.teams.find(t => Number(t.id) === Number(game.home_team_id));
    const awayT = state.teams.find(t => Number(t.id) === Number(game.away_team_id));
    const stadium = state.stadiums.find(s => Number(s.id) === Number(game.stadium_id));

    let stadName = "Estadio no disponible", cityStr = "Ubicación desconocida", capStr = "—", errClass = "";
    
    // Cumplir 2.1: Si falla la petición a stadiums, las tarjetas NO desaparecen, muestran "Estadio no disponible"
    if (state.stadiumsError || !stadium) {
      errClass = "stadium-error";
    } else {
      stadName = stadium.name_en ?? "Estadio Sede";
      cityStr = stadium.city_en ?? "Ciudad Sede";
      capStr = stadium.capacity ? Number(stadium.capacity).toLocaleString() : "—";
      if (stadium.city_en) uniqueCities.add(stadium.city_en);
    }

    // Agregar aviso discreto de datos obsoletos si provienen del localStorage
    const gamesStale = localStorage.getItem("cache_games_is_stale") === "true";
    const stadiumsStale = localStorage.getItem("cache_stadiums_is_stale") === "true";
    const staleIndicator = (gamesStale || stadiumsStale) ? " <small style='color:var(--text-3);'>(Caché)</small>" : "";

    const fechaPartido = game.date || game.local_date || "Fecha por definir";

    const card = document.createElement("div");
    card.className = `match-card ${isHome ? 'home' : 'away'} ${errClass}`;
    card.innerHTML = `
      <div class="card-stripe"></div>
      <div class="card-header">
        <div class="card-matchup">
          <div class="card-round">${game.round_name || 'Fase de Grupos'}${staleIndicator}</div>
          <div class="card-teams">${homeT ? homeT.name_en : 'ID '+game.home_team_id} vs ${awayT ? awayT.name_en : 'ID '+game.away_team_id}</div>
        </div>
        <span class="card-role-badge ${isHome ? 'role-home' : 'role-away'}">${isHome ? 'Local' : 'Visitante'}</span>
      </div>
      <div class="card-body">
        <div class="card-row"><div class="card-icon">📅</div><div class="card-row-content"><div class="card-row-value">${fechaPartido}</div></div></div>
        <div class="card-row"><div class="card-icon">🏟️</div><div class="card-row-content"><div class="card-row-value">${stadName}</div><div class="card-row-sub">${cityStr}</div></div></div>
        <div class="card-row"><div class="card-icon">👥</div><div class="card-row-content"><div class="card-row-value">${capStr} Asistentes</div></div></div>
      </div>
    `;
    cardsGrid.appendChild(card);
  });

  document.getElementById("statGames").textContent = filteredGames.length;
  document.getElementById("statCities").textContent = state.stadiumsError ? "—" : uniqueCities.size;
  document.getElementById("statHome").textContent = homeCount;
  document.getElementById("statAway").textContent = awayCount;

  const chipsDiv = document.getElementById("citiesChips");
  chipsDiv.innerHTML = "";
  uniqueCities.forEach(c => {
    const s = document.createElement("span"); 
    s.className = "city-chip"; 
    s.textContent = c; 
    chipsDiv.appendChild(s);
  });
  document.getElementById("citiesSection").classList.toggle("visible", !state.stadiumsError);
  document.getElementById("eyebrowCount").textContent = filteredGames.length;
  document.getElementById("sectionEyebrow").classList.add("visible");
}

/* ──────────────────────────────────────────────────────
   VENTANA 2.2: RASTREADOR DE GOLEADAS
────────────────────────────────────────────────────── */
function processGoleadas() {
  const grid = document.getElementById("goleadasGrid");
  const alertB = document.getElementById("teamsBackoffAlert");
  if (!grid) return;

  const matches = state.games.filter(g => {
    const isFinished = g.finished === true || String(g.finished).toLowerCase() === "true" || String(g.status).toLowerCase() === "finished";
    if (!isFinished || g.home_score === null || g.away_score === null) return false;
    const diff = Math.abs(Number(g.home_score) - Number(g.away_score));
    return diff >= 3;
  });

  matches.sort((a, b) => Math.abs(Number(b.home_score) - Number(b.away_score)) - Math.abs(Number(a.home_score) - Number(a.away_score)));

  document.getElementById("goleadasCount").textContent = matches.length;
  alertB.classList.toggle("visible", state.teamsErrorBackoff);
  grid.innerHTML = "";

  const teamsStale = localStorage.getItem("cache_teams_is_stale") === "true";

  matches.forEach(game => {
    const diff = Math.abs(Number(game.home_score) - Number(game.away_score));
    const homeT = state.teams.find(t => Number(t.id) === Number(game.home_team_id));
    const awayT = state.teams.find(t => Number(t.id) === Number(game.away_team_id));

    // Cumplir 2.2: Si /get/teams falla, renderiza igual usando los ID de respaldo temporalmente
    const hName = homeT ? homeT.name_en + (teamsStale ? " (Caché)" : "") : `ID: ${game.home_team_id} (Pendiente)`;
    const aName = awayT ? awayT.name_en + (teamsStale ? " (Caché)" : "") : `ID: ${game.away_team_id} (Pendiente)`;
    const hFlag = homeT ? `<img src="${homeT.flag}" style="width:20px;"> ` : "🏳️ ";
    const aFlag = awayT ? `<img src="${awayT.flag}" style="width:20px;"> ` : "🏳️ ";

    const card = document.createElement("div");
    card.className = "match-card";
    card.innerHTML = `
      <div class="card-stripe"></div>
      <div class="card-header">
        <div class="card-matchup">
          <div class="card-round">Diferencia de +${diff} goles</div>
          <div class="card-teams" style="font-size:1.1rem; line-height:1.8;">
            <div>${hFlag}${hName} <b>${game.home_score}</b></div>
            <div>${aFlag}${aName} <b>${game.away_score}</b></div>
          </div>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

/* ──────────────────────────────────────────────────────
   VENTANA 2.3: EL MURO
────────────────────────────────────────────────────── */
function processMuro() {
  const grid = document.getElementById("muroGrid");
  if (!grid) return;
  grid.innerHTML = "";

  // 1. Obtener la lista única de IDs de los equipos presentes en los grupos
  let equipoIds = [];
  state.groups.forEach(g => {
    if (g.teams) {
      g.teams.forEach(t => {
        const id = Number(t.team_id);
        if (!equipoIds.includes(id)) {
          equipoIds.push(id);
        }
      });
    }
  });

  // 2. Calcular en tiempo real los Goles Recibidos (GA) cruzando con state.games
  let unificados = equipoIds.map(teamId => {
    let golesEnContraTotales = 0;

    state.games.forEach(g => {
      const isFinished = g.finished === true || String(g.finished).toLowerCase() === "true" || String(g.status).toLowerCase() === "finished";
      // Solo sumamos si el partido ya concluyó y tiene marcadores válidos
      if (isFinished && g.home_score !== null && g.away_score !== null) {
        if (Number(g.home_team_id) === teamId) {
          // Si jugó como local, los goles en contra son los que metió el visitante
          golesEnContraTotales += Number(g.away_score);
        } else if (Number(g.away_team_id) === teamId) {
          // Si jugó como visitante, los goles en contra son los que metió el local
          golesEnContraTotales += Number(g.home_score);
        }
      }
    });

    return { team_id: teamId, ga: golesEnContraTotales };
  });

  // 3. Ordenar de menor a mayor cantidad de goles recibidos (Meores Defensas)
  unificados.sort((a, b) => a.ga - b.ga);
  const top5 = unificados.slice(0, 5);

  top5.forEach(def => {
    const teamObj = state.teams.find(t => Number(t.id) === def.team_id);
    const tName = teamObj ? teamObj.name_en : `Equipo #${def.team_id}`;
    const tFlag = teamObj ? teamObj.flag : "";

    // Buscar partidos del equipo para determinar rivales
    const todosLosPartidos = state.games.filter(g => {
      return Number(g.home_team_id) === def.team_id || Number(g.away_team_id) === def.team_id;
    });

    const partidosFuturos = todosLosPartidos.filter(g => {
      const isFinished = g.finished === true || String(g.finished).toLowerCase() === "true" || String(g.status).toLowerCase() === "finished";
      return !isFinished;
    });

    partidosFuturos.sort((a, b) => new Date(a.date || a.local_date) - new Date(b.date || b.local_date));

    let labelEncuentro = "Siguiente Encuentro";
    let rivalText = "Sin encuentros programados";

    if (state.gamesErrorBackoff) {
      rivalText = "Próximo rival no disponible"; 
    } else if (partidosFuturos.length > 0) {
      const nextMatch = partidosFuturos[0];
      const isHome = Number(nextMatch.home_team_id) === def.team_id;
      const rivalId = isHome ? Number(nextMatch.away_team_id) : Number(nextMatch.home_team_id);
      const rivalObj = state.teams.find(t => Number(t.id) === rivalId);
      rivalText = rivalObj ? `vs ${rivalObj.name_en}` : `vs Equipo #${rivalId}`;
    } else if (todosLosPartidos.length > 0) {
      todosLosPartidos.sort((a, b) => new Date(b.date || b.local_date) - new Date(a.date || a.local_date));
      const lastMatch = todosLosPartidos[0];
      const isHome = Number(lastMatch.home_team_id) === def.team_id;
      const rivalId = isHome ? Number(lastMatch.away_team_id) : Number(lastMatch.home_team_id);
      const rivalObj = state.teams.find(t => Number(t.id) === rivalId);
      
      labelEncuentro = "Último Encuentro (Fin de Torneo)";
      rivalText = rivalObj ? `vs ${rivalObj.name_en}` : `vs Equipo #${rivalId}`;
    }

    const groupsStale = localStorage.getItem("cache_groups_is_stale") === "true";
    const gamesStale = localStorage.getItem("cache_games_is_stale") === "true";
    const staleLabel = (groupsStale || gamesStale) ? " <span style='font-size:0.7rem; color:var(--text-3);'>(Caché)</span>" : "";

    const card = document.createElement("div");
    card.className = "match-card home";
    card.innerHTML = `
      <div class="card-stripe"></div>
      <div class="card-header">
        <div class="card-matchup">
          <div class="card-round">Goles en Contra Totales: ${def.ga}${staleLabel}</div>
          <div class="card-teams" style="display:flex; align-items:center; gap:0.5rem;">
            ${tFlag ? `<img src="${tFlag}" style="width:28px;">` : ""} <span>${tName}</span>
          </div>
        </div>
      </div>
      <div class="card-body" style="border-top:1px solid var(--border); padding-top:0.75rem;">
        <div class="card-row-label">${labelEncuentro}</div>
        <div class="card-row-value" style="color:var(--gold);">${rivalText}</div>
      </div>
    `;
    grid.appendChild(card);
  });
}
/* ──────────────────────────────────────────────────────
   VENTANA 2.4: ANALÍTICA DE ESTADIOS
────────────────────────────────────────────────────── */
function processEstadios() {
  const grid = document.getElementById("estadiosGrid");
  const errB = document.getElementById("estadiosErrorBanner");
  if (!grid) return;

  // Mostramos el banner informativo superior
  errB.classList.toggle("visible", state.gamesErrorBackoff);
  grid.innerHTML = "";

  let dataset = state.stadiums.map(stad => {
    const count = state.games.filter(g => Number(g.stadium_id) === Number(stad.id)).length;
    const potencia = Number(stad.capacity || 0) * count;
    return { ...stad, count, potencial: potencia };
  });

  dataset.sort((a, b) => b.potencial - a.potencial);

  dataset.forEach(st => {
    const card = document.createElement("div");
    card.className = "match-card away";
    const pct = Math.min((Number(st.capacity) / 100000) * 100, 100);
    const realName = st.name_en || st.name || st.title || "Estadio Sede";

    // Cumplir 2.4: Si la petición de partidos falla, la gráfica entra en estado "esperando datos de partidos" sin destruir las barras ya dibujadas.
    const asignadosTexto = state.gamesErrorBackoff ? '<span style="color:var(--gold);">esperando datos de partidos (Reintentando...)</span>' : st.count;
    const potencialTexto = state.gamesErrorBackoff ? '<span style="font-size:1rem; color:var(--text-3);">esperando datos...</span>' : st.potencial.toLocaleString();

    const stadiumsStale = localStorage.getItem("cache_stadiums_is_stale") === "true";
    const cacheIndicator = stadiumsStale ? " <small style='color:var(--text-3); font-size:0.7rem;'>(Offline)</small>" : "";

    card.innerHTML = `
      <div class="card-stripe"></div>
      <div class="card-body" style="padding-top:1.1rem;">
        <div style="font-family:var(--font-display); font-size:1.3rem; color:var(--text);">${realName}${cacheIndicator}</div>
        <div style="font-size:0.8rem; color:var(--text-3); margin-bottom:0.5rem;">${st.city_en || 'Sede'}, ${st.country || 'Mundial'}</div>
        
        <div class="card-row-label" style="margin-top:0.5rem;">Partidos Asignados: ${asignadosTexto}</div>
        <div class="card-row-label">Asistencia Máxima Potencial:</div>
        <div style="font-size:1.4rem; font-family:var(--font-mono); color:var(--gold); font-weight:bold;">
          ${potencialTexto}
        </div>

        <div style="background:var(--surface); height:8px; border-radius:4px; margin-top:0.5rem; overflow:hidden;">
          <div style="background:var(--gold); width:${pct}%; height:100%;"></div>
        </div>
        <div style="font-size:0.65rem; text-align:right; color:var(--text-3); margin-top:0.2rem;">Capacidad: ${Number(st.capacity).toLocaleString()}</div>
      </div>
    `;
    grid.appendChild(card);
  });
}

/* ──────────────────────────────────────────────────────
   VENTANA 2.5: RADAR DE EMPATES
────────────────────────────────────────────────────── */
function processRadar() {
  const container = document.getElementById("radarContainer");
  if (!container) return;
  container.innerHTML = "";

  // Elemento discreto de estatus visual en la UI para la matriz (sin alert)
  if (state.gamesErrorBackoff) {
    const infoMsg = document.createElement("div");
    infoMsg.style.padding = "1rem";
    infoMsg.style.marginBottom = "1rem";
    infoMsg.style.background = "var(--gold-glow)";
    infoMsg.style.border = "1px solid var(--gold-dim)";
    infoMsg.style.borderRadius = "var(--radius)";
    infoMsg.style.color = "var(--gold)";
    infoMsg.style.fontSize = "0.9rem";
    infoMsg.style.textAlign = "center";
    infoMsg.innerHTML = "⚠️ <strong>Modo de Resiliencia Activo:</strong> Sincronizando datos de partidos en segundo plano...";
    container.appendChild(infoMsg);
  }

  const empates = state.games.filter(g => {
    const isFinished = g.finished === true || String(g.finished).toLowerCase() === "true" || String(g.status).toLowerCase() === "finished";
    if (!isFinished || g.home_score === null || g.away_score === null || g.home_score === "" || g.away_score === "") return false;
    return Number(g.home_score) === Number(g.away_score);
  });
  
  const letrasGrupos = ["A","B","C","D","E","F","G","H","I","J","K","L"];

  letrasGrupos.forEach(letra => {
    const empatesDelGrupo = empates.filter(g => String(g.group).toUpperCase() === letra);

    const grupoDiv = document.createElement("div");
    grupoDiv.style.background = "var(--surface)";
    grupoDiv.style.border = "1px solid var(--border)";
    grupoDiv.style.borderRadius = "var(--radius)";
    grupoDiv.style.padding = "1.25rem";

    // Cumplir 2.5: Si hay error/429 procesando la matriz, los grupos ya dibujados permanecen visibles intactos
    grupoDiv.innerHTML = `
      <div style="display:flex; justify-content:between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:0.5rem; margin-bottom:1rem;">
        <span style="font-family:var(--font-display); font-size:1.4rem; color:var(--gold);">GRUPO ${letra}</span>
        <span style="margin-left:auto; font-family:var(--font-mono); font-size:0.8rem; background:var(--gold-glow); border:1px solid var(--gold-dim); padding:0.2rem 0.6rem; border-radius:999px; color:var(--gold);">
          ${empatesDelGrupo.length} Empates
        </span>
      </div>
    `;

    const grid = document.createElement("div");
    grid.className = "cards-grid";

    empatesDelGrupo.forEach(em => {
      const hT = state.teams.find(t => Number(t.id) === Number(em.home_team_id));
      const aT = state.teams.find(t => Number(t.id) === Number(em.away_team_id));

      const cell = document.createElement("div");
      cell.style.background = "var(--card)";
      cell.style.border = "1px solid var(--border)";
      cell.style.padding = "0.75rem";
      cell.style.borderRadius = "var(--radius-sm)";
      cell.style.textAlign = "center";
      cell.style.fontFamily = "var(--font-mono)";
      cell.style.fontSize = "0.85rem";

      cell.innerHTML = `
        <div style="color:var(--text);">${hT ? hT.name_en : 'ID '+em.home_team_id}</div>
        <div style="color:var(--gold); margin:0.2rem 0; font-weight:bold;">${em.home_score} - ${em.away_score}</div>
        <div style="color:var(--text);">${aT ? aT.name_en : 'ID '+em.away_team_id}</div>
      `;
      grid.appendChild(cell);
    });

    if (empatesDelGrupo.length === 0) {
      const vacio = document.createElement("div");
      vacio.style.color = "var(--text-3)";
      vacio.style.fontSize = "0.85rem";
      vacio.textContent = state.gamesErrorBackoff ? "Esperando actualización de partidos..." : "No se registraron empates finalizados en este grupo.";
      grupoDiv.appendChild(vacio);
    } else {
      grupoDiv.appendChild(grid);
    }

    container.appendChild(grupoDiv);
  });
}

/* ──────────────────────────────────────────────────────
   SISTEMA CENTRAL DE MANEJO DE ERRORES Y BACKOFF EXPONENCIAL
────────────────────────────────────────────────────── */
function handleHttpError(status, retryFunction, endpointKey, bannerId) {
  // Incrementar siempre el contador de fallos para este endpoint
  failures[endpointKey]++;
  
  // Calcular delay con backoff exponencial: 1s (2^0), 2s (2^1), 4s (2^2), 8s (2^3)...
  const delaySeconds = Math.pow(2, failures[endpointKey] - 1);
  const delayMs = delaySeconds * 1000;
  
  const banner = document.getElementById(bannerId);
  if (banner) {
    banner.classList.add("visible");
    const msgElement = banner.querySelector(".alert-text") || banner;
    
    if (status === 429) {
      let timeLeft = delaySeconds;
      if (countdownIntervals[endpointKey]) clearInterval(countdownIntervals[endpointKey]);

      const updateMessage = () => {
        msgElement.innerHTML = `<strong>Límite excedido (Error 429) en /get/${endpointKey}.</strong> Reintentando automáticamente en <b style="color:var(--gold); font-size:1.1rem;">${timeLeft}s</b> (Intento #${failures[endpointKey]})...`;
      };
      updateMessage();

      // Countdown visible
      countdownIntervals[endpointKey] = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
          clearInterval(countdownIntervals[endpointKey]);
        } else {
          updateMessage();
        }
      }, 1000);
    } else if (status === 500) {
      msgElement.innerHTML = `<strong>Error de servidor (Error 500) en /get/${endpointKey}.</strong> Reintento programado en <b style="color:var(--gold);">${delaySeconds}s</b> (Intento #${failures[endpointKey]})...`;
    } else {
      msgElement.innerHTML = `<strong>Conexión con /get/${endpointKey} no disponible.</strong> Modo offline. Reintento en <b style="color:var(--gold);">${delaySeconds}s</b> (Intento #${failures[endpointKey]})...`;
    }
  }

  console.warn(`[Backoff Exponencial] /get/${endpointKey} | Intento #${failures[endpointKey]} fallido. Reintentando en ${delaySeconds}s...`);
  
  setTimeout(() => {
    retryFunction();
  }, delayMs);
}

/* ──────────────────────────────────────────────────────
   PETICIONES DE RED ASÍNCRONAS REVISADAS
────────────────────────────────────────────────────── */
/* ──────────────────────────────────────────────────────
   PETICIONES DE RED ASÍNCRONAS CON ASYNC / AWAIT
────────────────────────────────────────────────────── */

async function loadStadiums() {
  try {
    const res = await fetch(`${BASE}/get/stadiums`);
    
    // Si la respuesta HTTP no es exitosa (ej. 429, 500, 404)
    if (!res.ok) {
      const error = new Error(`HTTP ${res.status}`);
      error.status = res.status;
      throw error; // Esto nos envía directamente al bloque catch
    }

    const data = await res.json();

    state.stadiums = data.stadiums || [];
    state.stadiumsError = false;
    failures.stadiums = 0; // Reiniciamos fallos

    localStorage.setItem("cache_stadiums", JSON.stringify(state.stadiums));
    localStorage.setItem("cache_stadiums_is_stale", "false");

    if (countdownIntervals.stadiums) clearInterval(countdownIntervals.stadiums);
    const banner = document.getElementById("alertBanner");
    if (banner) banner.classList.remove("visible");

    const activeSection = document.querySelector(".nav-tab.active");
    if (activeSection && activeSection.getAttribute("data-target") === "sectionEstadios") {
      processEstadios();
    }

  } catch (err) {
    state.stadiumsError = true;

    // Respaldo de caché local si existe
    if (localStorage.getItem("cache_stadiums")) {
      state.stadiums = JSON.parse(localStorage.getItem("cache_stadiums")) || [];
      localStorage.setItem("cache_stadiums_is_stale", "true");
      const activeSection = document.querySelector(".app-section:not(.app-section-hidden)");
      if (activeSection && activeSection.id === "sectionEstadios") processEstadios();
    }

    const httpStatus = err.status || "NETWORK_ERROR";
    handleHttpError(httpStatus, loadStadiums, "stadiums", "alertBanner");
  }
}

async function loadTeams() {
  try {
    const res = await fetch(`${BASE}/get/teams`);

    if (!res.ok) {
      const error = new Error(`HTTP ${res.status}`);
      error.status = res.status;
      throw error;
    }

    const data = await res.json();

    state.teams = data.teams || [];
    state.teamsErrorBackoff = false;
    failures.teams = 0;

    localStorage.setItem("cache_teams", JSON.stringify(state.teams));
    localStorage.setItem("cache_teams_is_stale", "false");

    if (countdownIntervals.teams) clearInterval(countdownIntervals.teams);
    const banner = document.getElementById("teamsBackoffAlert");
    if (banner) banner.classList.remove("visible");

    populateTeamSelector();
    processGoleadas();
    processMuro();

  } catch (err) {
    state.teamsErrorBackoff = true;

    if (localStorage.getItem("cache_teams")) {
      state.teams = JSON.parse(localStorage.getItem("cache_teams")) || [];
      localStorage.setItem("cache_teams_is_stale", "true");
      populateTeamSelector();
      processGoleadas();
    }

    const httpStatus = err.status || "NETWORK_ERROR";
    handleHttpError(httpStatus, loadTeams, "teams", "teamsBackoffAlert");
  }
}
async function loadGames() {
  try {
    const res = await fetch(`${BASE}/get/games`);
    if (!res.ok) {
      const error = new Error(`HTTP ${res.status}`);
      error.status = res.status;
      throw error;
    }

    const data = await res.json();
    state.games = data.games || [];
    state.gamesErrorBackoff = false;
    failures.games = 0;

    localStorage.setItem("cache_games", JSON.stringify(state.games));
    localStorage.setItem("cache_games_is_stale", "false");

    if (countdownIntervals.games) clearInterval(countdownIntervals.games);
    const banner = document.getElementById("estadiosErrorBanner");
    if (banner) banner.classList.remove("visible");

    renderizarModulosDependientesDeJuegos();
  } catch (err) {
    state.gamesErrorBackoff = true;

    if (localStorage.getItem("cache_games")) {
      state.games = JSON.parse(localStorage.getItem("cache_games")) || [];
      localStorage.setItem("cache_games_is_stale", "true");
      renderizarModulosDependientesDeJuegos();
    }

    const httpStatus = err.status || "NETWORK_ERROR";
    handleHttpError(httpStatus, loadGames, "games", "estadiosErrorBanner");
  }
}

async function loadGroups() {
  try {
    const res = await fetch(`${BASE}/get/groups`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    state.groups = data.groups || [];
    state.groupsErrorBackoff = false;
    failures.groups = 0;

    localStorage.setItem("cache_groups", JSON.stringify(state.groups));
    localStorage.setItem("cache_groups_is_stale", "false");
    processMuro();
  } catch (err) {
    if (localStorage.getItem("cache_groups")) {
      state.groups = JSON.parse(localStorage.getItem("cache_groups")) || [];
      localStorage.setItem("cache_groups_is_stale", "true");
      processMuro();
    }
  }
}

// Función principal que dispara ambas en paralelo
function loadGamesAndGroups() {
  loadGames();
  loadGroups();
}

// Función helper para refrescar módulos dependientes del canal de juegos de forma segura
function renderizarModulosDependientesDeJuegos() {
  const teamSelect = document.getElementById("teamSelect");
  if (teamSelect && teamSelect.value) {
    renderRutaCampeon(Number(teamSelect.value));
  }
  
  const activeTab = document.querySelector(".nav-tab.active");
  if (activeTab) {
    const currentTarget = activeTab.getAttribute("data-target");
    if (currentTarget === "sectionGoleadas") processGoleadas();
    if (currentTarget === "sectionMuro") processMuro();
    if (currentTarget === "sectionEstadios") processEstadios();
    if (currentTarget === "sectionRadar") processRadar();
  }
}

/* ──────────────────────────────────────────────────────
   INICIALIZADOR DE LA APLICACIÓN
────────────────────────────────────────────────────── */
function init() {
  setupNavigation();
  loadTeams();
  loadGamesAndGroups();
  loadStadiums();
}

init();