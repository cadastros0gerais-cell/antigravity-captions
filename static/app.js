document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DOM ---
    const views = {
        roleSelection: document.getElementById('roleSelectionView'),
        transmitter: document.getElementById('transmitterView'),
        receiver: document.getElementById('receiverView')
    };

    // Global inputs & Badges
    const roomIdInput = document.getElementById('roomIdInput');
    const roomBadge = document.getElementById('roomBadge');
    const currentRoomText = document.getElementById('currentRoomText');
    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');

    // Alternador de Tema (☀️ Claro / 🌙 Escuro com ~85% cinza leve no escuro)
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeToggleIcon = document.getElementById('themeToggleIcon');
    const themeToggleText = document.getElementById('themeToggleText');

    let currentTheme = localStorage.getItem('linca_theme') || 'dark';

    function applyTheme(theme) {
        currentTheme = theme;
        localStorage.setItem('linca_theme', theme);

        if (theme === 'dark') {
            document.body.classList.add('theme-dark');
            document.body.classList.remove('theme-light');
            if (themeToggleIcon) themeToggleIcon.innerText = '☀️';
            if (themeToggleText) themeToggleText.innerText = 'Modo Claro';
        } else {
            document.body.classList.add('theme-light');
            document.body.classList.remove('theme-dark');
            if (themeToggleIcon) themeToggleIcon.innerText = '🌙';
            if (themeToggleText) themeToggleText.innerText = 'Modo Escuro';
        }
    }

    applyTheme(currentTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const nextTheme = (currentTheme === 'dark') ? 'light' : 'dark';
            applyTheme(nextTheme);
        });
    }

    // Botões de Seleção de Papel
    const selectTransmissorBtn = document.getElementById('selectTransmissorBtn');
    const selectReceptorBtn = document.getElementById('selectReceptorBtn');

    // Transmitter Elements
    const backFromTransmissorBtn = document.getElementById('backFromTransmissorBtn');
    const transmitterNameInput = document.getElementById('transmitterNameInput');
    const micDeviceSelect = document.getElementById('micDeviceSelect');
    const toggleMicBtn = document.getElementById('toggleMicBtn');
    const micBtnText = document.getElementById('micBtnText');
    const micStatusText = document.getElementById('micStatusText');
    const liveTextPreview = document.getElementById('liveTextPreview');
    const vuMeterCanvas = document.getElementById('vuMeterCanvas');

    // Receiver Elements
    const backFromReceptorBtn = document.getElementById('backFromReceptorBtn');
    const modeChatBtn = document.getElementById('modeChatBtn');
    const modeSubtitleBtn = document.getElementById('modeSubtitleBtn');
    const searchInput = document.getElementById('searchInput');
    const teleprompterControls = document.getElementById('teleprompterControls');
    const fontSmallerBtn = document.getElementById('fontSmallerBtn');
    const fontBiggerBtn = document.getElementById('fontBiggerBtn');
    const captionsWrapper = document.getElementById('captionsWrapper');
    const captionsContainer = document.getElementById('captionsContainer');
    const connectionWaiting = document.getElementById('connectionWaiting');
    const waitingRoomName = document.getElementById('waitingRoomName');
    const subtitleOverlay = document.getElementById('subtitleOverlay');
    const subtitleSpeaker = document.getElementById('subtitleSpeaker');
    const subtitleText = document.getElementById('subtitleText');
    const exportLogBtn = document.getElementById('exportLogBtn');
    const clearCaptionsBtn = document.getElementById('clearCaptionsBtn');

    // Modal Dicionário
    const openDictModalBtn = document.getElementById('openDictModalBtn');
    const closeDictModalBtn = document.getElementById('closeDictModalBtn');
    const dictModal = document.getElementById('dictModal');
    const dictPalavraInput = document.getElementById('dictPalavraInput');
    const dictSubstInput = document.getElementById('dictSubstInput');
    const addDictTermBtn = document.getElementById('addDictTermBtn');
    const dictTermsList = document.getElementById('dictTermsList');

    // Elementos de Compartilhamento & Sala Privada
    const generateRandomRoomBtn = document.getElementById('generateRandomRoomBtn');
    const shareRoomBtnTransmitter = document.getElementById('shareRoomBtnTransmitter');
    const shareRoomBtnReceiver = document.getElementById('shareRoomBtnReceiver');
    const shareModal = document.getElementById('shareModal');
    const closeShareModalBtn = document.getElementById('closeShareModalBtn');
    const shareLinkInput = document.getElementById('shareLinkInput');
    const copyShareLinkBtn = document.getElementById('copyShareLinkBtn');
    const shareQrCodeImage = document.getElementById('shareQrCodeImage');
    const toastNotification = document.getElementById('toastNotification');

    // Modal de Participantes
    const openUsersModalBtn = document.getElementById('openUsersModalBtn');
    const usersCountBadge = document.getElementById('usersCountBadge');
    const usersModal = document.getElementById('usersModal');
    const closeUsersModalBtn = document.getElementById('closeUsersModalBtn');
    const usersListContainer = document.getElementById('usersListContainer');
    
    // Variáveis de Estado
    let connectedUsersList = [];
    let myClientId = null;
    let currentRole = null; // 'transmissor' | 'receptor'
    let currentRoom = 'main';
    let ws = null;
    let isRecording = false;
    let recognition = null;
    let audioContext = null;
    let mediaStream = null;
    let analyser = null;
    let animationFrameId = null;

    // Resiliência do WebSocket
    let isManualDisconnect = false;
    let reconnectAttempts = 0;
    let reconnectTimeout = null;

    // Desduplicação e Estado de Transmissão por Sender
    let processedMsgIds = new Set();
    let activeSpeechDivs = {}; // senderId -> bubble element
    let silenceTimers = {};   // senderId -> timer
    let lastInterimTexts = {};// senderId -> interim string
    let recentFinalTextsBySender = {}; // senderId -> string (deduplicar mensagens idênticas consecutivas)
    let lastSentInterimText = '';

    // Teleprompter e Visualização
    let subtitleFontSize = 30; // px
    let currentViewMode = 'chat'; // 'chat' | 'subtitle'

    // Dicionário e Cores
    let abreviacoes = {};
    const speakerColors = {};
    const colorPalette = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];
    let colorIndex = 0;

    // Carregar nome salvo no localStorage
    const savedName = localStorage.getItem('antigravity_user_name');
    if (savedName && transmitterNameInput) {
        transmitterNameInput.value = savedName;
    }

    // --- SELEÇÃO DE MICROFONE DISPONÍVEL ---
    async function carregarDispositivosMicrofone() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(d => d.kind === 'audioinput');
            if (micDeviceSelect) {
                micDeviceSelect.innerHTML = '<option value="">Microfone Padrão do Sistema</option>';
                audioInputs.forEach((device, index) => {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.innerText = device.label || `Microfone ${index + 1}`;
                    micDeviceSelect.appendChild(option);
                });
            }
        } catch (err) {
            console.error("Erro ao enumerar dispositivos de áudio:", err);
        }
    }
    carregarDispositivosMicrofone();

    // --- NAVEGAÇÃO DE VIEWS ---
    function switchView(viewName) {
        Object.keys(views).forEach(key => {
            if (key === viewName) {
                views[key].classList.add('active');
            } else {
                views[key].classList.remove('active');
            }
        });
    }

    function updateRoomBadge(room) {
        currentRoom = room.trim() || 'main';
        if (currentRoomText) currentRoomText.innerText = currentRoom;
        if (roomBadge) roomBadge.style.display = 'inline-flex';
    }

    function setStatus(text, statusType) {
        if (statusText) statusText.innerText = text;
        if (statusBadge) {
            statusBadge.className = 'badge';
            if (statusType === 'connected') {
                statusBadge.classList.add('badge-connected');
            } else if (statusType === 'connecting') {
                statusBadge.classList.add('badge-room');
            } else {
                statusBadge.classList.add('badge-disconnected');
            }
        }
    }

    // --- ENGINE WEBSOCKET COM RECONEXÃO AUTOMÁTICA ---
    function initWebSocket(room) {
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            ws.close();
        }

        clearTimeout(reconnectTimeout);
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/${encodeURIComponent(room)}`;

        setStatus("Conectando...", "connecting");
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            reconnectAttempts = 0;
            setStatus("Conectado", "connected");
            if (openUsersModalBtn) openUsersModalBtn.style.display = 'inline-flex';
            
            const myName = (currentRole === 'transmissor') 
                ? (transmitterNameInput.value.trim() || 'Transmissor') 
                : (localStorage.getItem('antigravity_user_name') || 'Leitor');

            ws.send(JSON.stringify({
                type: 'join',
                name: myName,
                role: currentRole
            }));

            if (currentRole === 'receptor') {
                carregarHistoricoSala(room);
            }
        };

        ws.onclose = () => {
            if (openUsersModalBtn) openUsersModalBtn.style.display = 'none';

            if (!isManualDisconnect && currentRole) {
                reconnectAttempts++;
                const delay = Math.min(10000, 1000 * Math.pow(1.4, reconnectAttempts));
                setStatus(`Reconectando (${reconnectAttempts})...`, "connecting");
                reconnectTimeout = setTimeout(() => {
                    if (!isManualDisconnect && currentRole) {
                        initWebSocket(room);
                    }
                }, delay);
            } else {
                setStatus("Desconectado", "disconnected");
            }
        };

        ws.onerror = (err) => {
            console.error("Erro no WebSocket:", err);
            setStatus("Erro de Conexão", "disconnected");
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'welcome') {
                    myClientId = data.clientId;
                    return;
                }

                if (data.type === 'user_list_update') {
                    connectedUsersList = data.users || [];
                    if (usersCountBadge) usersCountBadge.innerText = connectedUsersList.length;
                    renderizarListaParticipantes();
                    return;
                }

                if (data.type === 'user_joined') {
                    showToast(`👋 ${data.name} (${data.role}) entrou na sala`);
                    return;
                }

                if (data.type === 'user_left') {
                    showToast(`🚪 ${data.name} saiu da sala`);
                    return;
                }

                if (data.type === 'kicked') {
                    alert(data.message || "Você foi desconectado da sala por um participante.");
                    exitRoom();
                    return;
                }

                // Processar mensagem de áudio/texto no Receptor
                if (data.name && data.text !== undefined && currentRole === 'receptor') {
                    processarMensagemReceptor(data);
                }
            } catch (e) {
                console.error("Erro ao ler mensagem WS:", e);
            }
        };
    }

    // --- DICIONÁRIO FONÉTICO ---
    function carregarDicionario() {
        fetch('/dicionario.json')
            .then(res => res.json())
            .then(data => {
                if (!data.erro) {
                    abreviacoes = data;
                    renderizarTermosDicionario();
                }
            })
            .catch(err => console.error("Erro ao carregar dicionário:", err));
    }
    carregarDicionario();

    function aplicarSubstituicoes(texto) {
        if (!texto) return '';
        let txt = texto.toLowerCase();
        for (const [palavra, subst] of Object.entries(abreviacoes)) {
            if (palavra.startsWith("___")) continue;
            const regex = new RegExp(`\\b${escapeRegExp(palavra)}\\b`, 'gi');
            txt = txt.replace(regex, subst);
        }
        return txt;
    }

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // --- GERENCIAMENTO E SAÍDA LIMPA DA SALA ---
    function exitRoom(isBrowserPopState = false) {
        isManualDisconnect = true;
        clearTimeout(reconnectTimeout);
        stopRecording();
        currentRole = null;
        if (ws) {
            try { ws.close(); } catch(e){}
            ws = null;
        }
        if (roomBadge) roomBadge.style.display = 'none';
        if (openUsersModalBtn) openUsersModalBtn.style.display = 'none';
        if (captionsContainer) captionsContainer.innerHTML = '';
        activeSpeechDivs = {};
        silenceTimers = {};
        lastInterimTexts = {};
        processedMsgIds.clear();
        switchView('roleSelection');

        if (!isBrowserPopState && history.state && history.state.inRoom) {
            try { history.back(); } catch(e){}
        }
    }

    // --- LÓGICA DO TRANSMISSOR ---
    selectTransmissorBtn.addEventListener('click', () => {
        isManualDisconnect = false;
        const room = roomIdInput.value.trim() || 'main';
        currentRole = 'transmissor';
        updateRoomBadge(room);
        switchView('transmitter');
        initWebSocket(room);
        setupSpeechRecognition();

        if (!history.state || !history.state.inRoom) {
            history.pushState({ inRoom: true, room: room }, "", window.location.href);
        }
    });

    backFromTransmissorBtn.addEventListener('click', () => {
        exitRoom();
    });

    function setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Navegador incompatível com a Web Speech API. Por favor, utilize o Google Chrome ou Microsoft Edge.");
            return;
        }

        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

        recognition = new SpeechRecognition();
        // No Safari, continuous = true empilha resultados passados. continuous = false evita a acumulacao duplicada.
        recognition.continuous = !isSafari;
        recognition.interimResults = true;
        recognition.lang = 'pt-BR';

        let lastProcessedIndex = 0;

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const chunk = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    if (i >= lastProcessedIndex) {
                        finalTranscript += chunk + ' ';
                        lastProcessedIndex = i + 1;
                    }
                } else {
                    interimTranscript += chunk;
                }
            }

            const userName = transmitterNameInput.value.trim() || "Anônimo";

            if (finalTranscript.trim() !== '') {
                const text = finalTranscript.trim();
                liveTextPreview.innerText = `"${text}"`;
                lastSentInterimText = '';
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ name: userName, text: text, isFinal: true }));
                }
            } else if (interimTranscript.trim() !== '') {
                const text = interimTranscript.trim();
                liveTextPreview.innerText = `"${text}..."`;
                lastSentInterimText = text;
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ name: userName, text: text, isFinal: false }));
                }
            }
        };

        let restartTimeout = null;
        recognition.onend = () => {
            lastProcessedIndex = 0;
            if (isRecording) {
                if (lastSentInterimText && ws && ws.readyState === WebSocket.OPEN) {
                    const userName = transmitterNameInput.value.trim() || "Anônimo";
                    ws.send(JSON.stringify({ name: userName, text: lastSentInterimText, isFinal: true }));
                    lastSentInterimText = '';
                }

                clearTimeout(restartTimeout);
                restartTimeout = setTimeout(() => {
                    if (isRecording) {
                        try { recognition.start(); } catch (e) {}
                    }
                }, 200);
            }
        };

        recognition.onerror = (event) => {
            console.error("Erro no reconhecimento de voz:", event.error);
            if (micStatusText) micStatusText.innerText = `Status: ${event.error}`;
        };
    }

    let nameDebounceTimeout = null;
    if (transmitterNameInput) {
        transmitterNameInput.addEventListener('input', () => {
            const newName = transmitterNameInput.value.trim() || "Anônimo";
            localStorage.setItem('antigravity_user_name', newName);

            clearTimeout(nameDebounceTimeout);
            nameDebounceTimeout = setTimeout(() => {
                if (ws && ws.readyState === WebSocket.OPEN && currentRole) {
                    ws.send(JSON.stringify({
                        type: 'join',
                        name: newName,
                        role: currentRole
                    }));
                }
            }, 400);
        });
    }

    toggleMicBtn.addEventListener('click', () => {
        const name = transmitterNameInput.value.trim();
        if (!name) {
            alert("Por favor, digite seu nome antes de iniciar o microfone.");
            transmitterNameInput.focus();
            return;
        }

        localStorage.setItem('antigravity_user_name', name);

        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    async function startRecording() {
        if (!recognition) setupSpeechRecognition();

        try {
            recognition.start();
            isRecording = true;
            toggleMicBtn.classList.add('recording');
            micBtnText.innerText = "Parar Microfone";
            micStatusText.innerText = "Transmitindo áudio ao vivo...";

            await initAudioVisualizer();
        } catch (e) {
            console.error("Não foi possível iniciar o microfone:", e);
            alert("Erro ao acessar o microfone. Verifique as permissões do navegador.");
        }
    }

    function stopRecording() {
        isRecording = false;

        if (lastSentInterimText && ws && ws.readyState === WebSocket.OPEN) {
            const userName = transmitterNameInput.value.trim() || "Anônimo";
            ws.send(JSON.stringify({ name: userName, text: lastSentInterimText, isFinal: true }));
            lastSentInterimText = '';
        }

        if (recognition) {
            try {
                recognition.abort();
                recognition.stop();
            } catch(e){}
        }
        toggleMicBtn.classList.remove('recording');
        micBtnText.innerText = "Iniciar Microfone";
        micStatusText.innerText = "Microfone desligado";

        if (mediaStream) {
            try {
                mediaStream.getTracks().forEach(track => track.stop());
            } catch(e){}
            mediaStream = null;
        }

        if (audioContext) {
            try { audioContext.close(); } catch(e){}
            audioContext = null;
        }
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    // Visualizador de Volume do Microfone (VU Meter)
    async function initAudioVisualizer() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            vuMeterCanvas.style.display = 'none';
            return;
        }

        try {
            const selectedMicId = micDeviceSelect ? micDeviceSelect.value : '';
            const constraints = {
                audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true
            };

            mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 64;
            const source = audioContext.createMediaStreamSource(mediaStream);
            source.connect(analyser);

            const canvasCtx = vuMeterCanvas.getContext('2d');
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            function draw() {
                if (!isRecording) return;
                animationFrameId = requestAnimationFrame(draw);
                analyser.getByteFrequencyData(dataArray);

                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const average = sum / dataArray.length;
                const normVolume = Math.min(1, average / 128);

                canvasCtx.clearRect(0, 0, vuMeterCanvas.width, vuMeterCanvas.height);
                
                const barWidth = vuMeterCanvas.width * normVolume;
                const gradient = canvasCtx.createLinearGradient(0, 0, vuMeterCanvas.width, 0);
                gradient.addColorStop(0, '#10b981');
                gradient.addColorStop(0.7, '#f59e0b');
                gradient.addColorStop(1, '#ef4444');

                canvasCtx.fillStyle = gradient;
                canvasCtx.fillRect(0, 0, barWidth, vuMeterCanvas.height);
            }

            draw();
        } catch (err) {
            console.error("Erro ao inicializar visualizador de áudio:", err);
        }
    }

    // --- LÓGICA DO RECEPTOR ---
    selectReceptorBtn.addEventListener('click', () => {
        isManualDisconnect = false;
        const room = roomIdInput.value.trim() || 'main';
        currentRole = 'receptor';
        updateRoomBadge(room);
        if (waitingRoomName) waitingRoomName.innerText = room;
        switchView('receiver');
        initWebSocket(room);

        if (!history.state || !history.state.inRoom) {
            history.pushState({ inRoom: true, room: room }, "", window.location.href);
        }
    });

    backFromReceptorBtn.addEventListener('click', () => {
        exitRoom();
    });

    // NAVEGAÇÃO DO BROWSER ("VOLTAR") E FECHAMENTO
    window.addEventListener('popstate', (event) => {
        if (currentRole) {
            exitRoom(true);
        }
    });

    window.addEventListener('beforeunload', () => {
        stopRecording();
        if (ws) {
            try { ws.close(); } catch(e){}
        }
    });

    // MODOS CHAT / TELEPROMPTER E AJUSTE DE FONTE
    modeChatBtn.addEventListener('click', () => {
        currentViewMode = 'chat';
        modeChatBtn.classList.add('active');
        modeSubtitleBtn.classList.remove('active');
        captionsWrapper.style.display = 'flex';
        subtitleOverlay.style.display = 'none';
        if (teleprompterControls) teleprompterControls.style.display = 'none';
    });

    modeSubtitleBtn.addEventListener('click', () => {
        currentViewMode = 'subtitle';
        modeSubtitleBtn.classList.add('active');
        modeChatBtn.classList.remove('active');
        captionsWrapper.style.display = 'none';
        subtitleOverlay.style.display = 'block';
        if (teleprompterControls) teleprompterControls.style.display = 'flex';
    });

    if (fontBiggerBtn) {
        fontBiggerBtn.addEventListener('click', () => {
            subtitleFontSize = Math.min(64, subtitleFontSize + 4);
            if (subtitleText) subtitleText.style.fontSize = `${subtitleFontSize}px`;
        });
    }

    if (fontSmallerBtn) {
        fontSmallerBtn.addEventListener('click', () => {
            subtitleFontSize = Math.max(18, subtitleFontSize - 4);
            if (subtitleText) subtitleText.style.fontSize = `${subtitleFontSize}px`;
        });
    }

    // BUSCA / FILTRO NO HISTÓRICO
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim().toLowerCase();
            const bubbles = captionsContainer.querySelectorAll('.chat-bubble');
            bubbles.forEach(bubble => {
                const text = bubble.innerText.toLowerCase();
                if (!query || text.includes(query)) {
                    bubble.style.display = 'block';
                } else {
                    bubble.style.display = 'none';
                }
            });
        });
    }

    function getSpeakerColor(name) {
        if (!speakerColors[name]) {
            speakerColors[name] = colorPalette[colorIndex % colorPalette.length];
            colorIndex++;
        }
        return speakerColors[name];
    }

    function finalizeSpeakerBubble(senderKey) {
        if (silenceTimers[senderKey]) {
            clearTimeout(silenceTimers[senderKey]);
            delete silenceTimers[senderKey];
        }
        if (activeSpeechDivs[senderKey]) {
            const currentTextDiv = activeSpeechDivs[senderKey].querySelector('.chat-text');
            if (currentTextDiv) {
                currentTextDiv.classList.remove('interim');
            }
            activeSpeechDivs[senderKey] = null;
        }
        delete lastInterimTexts[senderKey];
    }

    // PROCESSAR MENSAGENS NO RECEPTOR (ISOLAMENTO POR SENDER ID & DESDUPLICAÇÃO)
    function processarMensagemReceptor(data) {
        const name = data.name || "Anônimo";
        const text = data.text;
        const isFinal = data.isFinal;
        const senderKey = data.senderId || name; // Chave única por participante
        const msgId = data.msgId;

        // Evitar processar mensagens finais duplicadas
        if (isFinal && msgId && processedMsgIds.has(msgId)) {
            return;
        }

        if (connectionWaiting) connectionWaiting.style.display = 'none';
        const color = getSpeakerColor(name);
        const textoFormatado = aplicarSubstituicoes(text);

        // Atualizar overlay do Teleprompter
        if (subtitleSpeaker) {
            subtitleSpeaker.innerText = name;
            subtitleSpeaker.style.color = color;
        }
        if (subtitleText) {
            subtitleText.innerText = textoFormatado;
            subtitleText.style.fontSize = `${subtitleFontSize}px`;
        }

        // Modo Chat (Sempre processa e salva no histórico, mesmo se estiver no Teleprompter)
        if (isFinal) {
            if (msgId) processedMsgIds.add(msgId);

            // Prevenir duplicatas idênticas consecutivas do mesmo participante (bug do Safari)
            const lastText = recentFinalTextsBySender[senderKey] || '';
            if (lastText && lastText.toLowerCase() === textoFormatado.trim().toLowerCase()) {
                return;
            }
            recentFinalTextsBySender[senderKey] = textoFormatado.trim();

            if (silenceTimers[senderKey]) {
                clearTimeout(silenceTimers[senderKey]);
                delete silenceTimers[senderKey];
            }

            if (!activeSpeechDivs[senderKey]) {
                criarBalaoChat(name, color, senderKey);
            } else {
                // Atualizar o nome caso o participante tenha alterado
                const speakerDiv = activeSpeechDivs[senderKey].querySelector('.chat-speaker span');
                if (speakerDiv) speakerDiv.innerText = name;
            }

            const currentTextDiv = activeSpeechDivs[senderKey].querySelector('.chat-text');
            currentTextDiv.innerText = textoFormatado;
            currentTextDiv.classList.remove('interim');
            activeSpeechDivs[senderKey] = null;
            delete lastInterimTexts[senderKey];
        } else {
            const prevInterim = lastInterimTexts[senderKey] || '';
            if (activeSpeechDivs[senderKey] && prevInterim && !textoFormatado.toLowerCase().startsWith(prevInterim.substring(0, Math.min(12, prevInterim.length)).toLowerCase())) {
                finalizeSpeakerBubble(senderKey);
            }

            if (!activeSpeechDivs[senderKey]) {
                criarBalaoChat(name, color, senderKey);
            } else {
                const speakerDiv = activeSpeechDivs[senderKey].querySelector('.chat-speaker span');
                if (speakerDiv) speakerDiv.innerText = name;
            }

            const currentTextDiv = activeSpeechDivs[senderKey].querySelector('.chat-text');
            currentTextDiv.innerText = textoFormatado + " ...";
            currentTextDiv.classList.add('interim');
            lastInterimTexts[senderKey] = textoFormatado;

            if (silenceTimers[senderKey]) {
                clearTimeout(silenceTimers[senderKey]);
            }
            silenceTimers[senderKey] = setTimeout(() => {
                finalizeSpeakerBubble(senderKey);
            }, 1500);
        }

        scrollToBottom();
    }

    function scrollToBottom() {
        if (captionsWrapper) {
            captionsWrapper.scrollTop = captionsWrapper.scrollHeight;
        }
        const anchor = document.getElementById('scrollAnchor');
        if (anchor) {
            anchor.scrollIntoView({ behavior: 'auto', block: 'end' });
        }
    }

    function criarBalaoChat(name, color, senderKey) {
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        bubble.style.borderLeftColor = color;

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const speakerDiv = document.createElement('div');
        speakerDiv.className = 'chat-speaker';
        speakerDiv.style.color = color;
        speakerDiv.innerHTML = `<span>${escapeHtml(name)}</span><time>${timeStr}</time>`;

        const textDiv = document.createElement('div');
        textDiv.className = 'chat-text';

        bubble.appendChild(speakerDiv);
        bubble.appendChild(textDiv);
        captionsContainer.appendChild(bubble);

        activeSpeechDivs[senderKey] = bubble;
    }

    function carregarHistoricoSala(room) {
        fetch(`/api/history/${encodeURIComponent(room)}`)
            .then(res => res.json())
            .then(history => {
                if (Array.isArray(history) && history.length > 0) {
                    if (connectionWaiting) connectionWaiting.style.display = 'none';
                    history.forEach(item => {
                        if (item.name && item.text) {
                            if (item.msgId) processedMsgIds.add(item.msgId);
                            const color = getSpeakerColor(item.name);
                            const bubble = document.createElement('div');
                            bubble.className = 'chat-bubble';
                            bubble.style.borderLeftColor = color;

                            const speakerDiv = document.createElement('div');
                            speakerDiv.className = 'chat-speaker';
                            speakerDiv.style.color = color;
                            speakerDiv.innerHTML = `<span>${escapeHtml(item.name)}</span><time>${item.timestamp || ''}</time>`;

                            const textDiv = document.createElement('div');
                            textDiv.className = 'chat-text';
                            textDiv.innerText = aplicarSubstituicoes(item.text);

                            bubble.appendChild(speakerDiv);
                            bubble.appendChild(textDiv);
                            captionsContainer.appendChild(bubble);
                        }
                    });
                    scrollToBottom();
                }
            })
            .catch(err => console.error("Erro ao carregar histórico:", err));
    }

    // Exportar Logs da Reunião (Funciona tanto no Modo Chat quanto no Modo Teleprompter)
    exportLogBtn.addEventListener('click', () => {
        const bubbles = captionsContainer.querySelectorAll('.chat-bubble');
        let logLines = [];

        bubbles.forEach(b => {
            const speaker = b.querySelector('.chat-speaker span')?.innerText || '';
            const time = b.querySelector('.chat-speaker time')?.innerText || '';
            const text = b.querySelector('.chat-text')?.innerText || '';
            if (text && speaker) {
                logLines.push(`[${time}] ${speaker}: ${text}`);
            }
        });

        if (logLines.length > 0) {
            const blob = new Blob([logLines.join('\n')], { type: 'text/plain;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `linca_log_${currentRoom || 'main'}.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast("📥 Log da reunião baixado!");
        } else {
            window.open(`/api/export/${encodeURIComponent(currentRoom || 'main')}?format=txt`, '_blank');
        }
    });

    clearCaptionsBtn.addEventListener('click', () => {
        if (confirm("Deseja limpar as legendas da tela?")) {
            captionsContainer.innerHTML = '';
            activeSpeechDivs = {};
            processedMsgIds.clear();
            if (connectionWaiting) connectionWaiting.style.display = 'flex';
        }
    });

    // --- DICIONÁRIO FONÉTICO (ADIÇÃO E EXCLUSÃO) ---
    openDictModalBtn.addEventListener('click', () => {
        dictModal.style.display = 'flex';
        renderizarTermosDicionario();
    });

    closeDictModalBtn.addEventListener('click', () => {
        dictModal.style.display = 'none';
    });

    dictModal.addEventListener('click', (e) => {
        if (e.target === dictModal) {
            dictModal.style.display = 'none';
        }
    });

    addDictTermBtn.addEventListener('click', () => {
        const palavra = dictPalavraInput.value.trim();
        const subst = dictSubstInput.value.trim();

        if (!palavra || !subst) {
            alert("Preencha a palavra ouvida e o termo correto.");
            return;
        }

        fetch('/api/dicionario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ palavra, substitucao: subst })
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'sucesso') {
                abreviacoes = data.dicionario;
                dictPalavraInput.value = '';
                dictSubstInput.value = '';
                renderizarTermosDicionario();
                showToast("✨ Termo adicionado ao dicionário!");
            } else {
                alert(data.detail || "Erro ao salvar termo.");
            }
        })
        .catch(err => alert("Erro ao comunicar com o servidor: " + err));
    });

    function removerTermoDicionario(palavra) {
        if (!confirm(`Deseja remover o termo "${palavra}" do dicionário?`)) return;

        fetch(`/api/dicionario/${encodeURIComponent(palavra)}`, {
            method: 'DELETE'
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'sucesso') {
                abreviacoes = data.dicionario;
                renderizarTermosDicionario();
                showToast("🗑️ Termo removido com sucesso!");
            } else {
                alert(data.detail || "Erro ao remover termo.");
            }
        })
        .catch(err => alert("Erro ao comunicar com o servidor: " + err));
    }

    function renderizarTermosDicionario() {
        dictTermsList.innerHTML = '';
        const entries = Object.entries(abreviacoes).filter(([key]) => !key.startsWith("___"));

        if (entries.length === 0) {
            dictTermsList.innerHTML = '<p class="text-muted">Nenhum termo cadastrado.</p>';
            return;
        }

        entries.forEach(([palavra, subst]) => {
            const item = document.createElement('div');
            item.className = 'dict-item';
            
            const wordsDiv = document.createElement('div');
            wordsDiv.className = 'dict-item-words';
            wordsDiv.innerHTML = `<span class="wrong">"${escapeHtml(palavra)}"</span> → <span class="correct">"${escapeHtml(subst)}"</span>`;

            const delBtn = document.createElement('button');
            delBtn.className = 'btn-delete-term';
            delBtn.title = 'Remover termo';
            delBtn.innerText = '🗑️';
            delBtn.addEventListener('click', () => removerTermoDicionario(palavra));

            item.appendChild(wordsDiv);
            item.appendChild(delBtn);
            dictTermsList.appendChild(item);
        });
    }

    // --- SALA PRIVADA & COMPARTILHAMENTO ---
    function generateRandomRoomId() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let randomStr = '';
        for (let i = 0; i < 6; i++) {
            randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `sala-${randomStr}`;
    }

    if (generateRandomRoomBtn) {
        generateRandomRoomBtn.addEventListener('click', () => {
            const newRoom = generateRandomRoomId();
            roomIdInput.value = newRoom;
            showToast(`🎲 Sala privada gerada: ${newRoom}`);
        });
    }

    function showToast(message) {
        if (!toastNotification) return;
        toastNotification.innerText = message;
        toastNotification.style.display = 'block';
        setTimeout(() => {
            toastNotification.style.display = 'none';
        }, 3000);
    }

    function copyToClipboard(text, successMsg = '🔗 Link copiado!') {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                showToast(successMsg);
            }).catch(() => fallbackCopyTextToClipboard(text, successMsg));
        } else {
            fallbackCopyTextToClipboard(text, successMsg);
        }
    }

    function fallbackCopyTextToClipboard(text, successMsg) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showToast(successMsg);
        } catch (err) {
            alert("Copie o link manualmente: " + text);
        }
        document.body.removeChild(textArea);
    }

    function getNeutralShareableLink() {
        const room = currentRoom || roomIdInput.value.trim() || 'main';
        const url = new URL(window.location.origin + window.location.pathname);
        url.searchParams.set('room', room);
        return url.toString();
    }

    function openShareModal() {
        const link = getNeutralShareableLink();
        if (shareLinkInput) shareLinkInput.value = link;
        if (shareQrCodeImage) {
            shareQrCodeImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}`;
        }
        if (shareModal) shareModal.style.display = 'flex';
    }

    if (shareRoomBtnTransmitter) shareRoomBtnTransmitter.addEventListener('click', openShareModal);
    if (shareRoomBtnReceiver) shareRoomBtnReceiver.addEventListener('click', openShareModal);

    if (closeShareModalBtn) {
        closeShareModalBtn.addEventListener('click', () => {
            if (shareModal) shareModal.style.display = 'none';
        });
    }

    if (shareModal) {
        shareModal.addEventListener('click', (e) => {
            if (e.target === shareModal) {
                shareModal.style.display = 'none';
            }
        });
    }

    if (copyShareLinkBtn) {
        copyShareLinkBtn.addEventListener('click', () => {
            const link = shareLinkInput ? shareLinkInput.value : getNeutralShareableLink();
            copyToClipboard(link, '🔗 Link da Sala copiado!');
        });
    }

    function handleUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const roomParam = params.get('room');
        if (roomParam) {
            roomIdInput.value = roomParam.trim();
        }
    }
    handleUrlParams();

    // --- MODAL DE PARTICIPANTES ---
    // --- HOVER BALÃO TRANSPARENTE E MODAL DE PARTICIPANTES ---
    const usersHoverPopover = document.getElementById('usersHoverPopover');
    const usersHoverList = document.getElementById('usersHoverList');

    function renderizarHoverParticipantes() {
        if (!usersHoverList) return;
        usersHoverList.innerHTML = '';

        if (!connectedUsersList || connectedUsersList.length === 0) {
            usersHoverList.innerHTML = '<div class="popover-user-item">Nenhum participante</div>';
            return;
        }

        connectedUsersList.forEach(user => {
            const item = document.createElement('div');
            item.className = 'popover-user-item';
            const roleIcon = user.role === 'transmissor' ? '🎙️' : '📺';
            const roleClass = user.role === 'transmissor' ? 'user-role-tag transmissor' : 'user-role-tag receptor';

            item.innerHTML = `
                <span>${roleIcon} ${escapeHtml(user.name)}</span>
                <span class="${roleClass}">${user.role}</span>
            `;
            usersHoverList.appendChild(item);
        });
    }

    function renderizarListaParticipantes() {
        if (!usersListContainer) return;
        usersListContainer.innerHTML = '';

        if (connectedUsersList.length === 0) {
            usersListContainer.innerHTML = '<p class="text-muted">Nenhum participante conectado.</p>';
            return;
        }

        const myName = (currentRole === 'transmissor') 
            ? (transmitterNameInput.value.trim() || 'Transmissor') 
            : (localStorage.getItem('antigravity_user_name') || 'Leitor');

        connectedUsersList.forEach(user => {
            const card = document.createElement('div');
            card.className = 'user-card-item';

            const roleIcon = user.role === 'transmissor' ? '🎙️' : '📺';
            const isSelf = (user.id === myClientId) || (user.name === myName && user.role === currentRole);

            const infoDiv = document.createElement('div');
            infoDiv.className = 'user-card-info';
            infoDiv.innerHTML = `
                <span>${roleIcon}</span>
                <span class="user-card-name">${escapeHtml(user.name)}</span>
                <span class="user-role-tag ${user.role}">${user.role}</span>
            `;

            card.appendChild(infoDiv);

            if (!isSelf) {
                const kickBtn = document.createElement('button');
                kickBtn.className = 'btn-kick';
                kickBtn.innerText = '❌ Remover';
                kickBtn.addEventListener('click', () => {
                    if (confirm(`Deseja desconectar "${user.name}" da sala?`)) {
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'kick', targetId: user.id }));
                        }
                    }
                });
                card.appendChild(kickBtn);
            }

            usersListContainer.appendChild(card);
        });
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    if (openUsersModalBtn) {
        openUsersModalBtn.addEventListener('mouseenter', () => {
            renderizarHoverParticipantes();
            if (usersHoverPopover) usersHoverPopover.style.display = 'block';
        });

        openUsersModalBtn.addEventListener('mouseleave', () => {
            if (usersHoverPopover) usersHoverPopover.style.display = 'none';
        });

        openUsersModalBtn.addEventListener('click', () => {
            if (usersHoverPopover) usersHoverPopover.style.display = 'none';
            renderizarListaParticipantes();
            if (usersModal) usersModal.style.display = 'flex';
        });
    }

    if (closeUsersModalBtn) {
        closeUsersModalBtn.addEventListener('click', () => {
            if (usersModal) usersModal.style.display = 'none';
        });
    }

    if (usersModal) {
        usersModal.addEventListener('click', (e) => {
            if (e.target === usersModal) {
                usersModal.style.display = 'none';
            }
        });
    }
});
