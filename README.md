# ⚡ Antigravity Live Captions & Transcription Web App

Sistema Web completo de **Transcrição de Voz e Legendas ao Vivo** em tempo real, onde os usuários podem escolher entre os papéis de **Transmissor de Voz** (quem fala no microfone) e **Receptor de Legendas** (quem assiste às legendas em tempo real com correções fonéticas e modo teleprompter).

---

## 🚀 Como Executar Localmente ou na Rede Wi-Fi

### 1. Instalar as dependências

Certifique-se de ter o Python 3.9+ instalado:

```bash
pip install -r requirements.txt
```

### 2. Iniciar o Servidor

```bash
python3 run.py
```

O terminal exibirá os links de acesso:
- **Acesso Local**: `http://localhost:8000`
- **Acesso na Rede Local**: `http://<IP_DA_SUA_MAQUINA>:8000` (ex: `http://192.168.1.15:8000`)

---

## 🌐 Como Usar na Internet (HTTPS para Microfone)

> ⚠️ **Importante**: Os navegadores (Google Chrome, Edge) **bloqueiam o uso do microfone** (Web Speech API) em endereços de IP públicos se a conexão **NÃO for HTTPS** (em `localhost` o HTTP é permitido).

Para usar a aplicação pela Internet de qualquer lugar do mundo com link seguro `https://`:

### Opção A: Cloudflare Tunnel (Recomendado e Gratuito - Não precisa instalar nada se tiver Node/npx)

Com o servidor `run.py` rodando, abra um novo terminal e execute:

```bash
npx cloudflared tunnel --url http://localhost:8000
```

O Cloudflare gerará um link público como `https://sua-url-aleatoria.trycloudflare.com`. **Compartilhe esse link com os transmissores e receptores!**

### Opção B: ngrok (Gratuito)

```bash
ngrok http 8000
```

Utilize a URL `https://...ngrok-free.app` gerada.

---

## 🎯 Funcionalidades Principais

1. **Seleção de Papel (Transmissor ou Receptor)**:
   - **Transmissor**: Fala no microfone e envia o texto transcrito em tempo real. Conta com medidor visual de VU do microfone (onda de volume) e pré-visualização ao vivo.
   - **Receptor**: Recebe as falas organizadas por balões de conversa com cores por participante ou em **Modo Legenda/Projetor** (fonte grande centralizada estilo teleprompter).

2. **Salas Múltiplas (Room IDs)**:
   - Digite qualquer nome de sala (ex: `reuniao-1`, `evento-a`) para isolar diferentes conversas ou salas de reuniões sem interferência.

3. **Substituição Fonética Dinâmica (`dicionario.json`)**:
   - Correção automática de termos técnicos e palavras faladas em inglês ou termos de estúdio (ex: transforma "quei frame" em `keyframe`, "confi ui" em `ComfyUI`).
   - É possível adicionar novos termos **ao vivo** direto pela interface do Receptor clicando no botão **📖 Dicionário**.

4. **Histórico e Exportação de Logs**:
   - Gravação automática das reuniões na pasta `logs/`.
   - Botão **📥 Baixar Log** no painel do Receptor para fazer o download da transcrição em arquivo TXT ou JSON.

---

## 📁 Estrutura de Arquivos

```
Antigravity/
├── dicionario.json      # Dicionário de correções fonéticas
├── requirements.txt     # Dependências (FastAPI, Uvicorn, WebSockets)
├── server.py            # Servidor FastAPI com WebSockets e APIs REST
├── run.py               # Script de execução rápida com detecção de IP
├── README.md            # Este manual de instruções
├── logs/                # Histórico gravado das reuniões (criado automaticamente)
└── static/
    ├── index.html       # Interface Web unificada (HTML5)
    ├── style.css        # Estilos modernos em Dark Mode e Glassmorphism
    └── app.js           # Lógica do cliente (Web Speech API, WS engine, VU meter)
```
