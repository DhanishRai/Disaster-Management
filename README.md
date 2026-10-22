# Fieldline

**Emergency response coordination, with a human in control.**

Fieldline is a ready-to-run, dependency-free disaster response dashboard for control rooms, rescue teams, NGOs, and volunteer coordinators. It turns noisy incoming reports into a transparent, reviewable incident queue and helps a coordinator decide what to send where first.

> **Demo data only.** The included incident reports, map, locations, teams, and dispatch suggestions are simulated. This prototype is not connected to emergency services, live maps, or a dispatch system. Never use it as the sole basis for a real emergency response.

## Run it

Requires Node.js 18 or newer. No package installation or build step is needed.

```sh
npm start
```

Open [http://localhost:4173](http://localhost:4173). Alternatively, run `python3 -m http.server 4173` from this directory.

Run the unit tests:

```sh
npm test
```

## What is included

- **Triage queue:** Search and filter simulated reports; sort by recommended priority.
- **Interactive map:** Select incidents on a schematic response-area map. Pins and routes are illustrative, not navigational.
- **Explainable score:** Every priority is accompanied by its contributing factors and an uncertainty label.
- **Messy report intake:** Add raw, free-text reports. A small, inspectable keyword-based parser suggests category, needs, and confidence; coordinators can edit and review the result.
- **Fairness safeguard:** Reports are not deprioritized for being sparse, old, or low confidence. “Limited signal” is shown as a reason to verify or proactively check an area, not as evidence that an area is safe.
- **Human-controlled recommendations:** Resource suggestions require an explicit coordinator confirmation before the incident is marked dispatched. Confirmation is a demo state change only; it does not contact responders.
- **Accessible controls:** Keyboard-operable buttons, visible focus styles, semantic landmarks, and reduced-motion support.

## Priority logic

The demo score is a deterministic **0–100 triage aid**, not a prediction of harm and not an automated decision:

| Signal | Maximum points |
| --- | ---: |
| Immediate life-safety cues (trapped, severe injury, people missing) | 35 |
| Urgent shelter, medical, or water needs | 20 |
| Estimated people affected | 20 |
| Time-sensitive conditions (rising water, nightfall, fire) | 15 |
| Independent corroboration | 10 |

Scores are capped at 100. Missing details do not subtract points. Confidence is displayed separately from priority and is based only on report detail and corroboration. A high-priority, low-confidence report stays visible and should prompt verification—not automatic dismissal. The rules live in `src/logic.js` so teams can inspect and test them.

## Project structure

```text
.
├── index.html                 # App shell and accessible dialog
├── src/
│   ├── data/incidents.js      # Clearly labeled simulated incident data
│   ├── logic.js               # Parsing, priority, confidence, and recommendations
│   ├── main.js                # UI rendering and coordinator interactions
│   └── styles.css             # Responsive visual system
├── tests/
│   └── logic.test.js          # Node built-in unit tests
├── package.json
└── README.md
```

## Production integration checklist

This prototype intentionally avoids collecting personal data or pretending to dispatch resources. Before operational use, connect an authorized report-ingestion service, verify locations with a geocoding provider, establish an audited role-based review and dispatch workflow, add resilient offline/synchronization behavior, validate triage rules with local responders and affected communities, and complete privacy, accessibility, security, and field testing. Keep people—not scores—in charge of consequential decisions.
