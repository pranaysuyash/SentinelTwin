import os
from .schema import CandidateConfig

CANDIDATE_REGISTRY: dict[str, CandidateConfig] = {
    "stack_a_qwen_ocr": CandidateConfig(
        id="stack_a_qwen_ocr",
        description="Qwen VL parser with OCR assist",
        pipeline_kind="hybrid",
        provider="local",
        components={
            "vlm": {"model_id": "Qwen/Qwen2.5-VL-7B-Instruct", "role": "primary_layout_parser"},
            "ocr": {"model_id": "stepfun-ai/GOT-OCR2_0", "role": "symbol_and_label_extraction"},
        },
        expected_strengths=["strong multimodal reasoning", "robust fallback when legend sparse"],
        known_risks=["may infer over-confident geometry", "requires schema-constrained prompting"],
        stage_roles={"ocr": "stepfun-ai/GOT-OCR2_0", "layout": "Qwen/Qwen2.5-VL-7B-Instruct"},
    ),
    "stack_b_gpt4o": CandidateConfig(
        id="stack_b_gpt4o",
        description="GPT-4o direct floorplan parser",
        pipeline_kind="cloud",
        provider="openai",
        components={
            "vlm": {"model_id": "gpt-4o", "role": "primary_layout_parser"},
        },
        expected_strengths=["excellent structured output", "strong spatial reasoning"],
        known_risks=["cost per image", "latency on large images"],
        cloud_fallbacks=["gpt-4.1", "gemini-2.5-flash"],
    ),
    "stack_b_florence_gotocr": CandidateConfig(
        id="stack_b_florence_gotocr",
        description="Florence-2 prompt-task parser with OCR assist",
        pipeline_kind="hybrid",
        provider="local",
        components={
            "ocr": {"model_id": "stepfun-ai/GOT-OCR2_0", "role": "text_and_symbol_reading"},
            "vlm": {"model_id": "microsoft/Florence-2-base", "role": "task_prompted_detection_and_region_parsing"},
        },
        expected_strengths=["explicit task control", "small model, fast inference"],
        known_risks=["weaker spatial consistency without tuned prompting"],
        stage_roles={"ocr": "stepfun-ai/GOT-OCR2_0", "layout": "microsoft/Florence-2-base"},
    ),
    "stack_c_raster2seq_plus_qwen_repair": CandidateConfig(
        id="stack_c_raster2seq_plus_qwen_repair",
        description="Raster2Seq polygon reconstruction with Qwen semantic repair",
        pipeline_kind="hybrid",
        provider="local",
        components={
            "vectorizer": {"model_id": "haopt/Raster2Seq", "role": "polygon_sequence_reconstruction"},
            "semantic_repair": {"model_id": "Qwen/Qwen2.5-VL-7B-Instruct", "role": "class_label_cleanup_and_security_mapping"},
        },
        expected_strengths=["strong wall/room geometry on clean plans", "aligned with downstream vector mapping"],
        known_risks=["can degrade on low-quality scans or non-standard notation"],
        stage_roles={"layout": "haopt/Raster2Seq", "repair": "Qwen/Qwen2.5-VL-7B-Instruct"},
    ),
    "stack_c_florence": CandidateConfig(
        id="stack_c_florence",
        description="Florence-2 prompt-task parser",
        pipeline_kind="hybrid",
        provider="local",
        components={
            "vlm": {"model_id": "microsoft/Florence-2-base", "role": "task_prompted_detection"},
        },
        expected_strengths=["explicit task control", "small model, fast inference"],
        known_risks=["weaker spatial consistency without tuning"],
        stage_roles={"layout": "microsoft/Florence-2-base"},
    ),
    "stack_d_gpt54_nano": CandidateConfig(
        id="stack_d_gpt54_nano",
        description="GPT-5.4 Nano floorplan parser",
        pipeline_kind="cloud",
        provider="openai",
        components={
            "vlm": {"model_id": "gpt-5.4-nano", "role": "primary_layout_parser"},
        },
        expected_strengths=["latest-gen spatial reasoning", "lower latency than GPT-4o", "improved structural element extraction"],
        known_risks=["newer model may have different coordinate conventions", "parameter count may limit complex scene parsing"],
        cloud_fallbacks=["gpt-4o", "gpt-4.1"],
    ),
    "stack_e_gpt41_structured": CandidateConfig(
        id="stack_e_gpt41_structured",
        description="GPT-4.1 structured-output fallback for hard or ambiguous scans",
        pipeline_kind="cloud",
        provider="openai",
        components={
            "vlm": {"model_id": "gpt-4.1", "role": "structured_layout_and_repair"},
        },
        expected_strengths=["strong instruction following", "good schema obedience"],
        known_risks=["still needs prompt discipline for line geometry"],
        cloud_fallbacks=["gpt-4o", "gemini-2.5-pro"],
    ),
    "stack_f_gemini25_flash": CandidateConfig(
        id="stack_f_gemini25_flash",
        description="Gemini 2.5 Flash fast cloud fallback",
        pipeline_kind="cloud",
        provider="gemini",
        components={
            "vlm": {"model_id": "gemini-2.5-flash", "role": "fast_multimodal_fallback"},
        },
        expected_strengths=["fast multimodal pass", "cheap ambiguity triage"],
        known_risks=["may prefer summary over precise geometry unless prompted tightly"],
        cloud_fallbacks=["gemini-2.5-pro", "gpt-4.1"],
    ),
    "stack_g_gemini25_pro": CandidateConfig(
        id="stack_g_gemini25_pro",
        description="Gemini 2.5 Pro high-ceiling cloud fallback",
        pipeline_kind="cloud",
        provider="gemini",
        components={
            "vlm": {"model_id": "gemini-2.5-pro", "role": "high_accuracy_multimodal_fallback"},
        },
        expected_strengths=["strongest cloud ceiling for hard scans", "good multimodal reasoning"],
        known_risks=["higher cost than Flash", "still requires strict extraction prompt"],
        cloud_fallbacks=["gemini-2.5-flash", "gpt-4o"],
    ),
    "stack_h_minicpm_ocr": CandidateConfig(
        id="stack_h_minicpm_ocr",
        description="MiniCPM-V 4.6 floorplan parser with OCR assist",
        pipeline_kind="hybrid",
        provider="local",
        components={
            "ocr": {"model_id": "stepfun-ai/GOT-OCR2_0", "role": "symbol_and_label_extraction"},
            "vlm": {"model_id": "openbmb/MiniCPM-V-4_6", "role": "primary_layout_parser"},
        },
        expected_strengths=["compact local multimodal baseline", "fast iteration on smaller hardware"],
        known_risks=["may need tighter prompting for exact geometry", "processor quirks can affect output formatting"],
        stage_roles={"ocr": "stepfun-ai/GOT-OCR2_0", "layout": "openbmb/MiniCPM-V-4_6"},
    ),
    "stack_h_minicpmv46": CandidateConfig(
        id="stack_h_minicpmv46",
        description="MiniCPM-V 4.6 edge VLM (1.3B, Apache 2.0)",
        pipeline_kind="end_to_end",
        provider="local",
        components={
            "vlm": {"model_id": "openbmb/MiniCPM-V-4.6", "role": "primary_layout_parser"},
        },
        expected_strengths=["ultra-efficient (1.3B params)", "phone-deployable", "strong for its size on OCR/refCOCO"],
        known_risks=["small param count may miss fine details on dense floor plans", "requires transformers>=5.7.0"],
    ),
    "stack_i_qwen35_4b": CandidateConfig(
        id="stack_i_qwen35_4b",
        description="Qwen3.5-4B natively multimodal (4B, Apache 2.0)",
        pipeline_kind="end_to_end",
        provider="local",
        components={
            "vlm": {"model_id": "Qwen/Qwen3.5-4B", "role": "primary_layout_parser"},
        },
        expected_strengths=["natively multimodal (no separate VL variant needed)", "strong benchmark scores for 4B class", "Apache 2.0"],
        known_risks=["larger than MiniCPM-V 4.6, slower inference", "untested on floor plan extraction"],
    ),
    "stack_j_minicpmo45": CandidateConfig(
        id="stack_j_minicpmo45",
        description="MiniCPM-o 4.5 omnimodal VLM (9B, Apache 2.0)",
        pipeline_kind="end_to_end",
        provider="local",
        components={
            "vlm": {"model_id": "openbmb/MiniCPM-o-4.5", "role": "primary_layout_parser"},
        },
        expected_strengths=["strongest open-source VLM near 9B", "approaches Gemini 2.5 Flash quality", "Apache 2.0"],
        known_risks=["9B params may require GPU with >=8GB VRAM", "slower inference on MPS"],
    ),
    "stack_k_gemma4_e4b": CandidateConfig(
        id="stack_k_gemma4_e4b",
        description="Gemma 4 E4B MoE VLM (4B active / ~30B total)",
        pipeline_kind="end_to_end",
        provider="local",
        components={
            "vlm": {"model_id": "google/gemma-4-e4b-it", "role": "primary_layout_parser"},
        },
        expected_strengths=["MoE efficiency (4B active params)", "natively multimodal (SigLIP2)", "128K context"],
        known_risks=["~30B total params needs quantization for consumer GPUs", "Gemma license (ok for Apache 2.0 project)"],
    ),
}


def load_candidate_configs(config_path: str | None = None) -> dict[str, CandidateConfig]:
    if config_path and os.path.exists(config_path):
        import yaml
        with open(config_path) as f:
            data = yaml.safe_load(f)
        for c in data.get("candidates", []):
            CANDIDATE_REGISTRY[c["id"]] = CandidateConfig(
                id=c["id"],
                description=c.get("description", ""),
                components=c.get("components", {}),
                expected_strengths=c.get("expected_strengths", []),
                known_risks=c.get("known_risks", []),
                pipeline_kind=c.get("pipeline_kind", "end_to_end"),
                provider=c.get("provider", "local"),
                stage_roles=c.get("stage_roles", {}),
                cloud_fallbacks=c.get("cloud_fallbacks", []),
            )
    return CANDIDATE_REGISTRY


def get_candidate_config(candidate_id: str) -> CandidateConfig:
    if candidate_id not in CANDIDATE_REGISTRY:
        raise ValueError(f"Unknown candidate '{candidate_id}'. Available: {list(CANDIDATE_REGISTRY.keys())}")
    return CANDIDATE_REGISTRY[candidate_id]
