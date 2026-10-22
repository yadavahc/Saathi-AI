"""Snap & Act endpoints."""
from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile

from backend.agents import snap
from backend.tools.vision import SAMPLES

router = APIRouter(prefix="/api/snap")
SAMPLE_FILES = {"khata": "khata.png", "bill": "bill.png", "shelf": "shelf.png"}
MAX_BYTES = 8 * 1024 * 1024


def _public(doc: dict) -> dict:
    return {**doc, "image_url": f"/api/snap/image/{doc['doc_id']}"}


@router.post("")
async def upload(image: UploadFile = File(...), user_id: str = Form("M001"), source: str = Form("app")) -> dict:
    data = await image.read()
    if not data:
        raise HTTPException(400, "empty image")
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "image too large (max 8 MB)")
    media = image.content_type if image.content_type in {"image/jpeg", "image/png", "image/webp", "image/gif"} else "image/jpeg"
    return _public(snap.process(data, media, user_id=user_id, source=source))


@router.post("/sample/{name}")
def sample(name: str, user_id: str = "M001", source: str = "app") -> dict:
    if name not in SAMPLE_FILES:
        raise HTTPException(404, "unknown sample")
    data = (SAMPLES / SAMPLE_FILES[name]).read_bytes()
    return _public(snap.process(data, "image/png", user_id=user_id, source=source, sample=name))


@router.get("")
def documents(limit: int = 8) -> list[dict]:
    return [_public(d) for d in snap.recent(limit)]


@router.get("/image/{doc_id}")
def doc_image(doc_id: str) -> Response:
    found = snap.image(doc_id)
    if not found:
        raise HTTPException(404, "image not found")
    return Response(content=found[0], media_type=found[1])
