import json
import os
import re
from datetime import datetime
from pathlib import Path

import gradio as gr

# For Railway, set DATA_DIR to a mounted Volume path, e.g. /data
DATA_DIR = Path(os.getenv("DATA_DIR", "data"))
IMAGES_DIR = DATA_DIR / "images"
META_FILE = DATA_DIR / "photos.json"
MAX_PHOTOS = 120

DATA_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)


def _load_meta():
    if not META_FILE.exists():
        return []
    try:
        return json.loads(META_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def _save_meta(items):
    META_FILE.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")


def _safe_text(text: str) -> str:
    if not text:
        return "cozy day"
    text = re.sub(r"\s+", " ", text.strip())
    return text[:60] if text else "cozy day"


def _build_gallery(items):
    gallery_items = []
    for item in items:
        image_path = DATA_DIR / item["path"]
        if image_path.exists():
            gallery_items.append((str(image_path), item["caption"]))
    return gallery_items


def refresh_wall():
    items = _load_meta()
    return _build_gallery(items)


def add_photos(files, caption):
    if not files:
        return refresh_wall(), "Please select image files first."

    caption = _safe_text(caption)
    items = _load_meta()

    for file in files:
        src_path = Path(file)
        if not src_path.exists():
            continue

        suffix = src_path.suffix.lower() if src_path.suffix else ".jpg"
        filename = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}{suffix}"
        dest = IMAGES_DIR / filename
        dest.write_bytes(src_path.read_bytes())

        items.insert(
            0,
            {
                "path": f"images/{filename}",
                "caption": caption,
                "uploaded_at_utc": datetime.utcnow().isoformat(timespec="seconds"),
            },
        )

    items = items[:MAX_PHOTOS]
    _save_meta(items)
    return _build_gallery(items), "Uploaded to shared wall."


def clear_wall():
    items = _load_meta()
    for item in items:
        image_path = DATA_DIR / item.get("path", "")
        if image_path.exists():
            image_path.unlink()
    _save_meta([])
    return [], "Wall cleared."


css = """
:root {
  --bg1: #fef6eb;
  --bg2: #f3eadf;
  --ink: #5a4639;
  --paper: #fffaf4;
  --accent: #d38f75;
}

.gradio-container {
  background: radial-gradient(circle at top right, #fff7df 5%, transparent 50%),
              radial-gradient(circle at bottom left, #f8decf 8%, transparent 40%),
              linear-gradient(140deg, var(--bg1), var(--bg2));
  font-family: "Prompt", sans-serif;
}

#main-card {
  border: 1px solid rgba(198, 161, 137, 0.33);
  border-radius: 20px;
  background: rgba(255, 250, 244, 0.86);
  box-shadow: 0 12px 28px rgba(95, 66, 55, 0.12);
}

h1, h2, h3, p, label, span {
  color: var(--ink) !important;
}

button.primary {
  background: linear-gradient(120deg, var(--accent), #e2a88e) !important;
  color: #fff9f5 !important;
  border: none !important;
}
"""

with gr.Blocks(css=css, theme=gr.themes.Soft()) as demo:
    gr.Markdown("""
# Cozy Polaroid Wall
Shared wall: everyone who opens this app sees the same photos.
""")

    with gr.Column(elem_id="main-card"):
        files = gr.Files(label="Upload your photos", file_types=["image"], type="filepath")
        caption = gr.Textbox(label="Caption", placeholder="Write a short cozy caption", max_lines=1)

        with gr.Row():
            upload_btn = gr.Button("Add to shared wall", variant="primary")
            refresh_btn = gr.Button("Refresh")
            clear_btn = gr.Button("Clear all")

        status = gr.Markdown("")

    gallery = gr.Gallery(
        label="Polaroid Wall",
        value=refresh_wall,
        columns=[2, 3, 4, 5],
        object_fit="cover",
        height="auto",
        allow_preview=True,
    )

    upload_btn.click(add_photos, inputs=[files, caption], outputs=[gallery, status])
    refresh_btn.click(fn=refresh_wall, outputs=gallery)
    clear_btn.click(fn=clear_wall, outputs=[gallery, status])

if __name__ == "__main__":
    port = int(os.getenv("PORT", "7860"))
    demo.launch(server_name="0.0.0.0", server_port=port)
