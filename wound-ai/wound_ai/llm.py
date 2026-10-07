"""MedGemma helpers for the narrative summary (optional component).

MedGemma is distributed under the Health AI Developer Foundations terms: accept
them on its Hugging Face page, and note they require you to seek regulatory
authorisation where applicable before clinical use.
"""
from __future__ import annotations

import torch
from PIL import Image

from .report import SYSTEM_PROMPT, llm_user_prompt

DEFAULT_MODEL = "google/medgemma-1.5-4b-it"  # verify the exact id on huggingface.co/google before use


def compute_dtype() -> torch.dtype:
    # T4 and P100 (free Colab/Kaggle) have no bf16; Ampere+ (L4, A100) do.
    if torch.cuda.is_available() and torch.cuda.is_bf16_supported():
        return torch.bfloat16
    return torch.float16


def build_messages(image: Image.Image, findings: dict, report: str | None = None) -> list[dict]:
    msgs = [
        {"role": "system", "content": [{"type": "text", "text": SYSTEM_PROMPT}]},
        {"role": "user", "content": [{"type": "image", "image": image},
                                     {"type": "text", "text": llm_user_prompt(findings)}]},
    ]
    if report is not None:
        msgs.append({"role": "assistant", "content": [{"type": "text", "text": report}]})
    return msgs


def load(model_id: str = DEFAULT_MODEL, adapter: str | None = None, four_bit: bool = True):
    from transformers import AutoModelForImageTextToText, AutoProcessor, BitsAndBytesConfig

    kwargs = {"torch_dtype": compute_dtype(), "device_map": "auto"}
    if four_bit:
        kwargs["quantization_config"] = BitsAndBytesConfig(
            load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=compute_dtype())
    model = AutoModelForImageTextToText.from_pretrained(model_id, **kwargs)
    if adapter:
        from peft import PeftModel

        model = PeftModel.from_pretrained(model, adapter)
    processor = AutoProcessor.from_pretrained(model_id)
    model.eval()
    return model, processor


@torch.no_grad()
def generate_summary(model, processor, image: Image.Image, findings: dict, max_new_tokens: int = 220) -> str:
    inputs = processor.apply_chat_template(build_messages(image, findings), add_generation_prompt=True,
                                           tokenize=True, return_dict=True, return_tensors="pt").to(model.device)
    for k, v in inputs.items():  # pixel values must match the model dtype
        if torch.is_floating_point(v):
            inputs[k] = v.to(compute_dtype())
    n = inputs["input_ids"].shape[-1]
    out = model.generate(**inputs, max_new_tokens=max_new_tokens, do_sample=False)
    return processor.decode(out[0][n:], skip_special_tokens=True).strip()
