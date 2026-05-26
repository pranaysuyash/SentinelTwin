# Origin Context — Index

This folder contains the raw founding conversations and documents.
They are read-only history. Canonical decisions derived from them live in `Docs/architecture/` and `Docs/decisions/`.

---

## Files

| File | What it is | When to read it |
|---|---|---|
| `chatgpt_raw_conversations.md` | Full raw ChatGPT exploration sessions — multiple rounds, full text | Background context only. Don't re-derive decisions from here. |
| `SentinelTwin_Project_Brief.md` | The compiled project brief from the ChatGPT sessions | Good overview of V0.1 scope, demo scenes, acceptance criteria, data schemas, agent split |
| `chatgpt_exploration_summary.md` | Claude's synthesized summary of key signals from the ChatGPT sessions | Quick read for context without going through the full conversations |
| `project_brief_summary.md` | Short summary of the brief with V0.1 acceptance criteria | Quick reference |

---

## Important Note for Agents

The raw conversations contain early-stage thinking, some of which has been superseded by decisions in `Docs/decisions/DECISION_LOG.md`.

If there is a conflict between something in these raw files and something in `Docs/architecture/` or `Docs/decisions/`, the architecture docs and decision log win.

The raw files are preserved for:
- Background understanding of why certain directions were chosen
- Finding ideas that haven't been formally explored yet
- Context when Pranay references something from "the ChatGPT discussion"

| `claude_review_session_2026-05-26.md` | Novel simulation algorithms doc, camera studio gap analysis, Trellis.2/Pixal3D thread, build order and product framing discussions | Most recent session — read first |

---

Pranay is adding more context files from other chat sessions as they happen.
When new files are added here, update this index.
