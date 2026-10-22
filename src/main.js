import { incidents as sampleIncidents, signalAreas } from "./data/incidents.js";
import { confidenceFor, parseReport, recommendationReason, scoreIncident } from "./logic.js";

const incidents = sampleIncidents.map((incident) => ({ ...incident }));
const state = {
  selectedId: incidents[0].id,
  query: "",
  filter: "all",
  sort: "priority",
  showRoutes: true,
  showSignal: true
};
const $ = (selector) => document.querySelector(selector);
const incidentRows = $("#incident-rows");
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));

function selectedIncident() {
  return incidents.find((incident) => incident.id === state.selectedId) ?? incidents[0];
}

function priorityClass(tier) {
  return tier.toLowerCase();
}

function renderMetrics() {
  const open = incidents.filter((incident) => incident.status !== "Dispatched").length;
  const urgent = incidents.filter((incident) => incident.status !== "Dispatched" && scoreIncident(incident).score >= 70).length;
  $("#open-count").textContent = String(open).padStart(2, "0");
  $("#urgent-count").textContent = `${urgent} urgent`;
  $("#nav-count").textContent = String(open).padStart(2, "0");
  $("#queue-count").textContent = incidents.length;
  $("#total-count").textContent = incidents.length;
}

function visibleIncidents() {
  const query = state.query.trim().toLowerCase();
  return incidents
    .filter((incident) => {
      const searchText = [incident.id, incident.title, incident.location, incident.rawLocation, incident.category, incident.rawText, ...incident.needs].join(" ").toLowerCase();
      const matchesQuery = !query || searchText.includes(query);
      const score = scoreIncident(incident).score;
      const matchesFilter = state.filter === "all"
        || (state.filter === "urgent" && score >= 70)
        || (state.filter === "low-signal" && incident.signalGap);
      return matchesQuery && matchesFilter;
    })
    .sort((a, b) => state.sort === "priority"
      ? scoreIncident(b).score - scoreIncident(a).score || a.minutesAgo - b.minutesAgo
      : a.minutesAgo - b.minutesAgo);
}

function renderQueue() {
  const visible = visibleIncidents();
  incidentRows.innerHTML = visible.map((incident) => {
    const { score, tier } = scoreIncident(incident);
    const confidence = confidenceFor(incident);
    return `<tr class="incident-row ${incident.id === state.selectedId ? "selected" : ""} ${incident.status === "Dispatched" ? "row-dispatched" : ""}" data-id="${escapeHTML(incident.id)}" tabindex="0" aria-label="Select ${escapeHTML(incident.title)}, ${escapeHTML(tier)} priority, score ${score}">
      <td><span class="priority-cell ${priorityClass(tier)}"><span class="priority-dot"></span>${escapeHTML(tier === "Critical" ? "P1 Critical" : tier === "High" ? "P2 High" : tier === "Review" ? "P3 Review" : "P4 Monitor")}</span></td>
      <td><span class="incident-name">${escapeHTML(incident.title)}</span><span class="incident-id">${escapeHTML(incident.id)} <span>·</span> ${escapeHTML(incident.category)}</span></td>
      <td><span class="location-cell">⌖ ${escapeHTML(incident.shortLocation)}</span>${incident.signalGap ? '<span class="signal-flag">⌁ Limited signal</span>' : ""}</td>
      <td>${incident.people ? `<span class="people-cell">${incident.people} <span>people</span></span>` : '<span class="unknown-cell">Unconfirmed</span>'}</td>
      <td><span class="reported-cell">${escapeHTML(incident.reportedAt)}</span></td>
      <td><span class="confidence-cell confidence-${confidence.toLowerCase()}"><i></i>${escapeHTML(confidence)}</span></td>
      <td><span class="status-pill status-${incident.status === "Dispatched" ? "dispatched" : incident.status === "In progress" ? "progress" : incident.status === "Needs verification" ? "verify" : "review"}">${escapeHTML(incident.status)}</span></td>
      <td><button class="row-open" type="button" aria-label="Open ${escapeHTML(incident.id)}">›</button></td>
    </tr>`;
  }).join("");
  $("#empty-state").hidden = visible.length > 0;
  $("#showing-count").textContent = visible.length;
  $("#incident-rows").closest(".queue-table-wrap").classList.toggle("has-results", visible.length > 0);
  renderMetrics();
}

function renderMap() {
  $("#map-routes").classList.toggle("is-hidden", !state.showRoutes);
  const markerGroup = $("#map-markers");
  markerGroup.innerHTML = incidents.map((incident) => {
    const { tier } = scoreIncident(incident);
    const x = incident.map.x * 8;
    const y = incident.map.y * 4.6;
    const selected = incident.id === state.selectedId;
    return `<g class="map-marker marker-${priorityClass(tier)} ${selected ? "is-selected" : ""}" data-id="${escapeHTML(incident.id)}" role="button" tabindex="0" aria-label="${escapeHTML(incident.title)}: ${escapeHTML(tier)} priority" transform="translate(${x} ${y})">
      ${selected ? '<circle class="marker-selection" r="22"/>' : ""}
      <path class="marker-pin" d="M0-15c-8.3 0-15 6.7-15 15 0 11 15 25 15 25S15 11 15 0C15-8.3 8.3-15 0-15Z"/>
      <circle class="marker-center" r="5"/>
    </g>`;
  }).join("");
  $("#map-signal-gaps").innerHTML = state.showSignal ? signalAreas.map((area) =>
    `<g class="signal-area" transform="translate(${area.x * 8} ${area.y * 4.6})"><circle r="32"/><circle r="21"/><text y="47" text-anchor="middle">${escapeHTML(area.label)}</text></g>`
  ).join("") : "";
}

