"""Download trained checkpoints (*.pt) at container start, so model weights stay out of git and the image.

    HF_MODEL_REPO=you/wound-models HF_TOKEN=hf_... python -m api.fetch_checkpoints

Without HF_MODEL_REPO it does nothing and the API starts with whatever is in CKPT_DIR (possibly none).
If the repo is set but can't be downloaded, it fails, so a bad token is noticed instead of silently
serving no model.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def main() -> int:
    repo = os.environ.get("HF_MODEL_REPO")
    dest = Path(os.environ.get("CKPT_DIR", "checkpoints"))
    dest.mkdir(parents=True, exist_ok=True)
    if not repo:
        print("HF_MODEL_REPO not set: starting with the checkpoints already in", dest)
        return 0
    from huggingface_hub import snapshot_download

    try:
        snapshot_download(repo_id=repo, repo_type="model", token=os.environ.get("HF_TOKEN"), local_dir=dest,
                          allow_patterns=["*.pt"])
    except Exception as error:  # noqa: BLE001 - report any download failure and stop the container
        print(f"could not download checkpoints from {repo}: {error}", file=sys.stderr)
        return 1
    print("checkpoints:", sorted(p.name for p in dest.glob("*.pt")) or "none in the repo")
    return 0


if __name__ == "__main__":
    sys.exit(main())
