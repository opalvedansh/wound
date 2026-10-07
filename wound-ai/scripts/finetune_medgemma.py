"""QLoRA fine-tune of MedGemma to write the summary paragraph in your clinicians' style.

Do this AFTER you have a few hundred clinician-approved summaries (the review
screen in the app produces them). Until then, use the template narrative.

Data: JSONL, one case per line:
  {"image": "path/to/wound_crop.jpg", "findings": {...pipeline findings...},
   "report": "clinician-approved summary text", "split": "train"|"val"}

    python scripts/finetune_medgemma.py --data data/summaries.jsonl --out runs/medgemma_lora

Hardware: 4-bit base + LoRA fits a 16 GB T4/P100 at batch size 1 with gradient
checkpointing. T4/P100 have no bf16, so fp16 is used; if the loss turns NaN,
lower --lr, or rent a few hours on an L4/A100 (bf16) for this one step.

Not executed in the starter-kit smoke test (needs a GPU and the gated model):
run it first with --max-steps 5 to confirm it works on your setup.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import torch
from PIL import Image

from wound_ai.llm import DEFAULT_MODEL, build_messages, compute_dtype
from wound_ai.report import check_narrative


def parse():
    p = argparse.ArgumentParser()
    p.add_argument("--data", required=True)
    p.add_argument("--model-id", default=DEFAULT_MODEL)
    p.add_argument("--out", default="runs/medgemma_lora")
    p.add_argument("--epochs", type=int, default=2)
    p.add_argument("--lr", type=float, default=1e-4)
    p.add_argument("--grad-accum", type=int, default=8)
    p.add_argument("--lora-r", type=int, default=16)
    p.add_argument("--max-steps", type=int, default=0, help="debug: stop after N optimizer steps")
    p.add_argument("--eval-generate", type=int, default=20, help="val cases to generate + safety-check at the end")
    return p.parse_args()


def load_cases(path: str):
    rows = [json.loads(l) for l in Path(path).read_text().splitlines() if l.strip()]
    return [r for r in rows if r.get("split", "train") == "train"], [r for r in rows if r.get("split") == "val"]


def main():
    a = parse()
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from transformers import AutoModelForImageTextToText, AutoProcessor, BitsAndBytesConfig

    dtype = compute_dtype()
    processor = AutoProcessor.from_pretrained(a.model_id)
    processor.tokenizer.padding_side = "right"
    model = AutoModelForImageTextToText.from_pretrained(
        a.model_id, torch_dtype=dtype, device_map="auto",
        quantization_config=BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                                               bnb_4bit_use_double_quant=True, bnb_4bit_compute_dtype=dtype))
    model.config.use_cache = False  # required with gradient checkpointing
    model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=True)
    # LoRA on the language model only; the image encoder stays frozen.
    lora = LoraConfig(r=a.lora_r, lora_alpha=2 * a.lora_r, lora_dropout=0.05, task_type="CAUSAL_LM",
                      target_modules=r".*language_model.*\.(q_proj|k_proj|v_proj|o_proj|gate_proj|up_proj|down_proj)")
    model = get_peft_model(model, lora)
    model.print_trainable_parameters()

    train, val = load_cases(a.data)
    print(f"train {len(train)} | val {len(val)}")

    def encode(case: dict) -> dict:
        img = Image.open(case["image"]).convert("RGB")
        full = processor.apply_chat_template(build_messages(img, case["findings"], case["report"]), tokenize=False)
        prompt = processor.apply_chat_template(build_messages(img, case["findings"]), tokenize=False,
                                               add_generation_prompt=True)
        enc = processor(text=[full], images=[[img]], return_tensors="pt")
        n_prompt = processor(text=[prompt], images=[[img]], return_tensors="pt")["input_ids"].shape[1]
        labels = enc["input_ids"].clone()
        labels[:, :n_prompt] = -100  # learn only the clinician's text, not the prompt or image tokens
        enc["labels"] = labels
        return enc

    def to_device(enc: dict) -> dict:
        out = {}
        for k, v in enc.items():
            v = v.to(model.device)
            out[k] = v.to(dtype) if torch.is_floating_point(v) else v
        return out

    params = [p for p in model.parameters() if p.requires_grad]
    opt = torch.optim.AdamW(params, lr=a.lr, weight_decay=0.0)
    total = max(1, a.epochs * math.ceil(len(train) / a.grad_accum))
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1.0, (s + 1) / 10) * max(0.0, 1 - s / total))
    scaler = torch.amp.GradScaler("cuda", enabled=dtype == torch.float16)

    step = 0
    model.train()
    for ep in range(a.epochs):
        order = torch.randperm(len(train)).tolist()
        running = 0.0
        for i, idx in enumerate(order):
            with torch.autocast("cuda", dtype=dtype):
                loss = model(**to_device(encode(train[idx]))).loss / a.grad_accum
            scaler.scale(loss).backward()
            running += loss.item()
            if (i + 1) % a.grad_accum == 0 or i == len(order) - 1:
                scaler.unscale_(opt)
                torch.nn.utils.clip_grad_norm_(params, 1.0)
                scaler.step(opt); scaler.update(); opt.zero_grad(set_to_none=True); sched.step()
                step += 1
                if step % 10 == 0:
                    print(f"epoch {ep} step {step}/{total} loss {running:.4f}")
                running = 0.0
                if a.max_steps and step >= a.max_steps:
                    break
        if a.max_steps and step >= a.max_steps:
            break

        if val:
            model.eval()
            with torch.no_grad():
                vl = [model(**to_device(encode(c))).loss.item() for c in val[:200]]
            print(f"epoch {ep} val_loss {sum(vl) / len(vl):.4f}")
            model.train()

    Path(a.out).mkdir(parents=True, exist_ok=True)
    model.save_pretrained(a.out)
    processor.save_pretrained(a.out)
    print(f"saved LoRA adapter to {a.out}")

    # Safety check on held-out cases: how often does the output pass the report guard?
    if val and a.eval_generate:
        from wound_ai.llm import generate_summary

        model.eval()
        processor.tokenizer.padding_side = "left"
        passed, samples = 0, []
        for c in val[: a.eval_generate]:
            text = generate_summary(model, processor, Image.open(c["image"]).convert("RGB"), c["findings"])
            problems = check_narrative(text, c["findings"])
            passed += not problems
            samples.append({"generated": text, "reference": c["report"], "problems": problems})
        print(f"guard pass rate: {passed}/{len(samples)}")
        (Path(a.out) / "val_samples.json").write_text(json.dumps(samples, indent=1))


if __name__ == "__main__":
    main()
