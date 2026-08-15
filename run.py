#!/usr/bin/env python3
import socket
import sys
import os

def get_local_ip():
    """Descobre o IP local da máquina na rede Wi-Fi / LAN"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def print_banner():
    local_ip = get_local_ip()
    port = 8000
    
    print("\n" + "=" * 65)
    print(" ⚡ ANTIGRAVITY LIVE CAPTIONS & TRANSCRIPTION SERVER ⚡ ")
    print("=" * 65)
    print(f" ▶ Acesso Local (Nesta máquina):   http://localhost:{port}")
    print(f" ▶ Acesso na Rede Local (Wi-Fi):   http://{local_ip}:{port}")
    print("=" * 65)
    print(" 🌐 PARA USAR NA INTERNET COM SUPORTE A MICROFONE (HTTPS):")
    print("    Abra outro terminal nesta pasta e execute um túnel público:")
    print("    - Opção 1 (Cloudflare Tunnel): npx cloudflared tunnel --url http://localhost:8000")
    print("    - Opção 2 (ngrok):             ngrok http 8000")
    print("=" * 65 + "\n")

if __name__ == "__main__":
    try:
        import uvicorn
        import fastapi
        import websockets
    except ImportError as e:
        print(f"\n❌ Dependência ausente: {e}")
        print("Por favor, instale as dependências executando:")
        print("   pip install -r requirements.txt\n")
        sys.exit(1)

    print_banner()
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
