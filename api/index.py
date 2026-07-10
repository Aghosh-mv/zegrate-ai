import os, json, uuid
from datetime import datetime
from typing import List, Dict, Optional
from fastapi import FastAPI, HTTPException, Query
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
HF_INFERENCE_URL = "https://api-inference.huggingface.co/models/yimn-Aghosh/zegrate-turbo-debugger"
HF_TOKEN = os.getenv("HF_TOKEN", "")
ELEVENLABS_KEY = os.getenv("ELEVENLABS_KEY", "sk_b7e22ce5108865f919c24d43435e6b275d90c2abe4ead3b8")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")

if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

conversations: Dict[str, List[dict]] = {}
todos: List[dict] = []
apps: List[dict] = []
todo_id_counter = 0
app_id_counter = 0

VIRTUAL_MODELS = [
    {"name": "Zegrate AI", "size": 0, "digest": "virtual", "details": {"family": "zegrate", "parameter_size": "14B", "quantization_level": "Q4_K_M"}},
    {"name": "Zegrate Turbo Builder", "size": 0, "digest": "virtual", "details": {"family": "zegrate", "parameter_size": "1.3B", "quantization_level": "Q4_K_M"}},
]

THINK_PROMPT = {
    "role": "system",
    "content": (
        "Before you answer, do your reasoning inside [THINK]...[/THINK] tags. "
        "The thinking section is your internal monologue — keep it raw and honest. "
        "Then give your polished answer outside the tags."
    )
}

class ChatRequest(BaseModel):
    model: str
    messages: List[Dict[str, str]]
    stream: bool = True
    show_thinking: bool = False

class AddMessagesRequest(BaseModel):
    messages: List[Dict[str, str]]

class TodoItem(BaseModel):
    title: str
    completed: bool = False

class AppItem(BaseModel):
    name: str
    description: str = ""
    code: str = ""
    category: str = "general"

def map_model(name: str) -> str:
    if "debugger" in name.lower():
        return "zegrate-turbo-debugger:latest"
    if "builder" in name.lower():
        return "zegrate-turbo-builder:latest"
    if "turbo" in name.lower():
        return "qwen3.5:27b"
    if "zegrate" in name.lower():
        return "deepseek-builder:latest"
    return name

def build_messages_with_reasoning(msgs: List[Dict[str, str]], show_thinking: bool = False) -> List[Dict[str, str]]:
    if show_thinking:
        return [THINK_PROMPT] + msgs
    return msgs

def parse_thinking(content: str) -> tuple:
    thinking = ""
    response = content
    start = content.find("[THINK]")
    end = content.find("[/THINK]")
    if start != -1 and end != -1:
        thinking = content[start + 7:end].strip()
        response = (content[:start] + content[end + 8:]).strip()
    return thinking, response

async def check_ollama() -> bool:
    try:
        async with httpx.AsyncClient(timeout=3) as c:
            r = await c.get(f"{OLLAMA_HOST}/api/tags")
            return r.status_code == 200
    except Exception:
        return False

@app.get("/")
async def root():
    idx = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(idx):
        with open(idx) as f:
            return HTMLResponse(f.read())
    return HTMLResponse("<h1>Zegrate AI</h1><p>Frontend not found</p>")

