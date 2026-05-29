"""
Evaluate small VLMs on non-geometry floor plan tasks:
  a) Scene classification — retail vs warehouse vs corridor vs office
  b) Room detection — list all rooms/spaces and their types
  c) OCR / label reading — extract all text, room names, dimensions, symbols
  d) Connectivity — adjacency graph of rooms
  e) Coarse layout — high-level description

Runs MiniCPM-V 4.6 (local) and GPT-4o (cloud, if key available) for comparison.
Outputs per-task, per-image results as markdown.
"""
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from bakeoff_harness.runner import BASE_DIR, IMAGES_DIR, _load_image, _clear_torch_cache

OUTPUT_DIR = BASE_DIR / "outputs" / "semantic_tasks"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

IMAGES = sorted((IMAGES_DIR / "dev").glob("*.png"))
GROUND_TRUTH_SCENE = {
    "retail_01_small_shop": "retail_small_shop",
    "retail_02_grocery": "retail_grocery",
    "retail_03_pharmacy": "retail_pharmacy",
    "warehouse_01_racking": "warehouse",
    "corridor_01_lobby": "corridor_lobby",
}

TASKS = {
    "classification": {
        "prompt": "What type of commercial space is this floor plan? Return a single category: retail_small_shop, retail_grocery, retail_pharmacy, warehouse, corridor_lobby, or other. Return ONLY the category name, no explanation.",
        "eval": "exact_match",
    },
    "rooms": {
        "prompt": "List every distinct room or functional zone visible in this floor plan. For each, give the room name/type and approximate location (e.g. 'top-left', 'center'). Return as a JSON array: [{\"name\": \"...\", \"type\": \"...\", \"location\": \"...\"}]. Return ONLY the JSON array.",
        "eval": "qualitative",
    },
    "ocr": {
        "prompt": "Transcribe ALL visible text in this floor plan image exactly as written. Include room names, labels, dimensions, symbols, numbers, signs. Return each piece of text on a separate line. Be exhaustive.",
        "eval": "qualitative",
    },
    "adjacency": {
        "prompt": "Analyze which rooms or zones are directly adjacent or connected (share a wall/door/open passage) in this floor plan. Return as a JSON adjacency list: {\"adjacencies\": [{\"from\": \"...\", \"to\": \"...\", \"via\": \"door|opening|shared_wall\"}]}. Return ONLY the JSON.",
        "eval": "qualitative",
    },
    "description": {
        "prompt": "Describe this floor plan in 2-3 sentences: what type of space, the approximate layout/geometry, and any notable features like entrances, special zones, or obstructions.",
        "eval": "qualitative",
    },
}


def run_minicpm_task(image_path: str, prompt: str) -> tuple[str, float]:
    from transformers import AutoProcessor, AutoModelForImageTextToText
    import torch

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    dtype = torch.bfloat16 if device == "mps" else torch.float32
    _clear_torch_cache()

    cache = run_minicpm_task.__dict__.get("model_data")
    if cache is None:
        model_id = "openbmb/MiniCPM-V-4.6"
        processor = AutoProcessor.from_pretrained(model_id, trust_remote_code=True)
        model = AutoModelForImageTextToText.from_pretrained(model_id, trust_remote_code=True, torch_dtype=dtype).to(device)
        model.eval()
        run_minicpm_task.model_data = {"processor": processor, "model": model}
        cache = run_minicpm_task.model_data

    processor, model = cache["processor"], cache["model"]

    messages = [
        {"role": "user", "content": [
            {"type": "image", "url": str(image_path)},
            {"type": "text", "text": prompt},
        ]},
    ]
    inputs = processor.apply_chat_template(
        messages, tokenize=True, add_generation_prompt=True,
        return_dict=True, return_tensors="pt",
        processor_kwargs=dict(downsample_mode="16x", max_slice_nums=1),
    )
    inputs = {k: v.to(model.device) if hasattr(v, "to") else v for k, v in inputs.items()}

    start = time.time()
    with torch.no_grad():
        generated_ids = model.generate(**inputs, downsample_mode="16x", max_new_tokens=512, do_sample=False)
    elapsed = (time.time() - start) * 1000

    input_len = inputs["input_ids"].shape[1]
    decoded = processor.batch_decode(generated_ids[:, input_len:], skip_special_tokens=True, clean_up_tokenization_spaces=False)[0]
    return decoded.strip(), elapsed


def run_gpt4o_task(image_path: str, prompt: str) -> tuple[str, float]:
    from openai import OpenAI
    import base64

    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
    if not client.api_key:
        return "(no API key)", 0.0

    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

    start = time.time()
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are a floor plan analyst."},
            {"role": "user", "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}", "detail": "high"}},
            ]},
        ],
        temperature=0.0,
        max_tokens=2048,
    )
    elapsed = (time.time() - start) * 1000
    return (response.choices[0].message.content or "").strip(), elapsed


def run_gemini_task(image_path: str, prompt: str) -> tuple[str, float]:
    from google import genai

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY", "")
    if not api_key:
        return "(no API key)", 0.0

    client = genai.Client(api_key=api_key)
    image = _load_image(str(image_path))

    start = time.time()
    response = client.models.generate_content(model="gemini-2.5-flash", contents=[prompt, image])
    elapsed = (time.time() - start) * 1000
    raw = getattr(response, "text", "") or ""
    if not raw and getattr(response, "candidates", None):
        try:
            raw = response.candidates[0].content.parts[0].text or ""
        except Exception:
            raw = ""
    return raw.strip(), elapsed


