import os
from .schema import CandidateConfig

CANDIDATE_REGISTRY: dict[str, CandidateConfig] = {
    "stack_a_qwen_ocr": CandidateConfig(
        id="stack_a_qwen_ocr",
        description="Qwen VL parser with OCR assist",
        components={
            "vlm": {"model_id": "Qwen/Qwen2.5-VL-7B-Instruct", "role": "primary_layout_parser"},
            "ocr": {"model_id": "stepfun-ai/GOT-OCR2_0", "role": "symbol_and_label_extraction"},
        },
        expected_strengths=["strong multimodal reasoning", "robust fallback when legend sparse"],
        known_risks=["may infer over-confident geometry", "requires schema-constrained prompting"],
    ),
    "stack_b_gpt4o": CandidateConfig(
        id="stack_b_gpt4o",
        description="GPT-4o direct floorplan parser",
        components={
            "vlm": {"model_id": "gpt-4o", "role": "primary_layout_parser"},
        },
        expected_strengths=["excellent structured output", "strong spatial reasoning"],
        known_risks=["cost per image", "latency on large images"],
    ),
    "stack_c_florence": CandidateConfig(
        id="stack_c_florence",
        description="Florence-2 prompt-task parser",
        components={
            "vlm": {"model_id": "microsoft/Florence-2-base", "role": "task_prompted_detection"},
        },
        expected_strengths=["explicit task control", "small model, fast inference"],
        known_risks=["weaker spatial consistency without tuning"],
    ),
    "stack_d_gpt54_nano": CandidateConfig(
        id="stack_d_gpt54_nano",
        description="GPT-5.4 Nano floorplan parser",
        components={
            "vlm": {"model_id": "gpt-5.4-nano", "role": "primary_layout_parser"},
        },
        expected_strengths=["latest-gen spatial reasoning", "lower latency than GPT-4o", "improved structural element extraction"],
        known_risks=["newer model may have different coordinate conventions", "parameter count may limit complex scene parsing"],
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
            )
    return CANDIDATE_REGISTRY


def get_candidate_config(candidate_id: str) -> CandidateConfig:
    if candidate_id not in CANDIDATE_REGISTRY:
        raise ValueError(f"Unknown candidate '{candidate_id}'. Available: {list(CANDIDATE_REGISTRY.keys())}")
    return CANDIDATE_REGISTRY[candidate_id]