function renderDetail() {
  const incident = selectedIncident();
  const { score, tier, factors } = scoreIncident(incident);
  const confidence = confidenceFor(incident);
  $("#detail-priority").textContent = `${tier === "Critical" ? "P1 · CRITICAL" : tier === "High" ? "P2 · HIGH" : tier === "Review" ? "P3 · NEEDS REVIEW" : "P4 · MONITOR"}`;
  $("#detail-priority").className = `priority-label priority-${priorityClass(tier)}`;
  $("#confidence-label").textContent = `${confidence.toUpperCase()} CONFIDENCE`;
  $("#confidence-label").className = `confidence-pill confidence-${confidence.toLowerCase()}`;
  $("#detail-title").textContent = incident.title;
  $("#detail-location").innerHTML = `<span>⌖</span> ${escapeHTML(incident.location)} <span class="location-separator">·</span> ${escapeHTML(incident.reportedAt)}`;
  $("#score-value").innerHTML = `${score} <span>/ 100</span>`;
  $("#score-bar").style.width = `${score}%`;
  $("#score-bar").className = `score-fill ${priorityClass(tier)}`;
  $("#reason-list").innerHTML = factors.length
    ? factors.map((factor) => `<li><span class="reason-check">✓</span><span><strong>${escapeHTML(factor.label)}</strong><span>${escapeHTML(factor.detail)}</span></span><b>+${factor.points}</b></li>`).join("")
    : '<li><span class="reason-check reason-neutral">i</span><span><strong>No immediate risk signals reported</strong><span>Verify the report; missing data does not mean safe.</span></span><b>+0</b></li>';
  $("#signal-note").hidden = !incident.signalGap;
  $("#needs-list").innerHTML = incident.needs.length
    ? incident.needs.map((need) => `<span class="need-tag">${escapeHTML(need)}</span>`).join("")
    : '<span class="need-tag need-unknown">Needs not confirmed</span>';
  $("#dispatch-team").textContent = `${incident.dispatch.team} · ${incident.dispatch.responders} responders`;
  $("#dispatch-equipment").textContent = incident.dispatch.equipment.join(" · ");
  $("#dispatch-eta").textContent = `${incident.dispatch.eta} min`;
  $("#dispatch-explanation").textContent = recommendationReason(incident);
  const dispatched = incident.status === "Dispatched";
  $("#dispatch-button").disabled = dispatched;
  $("#dispatch-button").innerHTML = dispatched ? "✓ Dispatched (demo)" : "<span>↗</span> Confirm dispatch";
  $("#review-button").textContent = incident.status === "In progress" ? "Return to review" : "Mark for review";
  $("#review-button").disabled = dispatched;
  renderQueue();
  renderMap();
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove("visible"), 3200);
}

function selectIncident(id) {
  if (!incidents.some((incident) => incident.id === id)) return;
  state.selectedId = id;
  renderDetail();
}

incidentRows.addEventListener("click", (event) => {
  const row = event.target.closest("[data-id]");
  if (row) selectIncident(row.dataset.id);
});
incidentRows.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-id]")) {
    event.preventDefault();
    selectIncident(event.target.dataset.id);
  }
});
$("#map-markers").addEventListener("click", (event) => {
  const marker = event.target.closest("[data-id]");
  if (marker) selectIncident(marker.dataset.id);
});
$("#map-markers").addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.closest("[data-id]")) {
    event.preventDefault();
    selectIncident(event.target.closest("[data-id]").dataset.id);
  }
});

$("#search-input").addEventListener("input", (event) => {
  state.query = event.target.value;
  renderQueue();
});
$("#filter-button").addEventListener("click", () => {
  const row = $("#filter-row");
  row.hidden = !row.hidden;
  $("#filter-button").setAttribute("aria-expanded", String(!row.hidden));
});
$("#filter-row").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  $("#filter-row").querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("selected", chip === button));
  $("#filter-count").hidden = state.filter === "all";
  $("#filter-count").textContent = state.filter === "all" ? "" : "1";
  renderQueue();
});
$("#sort-button").addEventListener("click", () => {
  state.sort = state.sort === "priority" ? "recent" : "priority";
  $("#sort-button").innerHTML = state.sort === "priority" ? "<span>↕</span> Priority" : "<span>◷</span> Most recent";
  renderQueue();
});
$("#clear-filters").addEventListener("click", () => {
  state.query = "";
  state.filter = "all";
  $("#search-input").value = "";
  $("#filter-row").querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("selected", chip.dataset.filter === "all"));
  $("#filter-count").hidden = true;
  renderQueue();
});