def main():
    results = {task: {} for task in TASKS}
    timings = {}  # {(img_id, model_key, task_name): ms}

    for img_path in IMAGES:
        img_id = img_path.stem
        print(f"\n{'='*60}")
        print(f"Image: {img_id}")
        print(f"{'='*60}")

        for task_name, task_info in TASKS.items():
            print(f"\n  --- {task_name} ---")

            # MiniCPM
            print(f"  MiniCPM-V 4.6...", end=" ", flush=True)
            try:
                text, ms = run_minicpm_task(img_path, task_info["prompt"])
                print(f"{ms:.0f}ms")
                results[task_name][f"{img_id}_minicpm_{task_name}"] = text
                timings[(img_id, "minicpm", task_name)] = ms
            except Exception as e:
                print(f"ERROR: {e}")
                results[task_name][f"{img_id}_minicpm_{task_name}"] = f"[ERROR: {e}]"

            # GPT-4o
            print(f"  GPT-4o...", end=" ", flush=True)
            try:
                text, ms = run_gpt4o_task(img_path, task_info["prompt"])
                print(f"{ms:.0f}ms")
                results[task_name][f"{img_id}_gpt4o_{task_name}"] = text
                timings[(img_id, "gpt4o", task_name)] = ms
            except Exception as e:
                print(f"ERROR: {e}")
                results[task_name][f"{img_id}_gpt4o_{task_name}"] = f"[ERROR: {e}]"
            
            # Gemini Flash
            print(f"  Gemini 2.5 Flash...", end=" ", flush=True)
            try:
                text, ms = run_gemini_task(img_path, task_info["prompt"])
                print(f"{ms:.0f}ms")
                results[task_name][f"{img_id}_gemini_{task_name}"] = text
                timings[(img_id, "gemini", task_name)] = ms
            except Exception as e:
                print(f"ERROR: {e}")
                results[task_name][f"{img_id}_gemini_{task_name}"] = f"[ERROR: {e}]"

    # Generate report
    report_path = OUTPUT_DIR / "SEMANTIC_TASKS_REPORT.md"

    with open(report_path, "w") as f:
        f.write("# Semantic Floor Plan Tasks — Bakeoff\n\n")
        f.write(f"Evaluated {len(IMAGES)} images across {len(TASKS)} task types.\n")
        f.write(f"- **MiniCPM-V 4.6** (1.3B, local, MPS)\n")
        f.write(f"- **GPT-4o** (cloud)\n")
        f.write(f"- **Gemini 2.5 Flash** (cloud)\n\n")
        f.write("---\n\n")

        for task_name in TASKS:
            f.write(f"## Task: {task_name}\n\n")
            task_latencies = {m: [] for m in ["minicpm", "gpt4o", "gemini"]}

            for img_path in IMAGES:
                img_id = img_path.stem
                scene_gt = GROUND_TRUTH_SCENE.get(img_id, "?")
                f.write(f"### {img_id} (scene: {scene_gt})\n\n")

                for model_key in ["minicpm", "gpt4o", "gemini"]:
                    key = f"{img_id}_{model_key}_{task_name}"
                    text = results[task_name].get(key, "(empty)")
                    ms = timings.get((img_id, model_key, task_name), 0)
                    if ms:
                        task_latencies[model_key].append(ms)
                    f.write(f"**{model_key}** ({ms:.0f}ms):\n\n")
                    f.write(f"```\n{text[:1500]}\n```\n\n")

                if task_name == "classification":
                    gt = GROUND_TRUTH_SCENE.get(img_id, "?")
                    for model_key in ["minicpm", "gpt4o", "gemini"]:
                        key = f"{img_id}_{model_key}_{task_name}"
                        pred = results[task_name].get(key, "").strip().lower()
                        correct = "✓" if gt in pred or pred in gt else "✗"
                        f.write(f"- **{model_key}** vs GT ({gt}): {correct}\n")
                    f.write("\n")

            # Latency for this task
            f.write("**Latency (avg):** ")
            for mk in ["minicpm", "gpt4o", "gemini"]:
                vals = task_latencies[mk]
                if vals:
                    f.write(f"{mk}={sum(vals)/len(vals):.0f}ms ")
            f.write("\n\n---\n\n")

        # Classification summary
        f.write("## Classification Accuracy\n\n")
        if results["classification"]:
            for model_key in ["minicpm", "gpt4o", "gemini"]:
                correct = 0
                for img_path in IMAGES:
                    img_id = img_path.stem
                    gt = GROUND_TRUTH_SCENE.get(img_id, "")
                    pred = results["classification"].get(f"{img_id}_{model_key}_classification", "").strip().lower()
                    if gt and (gt in pred or pred in gt):
                        correct += 1
                total = len(list(IMAGES))
                f.write(f"- **{model_key}:** {correct}/{total}\n")

        # Overall latency summary
        f.write("\n## Overall Latency\n\n")
        f.write("| Task | MiniCPM-V 4.6 | GPT-4o | Gemini 2.5 Flash |\n|---|---|---|---|\n")
        for task_name in TASKS:
            line = [task_name]
            for mk in ["minicpm", "gpt4o", "gemini"]:
                vals = [timings[(i.stem, mk, task_name)] for i in IMAGES if (i.stem, mk, task_name) in timings]
                if vals:
                    line.append(f"{sum(vals)/len(vals):.0f}ms")
                else:
                    line.append("-")
            f.write("| " + " | ".join(line) + " |\n")

    print(f"\n\nReport saved to {report_path}")

    print(f"\n\nReport saved to {report_path}")


if __name__ == "__main__":
    main()
