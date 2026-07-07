import os, json, uuid
from datetime import datetime
from typing import List, Dict
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx

app = FastAPI(title="Zegrate AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")

if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

conversations: Dict[str, List[dict]] = {}

class ChatRequest(BaseModel):
    model: str
    messages: List[Dict[str, str]]
    stream: bool = True

class AddMessagesRequest(BaseModel):
    messages: List[Dict[str, str]]

@app.get("/")
async def root():
    idx = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(idx):
        with open(idx) as f:
            return HTMLResponse(f.read())
    return HTMLResponse("<h1>Zegrate AI</h1><p>Frontend not found</p>")

@app.get("/api/health")
async def health():
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(f"{OLLAMA_HOST}/api/tags")
            ollama_ok = r.status_code == 200
    except Exception:
        ollama_ok = False
    return {
        "status": "ok" if ollama_ok else "degraded",
        "ollama": ollama_ok,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/models")
async def list_models():
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(f"{OLLAMA_HOST}/api/tags")
            if r.status_code == 200:
                data = r.json()
                models = data.get("models", [])
                return {"models": sorted(models, key=lambda m: m.get("size", 0), reverse=True)}
    except Exception:
        pass
    return {"models": []}

@app.post("/api/chat")
async def chat(req: ChatRequest):
    if req.stream:
        return StreamingResponse(
            stream_chat(req.model, req.messages),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            }
        )
    else:
        try:
            async with httpx.AsyncClient(timeout=120) as c:
                r = await c.post(
                    f"{OLLAMA_HOST}/api/chat",
                    json={"model": req.model, "messages": req.messages, "stream": False},
                    timeout=120,
                )
                data = r.json()
                return {"message": data["message"]["content"]}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

async def stream_chat(model: str, messages: list):
    try:
        async with httpx.AsyncClient(timeout=300) as c:
            async with c.stream(
                "POST",
                f"{OLLAMA_HOST}/api/chat",
                json={"model": model, "messages": messages, "stream": True},
                timeout=300,
            ) as response:
                async for line in response.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            if "message" in data and "content" in data["message"]:
                                content = data["message"]["content"]
                                yield f"data: {json.dumps({'content': content})}\n\n"
                            if data.get("done"):
                                yield f"data: {json.dumps({'done': True})}\n\n"
                                return
                        except json.JSONDecodeError:
                            continue
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"

@app.post("/api/conversations")
async def create_conversation():
    conv_id = str(uuid.uuid4())
    conversations[conv_id] = []
    return {"id": conv_id, "title": "New Chat"}

@app.get("/api/conversations")
async def list_conversations():
    result = []
    for cid, msgs in list(conversations.items()):
        title = "New Chat"
        for m in msgs:
            if m.get("role") == "user":
                content = m.get("content", "")
                title = content[:60] + ("..." if len(content) > 60 else "")
                break
        result.append({"id": cid, "title": title, "message_count": len(msgs)})
    result.sort(key=lambda x: x["message_count"], reverse=True)
    return {"conversations": result}

@app.get("/api/conversations/{conv_id}")
async def get_conversation(conv_id: str):
    if conv_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs = conversations[conv_id]
    title = "Chat"
    for m in msgs:
        if m.get("role") == "user":
            content = m.get("content", "")
            title = content[:60] + ("..." if len(content) > 60 else "")
            break
    return {"id": conv_id, "messages": msgs, "title": title}

@app.post("/api/conversations/{conv_id}/messages")
async def add_messages(conv_id: str, req: AddMessagesRequest):
    if conv_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conversations[conv_id].extend(req.messages)
    return {"ok": True}

@app.delete("/api/conversations/{conv_id}")
async def delete_conversation(conv_id: str):
    conversations.pop(conv_id, None)
    return {"ok": True}