$("#routes-toggle").addEventListener("click", (event) => {
  state.showRoutes = !state.showRoutes;
  event.currentTarget.classList.toggle("active", state.showRoutes);
  event.currentTarget.setAttribute("aria-pressed", String(state.showRoutes));
  renderMap();
});
$("#signal-toggle").addEventListener("click", (event) => {
  state.showSignal = !state.showSignal;
  event.currentTarget.classList.toggle("active", state.showSignal);
  event.currentTarget.setAttribute("aria-pressed", String(state.showSignal));
  renderMap();
});
$("#fit-map").addEventListener("click", () => {
  $("#map-canvas").classList.toggle("map-focused");
  showToast("Map view adjusted to the response area.");
});
$("#review-button").addEventListener("click", () => {
  const incident = selectedIncident();
  incident.status = incident.status === "In progress" ? "Needs review" : "In progress";
  renderDetail();
  showToast(`${incident.id} ${incident.status === "In progress" ? "marked for coordinator review" : "returned to the review queue"}.`);
});
$("#dispatch-button").addEventListener("click", () => {
  const incident = selectedIncident();
  if (incident.status === "Dispatched") return;
  const approved = window.confirm(`Confirm demo dispatch?\n\n${incident.dispatch.team} · ${incident.dispatch.responders} responders\n${incident.dispatch.equipment.join(", ")}\n\nThis only updates the local demo. No team will be contacted.`);
  if (!approved) return;
  incident.status = "Dispatched";
  renderDetail();
  showToast(`Demo dispatch recorded for ${incident.id}. No team was contacted.`);
});

const dialog = $("#report-dialog");
const reportForm = $("#report-form");
const reportText = $("#report-text");
$("#new-report-button").addEventListener("click", () => dialog.showModal());
reportText.addEventListener("input", () => {
  const preview = $("#parse-preview");
  if (!reportText.value.trim()) {
    preview.innerHTML = '<span class="preview-icon">✳</span><span><strong>Suggestions appear as you type</strong><span>You can review and correct them before adding.</span></span>';
    return;
  }
  const parsed = parseReport(reportText.value);
  const suggestions = [parsed.category, ...parsed.needs].join(" · ");
  preview.innerHTML = `<span class="preview-icon">✳</span><span><strong>Suggested: ${escapeHTML(suggestions || "General report")}</strong><span>${escapeHTML(parsed.confidence)} confidence · Review suggestions before coordinating.</span></span>`;
});
reportForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  if (!reportForm.reportValidity()) return;
  const rawText = reportText.value.trim();
  const parsed = parseReport(rawText);
  const location = $("#report-location").value.trim();
  const peopleValue = $("#report-people").value;
  const people = peopleValue ? Math.max(0, Number(peopleValue)) : 0;
  const titleText = rawText.replace(/^[\s!?.—-]+/, "").split(/[.!?\n]/)[0].trim();
  const title = titleText.length > 52 ? `${titleText.slice(0, 49).trimEnd()}…` : titleText;
  const idNumber = 2049 + incidents.filter((incident) => incident.id.startsWith("NV-20")).length - 8;
  const point = (incidents.length * 37) % 72;
  const incident = {
    id: `NV-${idNumber}`,
    title: title || `${parsed.category} report`,
    category: parsed.category,
    location,
    shortLocation: location.split(/[·,]/)[0].trim(),
    rawLocation: location,
    people,
    reportedAt: "Just now",
    minutesAgo: 0,
    confidence: parsed.confidence,
    corroborations: parsed.corroborations,
    lifeSafety: parsed.lifeSafety,
    needs: parsed.needs.length ? parsed.needs : ["Needs to be confirmed"],
    conditions: parsed.conditions,
    rawText,
    signalGap: false,
    status: "Needs review",
    map: { x: 12 + point, y: 15 + ((incidents.length * 23) % 67) },
    dispatch: { team: "Coordinator to assign", responders: 0, equipment: parsed.needs.length ? parsed.needs : ["Needs assessment"], eta: "—" }
  };
  incidents.unshift(incident);
  state.selectedId = incident.id;
  state.filter = "all";
  $("#search-input").value = "";
  state.query = "";
  $("#filter-row").querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("selected", chip.dataset.filter === "all"));
  $("#filter-count").hidden = true;
  reportForm.reset();
  $("#parse-preview").innerHTML = '<span class="preview-icon">✳</span><span><strong>Suggestions appear as you type</strong><span>You can review and correct them before adding.</span></span>';
  dialog.close();
  renderDetail();
  showToast(`${incident.id} added to the queue for coordinator review.`);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) && !dialog.open) {
    event.preventDefault();
    $("#search-input").focus();
  }
});

function updateClock() {
  $("#clock").textContent = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
}
updateClock();
window.setInterval(updateClock, 1000);
renderDetail();
