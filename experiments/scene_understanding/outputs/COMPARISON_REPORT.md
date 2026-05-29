# Scene Understanding Bakeoff — Comparison Report
**Runs found:** 12
| Run ID | Candidate | Split | Images | ✅ Succeeded | ❌ Failed | Wall F1 | Door F1 | Window F1 | Obs F1 | CZ Recall | P50 Lat (ms) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| stack_a_qwen_ocr | stack_a_qwen_ocr | dev | 5 | 5 | 0 | 0.661 | 0.000 | 0.000 | 0.100 | 0.000 | 85912 |
| stack_b_florence | stack_b_florence_gotocr | dev | 5 | 5 | 0 | 0.912 | 0.200 | 0.300 | 0.536 | 0.600 | 6822 |
| stack_b_gpt4o_de | stack_b_gpt4o | dev | 5 | 5 | 0 | 0.964 | 0.400 | 0.700 | 0.417 | 0.200 | 5058 |
| stack_c_florence | stack_c_florence | dev | 5 | 5 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 4598 |
| stack_d_gpt54_na | stack_d_gpt54_nano | dev | 5 | 5 | 0 | 0.931 | 0.400 | 0.100 | 0.178 | 0.200 | 4853 |
| stack_e_gpt41_st | stack_e_gpt41_structured | dev | 5 | 5 | 0 | 0.948 | 0.200 | 0.400 | 0.687 | 0.600 | 4640 |
| stack_f_gemini25 | stack_f_gemini25_flash | dev | 5 | 5 | 0 | 0.948 | 0.200 | 0.400 | 0.643 | 0.600 | 4309 |
| stack_g_gemini25 | stack_g_gemini25_pro | dev | 5 | 5 | 0 | 0.933 | 0.400 | 0.500 | 0.680 | 0.000 | 5874 |
| stack_h_minicpm_ | stack_h_minicpm_ocr | dev | 5 | 0 | 5 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0 |
| stack_h_minicpmv | stack_h_minicpmv46 | dev | 5 | 4 | 1 | 0.094 | 0.000 | 0.000 | 0.147 | 0.000 | 95999 |

### Key
- **Wall F1**: F1 score for wall segment detection (IoU-based matching)
- **Door/Window F1**: F1 for door/window detection (bounding box IoU ≥ 0.3)
- **Obs F1**: F1 for obstruction detection (shelves, racks, counters)
- **CZ Recall**: Critical zone detection rate
- **P50 Latency**: Median processing time per image
