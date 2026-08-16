import os
import json
import pathlib
import datetime
from typing import Dict, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

BASE_DIR = pathlib.Path(__file__).parent.resolve()
STATIC_DIR = BASE_DIR / "static"
LOGS_DIR = BASE_DIR / "logs"
LOGS_DIR.mkdir(exist_ok=True)

app = FastAPI(
    title="Antigravity Live Captions & Transcriptions",
    description="Sistema web de transcrição de voz em tempo real (Transmissor e Receptor)",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir pasta static se ela existir
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Connection Manager com suporte a múltiplas Salas (Rooms)
import uuid

# Connection Manager com suporte a presença em tempo real e remoção livre de participantes
class RoomConnectionManager:
    def __init__(self):
        # room_id -> dict of client_id: { 'ws': WebSocket, 'id': str, 'name': str, 'role': str }
        self.clients: Dict[str, Dict[str, dict]] = {}
        # room_id -> list of transcript history entries
        self.history: Dict[str, List[dict]] = {}

    async def connect(self, websocket: WebSocket, room_id: str = "main") -> str:
        await websocket.accept()
        client_id = uuid.uuid4().hex[:8]
        
        if room_id not in self.clients:
            self.clients[room_id] = {}
            self.history[room_id] = []
            
        self.clients[room_id][client_id] = {
            "ws": websocket,
            "id": client_id,
            "name": "Anônimo",
            "role": "receptor"
        }

        # Enviar o ID da conexão ao cliente que acabou de conectar
        await websocket.send_text(json.dumps({
            "type": "welcome",
            "clientId": client_id,
            "roomId": room_id
        }))
        
        return client_id

    async def update_user(self, room_id: str, client_id: str, name: str, role: str):
        if room_id in self.clients and client_id in self.clients[room_id]:
            self.clients[room_id][client_id]["name"] = name
            self.clients[room_id][client_id]["role"] = role
            
            await self.broadcast_presence_event(room_id, "user_joined", {
                "name": name,
                "role": role,
                "clientId": client_id
            })
            await self.broadcast_user_list(room_id)

    def disconnect(self, websocket: WebSocket, room_id: str = "main") -> Optional[dict]:
        removed_user = None
        if room_id in self.clients:
            for cid, info in list(self.clients[room_id].items()):
                if info["ws"] == websocket:
                    removed_user = info
                    del self.clients[room_id][cid]
                    break

            if len(self.clients[room_id]) == 0:
                del self.clients[room_id]
                if room_id in self.history:
                    del self.history[room_id]
                    
        return removed_user

    def get_users_list(self, room_id: str) -> List[dict]:
        if room_id not in self.clients:
            return []
        
        return [
            {
                "id": cid,
                "name": info["name"],
                "role": info["role"]
            }
            for cid, info in self.clients[room_id].items()
        ]

    async def broadcast_user_list(self, room_id: str):
        users = self.get_users_list(room_id)
        msg = json.dumps({
            "type": "user_list_update",
            "users": users,
            "connectionsCount": len(users),
            "roomId": room_id
        })
        await self.broadcast(msg, room_id)

    async def broadcast_presence_event(self, room_id: str, event_type: str, payload: dict):
        msg = json.dumps({
            "type": event_type,
            **payload
        })
        await self.broadcast(msg, room_id)

    async def kick_user(self, room_id: str, target_client_id: str, kicker_client_id: str):
        # Qualquer participante válido da sala pode solicitar a remoção de outro participante
        if room_id not in self.clients or kicker_client_id not in self.clients[room_id]:
            return

        if target_client_id in self.clients[room_id] and target_client_id != kicker_client_id:
            target = self.clients[room_id][target_client_id]
            target_ws = target["ws"]
            target_name = target["name"]
            
            try:
                await target_ws.send_text(json.dumps({
                    "type": "kicked",
                    "message": "Você foi desconectado da sala por um participante."
                }))
                await target_ws.close()
            except Exception:
                pass

            del self.clients[room_id][target_client_id]
            await self.broadcast_presence_event(room_id, "user_left", {
                "name": target_name,
                "reason": "kicked"
            })
            await self.broadcast_user_list(room_id)

    async def broadcast(self, message: str, room_id: str = "main"):
        if room_id not in self.clients:
            return
        
        dead_clients = []
        for cid, info in list(self.clients[room_id].items()):
            try:
                await info["ws"].send_text(message)
            except Exception:
                dead_clients.append(info["ws"])
        
        for dead_ws in dead_clients:
            self.disconnect(dead_ws, room_id)

    def add_to_history(self, room_id: str, entry: dict):
        if room_id not in self.history:
            self.history[room_id] = []
        self.history[room_id].append(entry)
        if len(self.history[room_id]) > 200:
            self.history[room_id] = self.history[room_id][-200:]

manager = RoomConnectionManager()

# --- ROTAS PRINCIPAIS ---

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return HTMLResponse(content=index_path.read_text(encoding="utf-8"))
    return HTMLResponse(content="<h2>Servidor Antigravity ativo! Pasta static/index.html não encontrada.</h2>")

@app.get("/dicionario.json")
async def serve_dicionario():
    dict_path = BASE_DIR / "dicionario.json"
    if dict_path.exists():
        return FileResponse(dict_path, media_type="application/json")
    return JSONResponse(content={"erro": "Arquivo dicionario.json não encontrado"}, status_code=404)

# --- ROTAS DE API REST ---

@app.get("/api/status")
async def get_status():
    total_connections = sum(len(clients) for clients in manager.clients.values())
    return {
        "status": "online",
        "app": "Antigravity Live Captions",
        "totalConnections": total_connections,
        "activeRoomsCount": len(manager.clients)
    }

@app.get("/api/dicionario")
async def get_dicionario_api():
    dict_path = BASE_DIR / "dicionario.json"
    if dict_path.exists():
        with open(dict_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    return {}

@app.post("/api/dicionario")
async def update_dicionario(body: dict = Body(...)):
    """
    Adiciona ou atualiza um termo no dicionário de substituição fonética.
    Formato esperado: {"palavra": "quei frame", "substitucao": "keyframe"}
    """
    dict_path = BASE_DIR / "dicionario.json"
    palavra = body.get("palavra", "").strip().lower()
    substitucao = body.get("substitucao", "").strip()

    if not palavra or not substitucao:
        raise HTTPException(status_code=400, detail="Parâmetros 'palavra' e 'substitucao' são obrigatórios.")

    current_dict = {}
    if dict_path.exists():
        with open(dict_path, "r", encoding="utf-8") as f:
            try:
                current_dict = json.load(f)
            except Exception:
                current_dict = {}

    current_dict[palavra] = substitucao

    with open(dict_path, "w", encoding="utf-8") as f:
        json.dump(current_dict, f, ensure_ascii=False, indent=4)

    return {"status": "sucesso", "mensagem": f"Termo '{palavra}' -> '{substitucao}' adicionado/atualizado.", "dicionario": current_dict}

@app.get("/api/history/{room_id}")
async def get_room_history(room_id: str):
    """Retorna o histórico recente em memória para leitores recém-conectados"""
    return manager.history.get(room_id, [])

@app.get("/api/export/{room_id}")
async def export_room_log(room_id: str, format: str = Query("txt", regex="^(txt|json)$")):
    """Baixa o log da reunião gravado no disco"""
    log_file = LOGS_DIR / f"{room_id}_log.txt"
    if not log_file.exists():
        if format == "json":
            return JSONResponse(content=[], headers={"Content-Disposition": f"attachment; filename={room_id}_log.json"})
        return Response(content="Nenhum log gravado para esta sala ainda.", media_type="text/plain", headers={"Content-Disposition": f"attachment; filename={room_id}_log.txt"})

    content = log_file.read_text(encoding="utf-8")
    
    if format == "json":
        lines = content.strip().split("\n")
        parsed = []
        for line in lines:
            if line:
                parsed.append({"line": line})
        return JSONResponse(content=parsed, headers={"Content-Disposition": f"attachment; filename={room_id}_log.json"})

    return Response(content=content, media_type="text/plain; charset=utf-8", headers={"Content-Disposition": f"attachment; filename={room_id}_log.txt"})

@app.delete("/api/logs/{room_id}")
async def clear_room_log(room_id: str):
    """Limpa o log da sala"""
    log_file = LOGS_DIR / f"{room_id}_log.txt"
    if log_file.exists():
        log_file.unlink()
    if room_id in manager.history:
        manager.history[room_id] = []
    return {"status": "sucesso", "mensagem": f"Log da sala '{room_id}' foi limpo."}

# --- WEBSOCKET ENDPOINT ---

@app.websocket("/ws")
@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: Optional[str] = "main"):
    client_id = await manager.connect(websocket, room_id)
    try:
        while True:
            data_str = await websocket.receive_text()
            try:
                data = json.loads(data_str)
            except Exception:
                continue

            # Injetar room_id se não especificado
            data["room"] = room_id
            msg_type = data.get("type")

            if msg_type == "join":
                name = data.get("name", "Anônimo").strip() or "Anônimo"
                role = data.get("role", "receptor")
                await manager.update_user(room_id, client_id, name, role)
                continue

            if msg_type == "kick":
                target_id = data.get("targetId")
                if target_id:
                    await manager.kick_user(room_id, target_id, client_id)
                continue

            # Se for uma frase finalizada, gravar no arquivo da sala
            if "name" in data and "text" in data and data.get("isFinal"):
                now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                entry = {
                    "timestamp": now_str,
                    "name": data["name"],
                    "text": data["text"],
                    "room": room_id
                }
                manager.add_to_history(room_id, entry)

                log_line = f"[{now_str}] {data['name']}: {data['text']}\n"
                log_file = LOGS_DIR / f"{room_id}_log.txt"
                with open(log_file, "a", encoding="utf-8") as f:
                    f.write(log_line)

            # Transmitir a mensagem recebida para todos os receptores/clientes da sala
            await manager.broadcast(json.dumps(data), room_id)

    except WebSocketDisconnect:
        user_info = manager.disconnect(websocket, room_id)
        if user_info:
            await manager.broadcast_presence_event(room_id, "user_left", {
                "name": user_info["name"],
                "reason": "disconnect"
            })
            await manager.broadcast_user_list(room_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
