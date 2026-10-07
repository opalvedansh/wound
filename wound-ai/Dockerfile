# The wound model API (api/server.py) for Hugging Face Spaces (Docker SDK) or any container host. CPU only.
#
#   docker build -t wound-ai . && docker run -p 7860:7860 -e WOUND_API_KEY=... wound-ai
#
# Trained weights are not baked in: set HF_MODEL_REPO (+ HF_TOKEN for a private repo) and they are downloaded
# at startup. Without them the API still runs the quality gate, sticker check and rules.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

# The CPU build of PyTorch is a fraction of the size of the default CUDA one.
RUN pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install -r requirements.txt huggingface_hub

COPY wound_ai wound_ai
COPY api api

# Hugging Face Spaces run the container as user 1000.
RUN useradd -m -u 1000 app && mkdir -p checkpoints && chown -R app /app
USER app

ENV CKPT_DIR=/app/checkpoints PORT=7860
EXPOSE 7860
CMD python -m api.fetch_checkpoints && exec uvicorn api.server:app --host 0.0.0.0 --port ${PORT}