@app.get("/api/health")
async def health():
    ollama_ok = await check_ollama()
    return {
        "status": "ok" if ollama_ok else "cloud",
        "ollama": ollama_ok,
        "hf_inference": True,
        "mode": "local" if ollama_ok else "cloud",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/models")
async def list_models():
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(f"{OLLAMA_HOST}/api/tags")
            if r.status_code == 200:
                data = r.json()
                models = data.get("models", [])
                models.sort(key=lambda m: m.get("size", 0), reverse=True)
                return {"models": VIRTUAL_MODELS + models, "virtual": [m["name"] for m in VIRTUAL_MODELS]}
    except Exception:
        pass
    return {"models": VIRTUAL_MODELS, "virtual": [m["name"] for m in VIRTUAL_MODELS]}

@app.post("/api/chat")
async def chat(req: ChatRequest):
    actual_model = map_model(req.model)
    msgs = build_messages_with_reasoning(req.messages, req.show_thinking)
    ollama_ok = await check_ollama()

    if req.stream:
        if ollama_ok:
            return StreamingResponse(
                stream_ollama(actual_model, msgs, req.show_thinking),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"}
            )
        else:
            return StreamingResponse(
                stream_hf(msgs, req.show_thinking),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"}
            )
    else:
        if ollama_ok:
            try:
                async with httpx.AsyncClient(timeout=120) as c:
                    r = await c.post(f"{OLLAMA_HOST}/api/chat", json={"model": actual_model, "messages": msgs, "stream": False}, timeout=120)
                    data = r.json()
                    content = data["message"]["content"]
                    thinking, response_text = parse_thinking(content)
                    return {"message": response_text, "thinking": thinking}
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
        else:
            try:
                async with httpx.AsyncClient(timeout=120) as c:
                    r = await c.post(
                        HF_INFERENCE_URL,
                        json={"inputs": json.dumps(msgs), "parameters": {"max_new_tokens": 4096, "temperature": 0.7}},
                        headers={"Authorization": f"Bearer {HF_TOKEN}", "Content-Type": "application/json"},
                        timeout=120,
                    )
                    data = r.json()
                    if isinstance(data, list) and len(data) > 0:
                        content = data[0].get("generated_text", "")
                    else:
                        content = data.get("generated_text", str(data))
                    thinking, response_text = parse_thinking(content)
                    return {"message": response_text, "thinking": thinking}
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

async def stream_ollama(model: str, messages: list, show_thinking: bool = False):
    try:
        async with httpx.AsyncClient(timeout=300) as c:
            async with c.stream("POST", f"{OLLAMA_HOST}/api/chat", json={"model": model, "messages": messages, "stream": True}, timeout=300) as response:
                buffer = ""
                in_thinking = False
                thinking_buf = ""
                async for line in response.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            if "message" in data and "content" in data["message"]:
                                chunk = data["message"]["content"]
                                buffer += chunk
                                if show_thinking:
                                    idx = buffer.find("[THINK]")
                                    if idx != -1 and not in_thinking:
                                        pre = buffer[:idx]
                                        if pre.strip():
                                            yield f"data: {json.dumps({'content': pre})}\n\n"
                                        buffer = buffer[idx + 7:]
                                        in_thinking = True
                                        thinking_buf = ""
                                    if in_thinking:
                                        end_idx = buffer.find("[/THINK]")
                                        if end_idx != -1:
                                            thinking_buf += buffer[:end_idx]
                                            yield f"data: {json.dumps({'thinking': thinking_buf})}\n\n"
                                            buffer = buffer[end_idx + 8:]
                                            in_thinking = False
                                        else:
                                            thinking_buf += buffer
                                            buffer = ""
                                else:
                                    yield f"data: {json.dumps({'content': chunk})}\n\n"
                            if data.get("done"):
                                if show_thinking and in_thinking and buffer.strip():
                                    yield f"data: {json.dumps({'thinking': thinking_buf + buffer})}\n\n"
                                yield f"data: {json.dumps({'done': True})}\n\n"
                                return
                        except json.JSONDecodeError:
                            continue
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"

async def stream_hf(messages: list, show_thinking: bool = False):
    """Stream from HF free Inference API (token-by-token format)"""
    try:
        payload = {
            "inputs": json.dumps(messages),
            "parameters": {"max_new_tokens": 4096, "temperature": 0.7},
            "stream": True,
        }
        headers = {"Authorization": f"Bearer {HF_TOKEN}", "Content-Type": "application/json"}
        buffer = ""
        in_thinking = False
        thinking_buf = ""
        async with httpx.AsyncClient(timeout=300) as c:
            async with c.stream("POST", HF_INFERENCE_URL, json=payload, headers=headers, timeout=300) as response:
                async for line in response.aiter_lines():
                    if line and line.startswith("data:"):
                        line_data = line[5:].strip()
                        if not line_data or line_data == "[DONE]":
                            continue
                        try:
                            data = json.loads(line_data)
                            token = data.get("token", {}).get("text", "")
                            if token:
                                buffer += token
                                if show_thinking:
                                    idx = buffer.find("[THINK]")
                                    if idx != -1 and not in_thinking:
                                        pre = buffer[:idx]
                                        if pre.strip():
                                            yield f"data: {json.dumps({'content': pre})}\n\n"
                                        buffer = buffer[idx + 7:]
                                        in_thinking = True
                                        thinking_buf = ""
                                    if in_thinking:
                                        end_idx = buffer.find("[/THINK]")
                                        if end_idx != -1:
                                            thinking_buf += buffer[:end_idx]
                                            yield f"data: {json.dumps({'thinking': thinking_buf})}\n\n"
                                            buffer = buffer[end_idx + 8:]
                                            in_thinking = False
                                        else:
                                            thinking_buf += buffer
                                            buffer = ""
                                else:
                                    yield f"data: {json.dumps({'content': token})}\n\n"
                        except json.JSONDecodeError:
                            continue
        if buffer.strip():
            yield f"data: {json.dumps({'content': buffer})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"

@app.post("/api/conversations")
async def create_conversation():
    conv_id = str(uuid.uuid4())
    conversations[conv_id] = []
    return {"id": conv_id, "title": "New Chat"}

@app.get("/api/conversations")
async def list_conversations(search: Optional[str] = Query(None)):
    result = []
    for cid, msgs in list(conversations.items()):
        title = "New Chat"
        for m in msgs:
            if m.get("role") == "user":
                content = m.get("content", "")
                title = content[:60] + ("..." if len(content) > 60 else "")
                break
        if search:
            if search.lower() not in title.lower():
                continue
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

@app.get("/api/todos")
async def list_todos():
    return {"todos": sorted(todos, key=lambda t: t.get("created_at", ""), reverse=True)}

@app.post("/api/todos")
async def create_todo(item: TodoItem):
    global todo_id_counter
    todo_id_counter += 1
    entry = {"id": todo_id_counter, "title": item.title, "completed": item.completed, "created_at": datetime.now().isoformat()}
    todos.append(entry)
    return entry

@app.put("/api/todos/{todo_id}")
async def update_todo(todo_id: int, item: TodoItem):
    for t in todos:
        if t["id"] == todo_id:
            t["title"] = item.title
            t["completed"] = item.completed
            return t
    raise HTTPException(status_code=404, detail="Todo not found")

@app.delete("/api/todos/{todo_id}")
async def delete_todo(todo_id: int):
    global todos
    todos = [t for t in todos if t["id"] != todo_id]
    return {"ok": True}

@app.get("/api/apps")
async def list_apps(search: Optional[str] = Query(None)):
    result = list(apps)
    if search:
        s = search.lower()
        result = [a for a in result if s in a["name"].lower() or s in a.get("description", "").lower()]
    return {"apps": sorted(result, key=lambda a: a.get("updated_at", ""), reverse=True)}

@app.post("/api/apps")
async def create_app(item: AppItem):
    global app_id_counter
    app_id_counter += 1
    entry = {"id": app_id_counter, "name": item.name, "description": item.description, "code": item.code, "category": item.category, "created_at": datetime.now().isoformat(), "updated_at": datetime.now().isoformat()}
    apps.append(entry)
    return entry

@app.put("/api/apps/{app_id}")
async def update_app(app_id: int, item: AppItem):
    for a in apps:
        if a["id"] == app_id:
            a["name"] = item.name
            a["description"] = item.description
            a["code"] = item.code
            a["category"] = item.category
            a["updated_at"] = datetime.now().isoformat()
            return a
    raise HTTPException(status_code=404, detail="App not found")

@app.delete("/api/apps/{app_id}")
async def delete_app(app_id: int):
    global apps
    apps = [a for a in apps if a["id"] != app_id]
    return {"ok": True}

class TTSRequest(BaseModel):
    text: str
    voice_id: str = "21m00Tcm4TlvDq8ikWAM"

@app.post("/api/tts")
async def text_to_speech(req: TTSRequest):
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{req.voice_id}"
    headers = {"Accept": "audio/mpeg", "Content-Type": "application/json", "xi-api-key": ELEVENLABS_KEY}
    data = {"text": req.text, "model_id": "eleven_monolingual_v1", "voice_settings": {"stability": 0.5, "similarity_boost": 0.5}}
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(url, headers=headers, json=data)
            if r.status_code == 200:
                return StreamingResponse(iter([r.content]), media_type="audio/mpeg", headers={"Content-Disposition": "inline; filename=speech.mp3"})
            else:
                raise HTTPException(status_code=r.status_code, detail="TTS failed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
