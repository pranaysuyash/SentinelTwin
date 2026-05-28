# Scene Understanding Bakeoff — Comparison Report
**Runs found:** 1
| Run ID | Candidate | Split | Images | ✅ Succeeded | ❌ Failed | Wall F1 | Door F1 | Window F1 | Obs F1 | CZ Recall | P50 Lat (ms) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| stack_b_gpt4o_de | stack_b_gpt4o | dev | 5 | 5 | 0 | 0.436 | 0.000 | 0.000 | 0.467 | 0.000 | 5686 |

### Key
- **Wall F1**: F1 score for wall segment detection (IoU-based matching)
- **Door/Window F1**: F1 for door/window detection (bounding box IoU ≥ 0.3)
- **Obs F1**: F1 for obstruction detection (shelves, racks, counters)
- **CZ Recall**: Critical zone detection rate
- **P50 Latency**: Median processing time per image
