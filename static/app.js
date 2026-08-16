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

    // Botões de Seleção de Papel
    const selectTransmissorBtn = document.getElementById('selectTransmissorBtn');
    const selectReceptorBtn = document.getElementById('selectReceptorBtn');

    // Transmitter Elements
    const backFromTransmissorBtn = document.getElementById('backFromTransmissorBtn');
    const transmitterNameInput = document.getElementById('transmitterNameInput');
    const toggleMicBtn = document.getElementById('toggleMicBtn');
    const micBtnText = document.getElementById('micBtnText');
    const micStatusText = document.getElementById('micStatusText');
    const liveTextPreview = document.getElementById('liveTextPreview');
    const vuMeterCanvas = document.getElementById('vuMeterCanvas');

    // Receiver Elements
    const backFromReceptorBtn = document.getElementById('backFromReceptorBtn');
    const modeChatBtn = document.getElementById('modeChatBtn');
    const modeSubtitleBtn = document.getElementById('modeSubtitleBtn');
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
    const shareTransmitterLinkBtn = document.getElementById('shareTransmitterLinkBtn');
    const qrTransmitterBtn = document.getElementById('qrTransmitterBtn');
    const shareReceiverLinkBtn = document.getElementById('shareReceiverLinkBtn');
    const qrReceiverBtn = document.getElementById('qrReceiverBtn');
    const qrModal = document.getElementById('qrModal');
    const closeQrModalBtn = document.getElementById('closeQrModalBtn');
    const qrCodeImage = document.getElementById('qrCodeImage');
    const copyQrLinkBtn = document.getElementById('copyQrLinkBtn');
    const toastNotification = document.getElementById('toastNotification');
    let currentRole = null; // 'transmissor' | 'receptor'
    let currentRoom = 'main';
    let ws = null;
    let isRecording = false;
    let recognition = null;
    let audioContext = null;
    let mediaStream = null;
    let analyser = null;
    let animationFrameId = null;

    // Dicionário de substituições
    let abreviacoes = {};
    const speakerColors = {};
    const colorPalette = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];
    let colorIndex = 0;
    let activeSpeechDivs = {};
    let currentViewMode = 'chat'; // 'chat' | 'subtitle'

    // Carregar nome salvo no localStorage
    const savedName = localStorage.getItem('antigravity_user_name');
    if (savedName) {
        transmitterNameInput.value = savedName;
    }

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
        currentRoomText.innerText = currentRoom;
        roomBadge.style.display = 'inline-flex';
    }

    function setStatus(text, statusType) {
        statusBadge.innerText = text;
        statusBadge.className = 'badge';
        if (statusType === 'connected') {
            statusBadge.classList.add('badge-connected');
        } else if (statusType === 'connecting') {
            statusBadge.classList.add('badge-room');
        } else {
            statusBadge.classList.add('badge-disconnected');
        }
    }

    // --- WEBSOCKET ENGINE ---
    function initWebSocket(room) {
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            ws.close();
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/${encodeURIComponent(room)}`;

        setStatus("Conectando...", "connecting");
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            setStatus("Conectado ao vivo", "connected");
            if (currentRole === 'receptor') {
                carregarHistoricoSala(room);
            }
        };

        ws.onclose = () => {
            setStatus("Desconectado", "disconnected");
        };

        ws.onerror = (err) => {
            console.error("Erro no WebSocket:", err);
            setStatus("Erro de Conexão", "disconnected");
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                // Estatísticas do servidor
                if (data.type === 'room_stats') {
                    return;
                }

                // Processar mensagem de áudio/texto
                if (data.name && data.text !== undefined && currentRole === 'receptor') {
                    processarMensagemReceptor(data.name, data.text, data.isFinal);
                }
            } catch (e) {
                console.error("Erro ao ler mensagem WS:", e);
            }
        };
    }

    // --- CARREGAR DICIONÁRIO ---
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
            if (palavra.startsWith("___")) continue; // Ignora cabeçalhos de categoria
            const regex = new RegExp(`\\b${palavra}\\b`, 'gi');
            txt = txt.replace(regex, subst);
        }
        return txt;
    }

    // --- LÓGICA DO TRANSMISSOR ---
    selectTransmissorBtn.addEventListener('click', () => {
        const room = roomIdInput.value.trim() || 'main';
        currentRole = 'transmissor';
        updateRoomBadge(room);
        switchView('transmitter');
        initWebSocket(room);
        setupSpeechRecognition();
    });

    backFromTransmissorBtn.addEventListener('click', () => {
        stopRecording();
        currentRole = null;
        if (ws) ws.close();
        roomBadge.style.display = 'none';
        switchView('roleSelection');
    });

    function setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Navegador incompatível com a Web Speech API. Por favor, utilize o Google Chrome ou Microsoft Edge.");
            return;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'pt-BR';

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            const userName = transmitterNameInput.value.trim() || "Anônimo";

            if (finalTranscript.trim() !== '') {
                const text = finalTranscript.trim();
                liveTextPreview.innerText = `"${text}"`;
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ name: userName, text: text, isFinal: true }));
                }
            } else if (interimTranscript.trim() !== '') {
                const text = interimTranscript.trim();
                liveTextPreview.innerText = `"${text}..."`;
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ name: userName, text: text, isFinal: false }));
                }
            }
        };

        let restartTimeout = null;
        recognition.onend = () => {
            if (isRecording) {
                clearTimeout(restartTimeout);
                restartTimeout = setTimeout(() => {
                    if (isRecording) {
                        try { recognition.start(); } catch (e) {}
                    }
                }, 300);
            }
        };

        recognition.onerror = (event) => {
            console.error("Erro de reconhecimento de voz:", event.error);
            micStatusText.innerText = `Erro: ${event.error}`;
        };
    }

    toggleMicBtn.addEventListener('click', () => {
        const name = transmitterNameInput.value.trim();
        if (!name) {
            alert("Por favor, digite seu nome antes de iniciar a gravação.");
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

            // Iniciar VU Meter
            await initAudioVisualizer();
        } catch (e) {
            console.error("Não foi possível iniciar o microfone:", e);
            alert("Erro ao acessar o microfone. Verifique as permissões do navegador.");
        }
    }

    function stopRecording() {
        isRecording = false;
        if (recognition) {
            try { recognition.stop(); } catch(e){}
        }
        toggleMicBtn.classList.remove('recording');
        micBtnText.innerText = "Iniciar Microfone";
        micStatusText.innerText = "Microfone pausado";

        if (audioContext) {
            try { audioContext.close(); } catch(e){}
            audioContext = null;
        }
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
    }

    // Visualizador de Volume do Microfone (VU Meter)
    async function initAudioVisualizer() {
        // Em celulares, não abre o getUserMedia secundário para evitar bips/conflitos de som no Android/iOS
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            vuMeterCanvas.style.display = 'none';
            return;
        }

        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
                
                // Desenhar barra de volume gradiente
                const barWidth = vuMeterCanvas.width * normVolume;
                const gradient = canvasCtx.createLinearGradient(0, 0, vuMeterCanvas.width, 0);
                gradient.addColorStop(0, '#10b981');
                gradient.addColorStop(0.7, '#f59e0b');
                gradient.addColorStop(1, '#ef4444');

                canvasCtx.fillStyle = gradient;
                canvasCtx.fillRect(0, 10, barWidth, 20);
            }

            draw();
        } catch (err) {
            console.error("Erro ao inicializar visualizador de áudio:", err);
        }
    }

    // --- LÓGICA DO RECEPTOR ---
    selectReceptorBtn.addEventListener('click', () => {
        const room = roomIdInput.value.trim() || 'main';
        currentRole = 'receptor';
        updateRoomBadge(room);
        waitingRoomName.innerText = room;
        switchView('receiver');
        initWebSocket(room);
    });

    backFromReceptorBtn.addEventListener('click', () => {
        currentRole = null;
        if (ws) ws.close();
        roomBadge.style.display = 'none';
        captionsContainer.innerHTML = '';
        switchView('roleSelection');
    });

    // Alternar entre Modo Chat e Modo Subtitle/Legenda
    modeChatBtn.addEventListener('click', () => {
        currentViewMode = 'chat';
        modeChatBtn.classList.add('active');
        modeSubtitleBtn.classList.remove('active');
        captionsWrapper.style.display = 'flex';
        subtitleOverlay.style.display = 'none';
    });

    modeSubtitleBtn.addEventListener('click', () => {
        currentViewMode = 'subtitle';
        modeSubtitleBtn.classList.add('active');
        modeChatBtn.classList.remove('active');
        captionsWrapper.style.display = 'none';
        subtitleOverlay.style.display = 'block';
    });

    function getSpeakerColor(name) {
        if (!speakerColors[name]) {
            speakerColors[name] = colorPalette[colorIndex % colorPalette.length];
            colorIndex++;
        }
        return speakerColors[name];
    }

    function processarMensagemReceptor(name, text, isFinal) {
        connectionWaiting.style.display = 'none';
        const color = getSpeakerColor(name);
        const textoFormatado = aplicarSubstituicoes(text);

        // Se estiver no Modo Legenda/Projetor
        if (currentViewMode === 'subtitle') {
            subtitleSpeaker.innerText = name;
            subtitleSpeaker.style.color = color;
            subtitleText.innerText = textoFormatado;
            return;
        }

        // Modo Chat
        if (!activeSpeechDivs[name]) {
            criarBalaoChat(name, color);
        }

        const currentTextDiv = activeSpeechDivs[name].querySelector('.chat-text');

        if (isFinal) {
            currentTextDiv.innerText = textoFormatado;
            currentTextDiv.classList.remove('interim');
            activeSpeechDivs[name] = null; // Libera para próxima frase
        } else {
            currentTextDiv.innerText = textoFormatado + " ...";
            currentTextDiv.classList.add('interim');
        }

        // Auto-scroll automático e garantido para a última mensagem
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
        window.scrollTo(0, document.body.scrollHeight);
    }

    function criarBalaoChat(name, color) {
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        bubble.style.borderLeftColor = color;

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const speakerDiv = document.createElement('div');
        speakerDiv.className = 'chat-speaker';
        speakerDiv.style.color = color;
        speakerDiv.innerHTML = `<span>${name}</span><time>${timeStr}</time>`;

        const textDiv = document.createElement('div');
        textDiv.className = 'chat-text';

        bubble.appendChild(speakerDiv);
        bubble.appendChild(textDiv);
        captionsContainer.appendChild(bubble);

        activeSpeechDivs[name] = bubble;
    }

    function carregarHistoricoSala(room) {
        fetch(`/api/history/${encodeURIComponent(room)}`)
            .then(res => res.json())
            .then(history => {
                if (Array.isArray(history) && history.length > 0) {
                    connectionWaiting.style.display = 'none';
                    history.forEach(item => {
                        if (item.name && item.text) {
                            const color = getSpeakerColor(item.name);
                            const bubble = document.createElement('div');
                            bubble.className = 'chat-bubble';
                            bubble.style.borderLeftColor = color;

                            const speakerDiv = document.createElement('div');
                            speakerDiv.className = 'chat-speaker';
                            speakerDiv.style.color = color;
                            speakerDiv.innerHTML = `<span>${item.name}</span><time>${item.timestamp || ''}</time>`;

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

    // Exportar Logs da Reunião
    exportLogBtn.addEventListener('click', () => {
        window.open(`/api/export/${encodeURIComponent(currentRoom)}?format=txt`, '_blank');
    });

    clearCaptionsBtn.addEventListener('click', () => {
        captionsContainer.innerHTML = '';
        activeSpeechDivs = {};
        connectionWaiting.style.display = 'flex';
    });

    // --- GERENCIAMENTO DO DICIONÁRIO ---
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
            } else {
                alert(data.detail || "Erro ao salvar termo.");
            }
        })
        .catch(err => alert("Erro ao comunicar com o servidor: " + err));
    });

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
            item.innerHTML = `<span class="wrong">"${palavra}"</span> → <span class="correct">"${subst}"</span>`;
            dictTermsList.appendChild(item);
        });
    }

    // --- LÓGICA DE SALA PRIVADA & COMPARTILHAMENTO ---
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

    function getShareableLink(targetRole = 'receptor') {
        const room = currentRoom || roomIdInput.value.trim() || 'main';
        const url = new URL(window.location.origin + window.location.pathname);
        url.searchParams.set('room', room);
        url.searchParams.set('role', targetRole);
        return url.toString();
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

    // Handlers dos Botões de Copiar Link
    if (shareTransmitterLinkBtn) {
        shareTransmitterLinkBtn.addEventListener('click', () => {
            copyToClipboard(getShareableLink('receptor'), '🔗 Link para Receptores copiado!');
        });
    }

    if (shareReceiverLinkBtn) {
        shareReceiverLinkBtn.addEventListener('click', () => {
            copyToClipboard(getShareableLink('receptor'), '🔗 Link da Sala copiado!');
        });
    }

    // Modal de QR Code
    function openQrModal() {
        const link = getShareableLink('receptor');
        qrCodeImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(link)}`;
        qrModal.style.display = 'flex';
    }

    if (qrTransmitterBtn) qrTransmitterBtn.addEventListener('click', openQrModal);
    if (qrReceiverBtn) qrReceiverBtn.addEventListener('click', openQrModal);

    if (closeQrModalBtn) {
        closeQrModalBtn.addEventListener('click', () => {
            qrModal.style.display = 'none';
        });
    }

    if (qrModal) {
        qrModal.addEventListener('click', (e) => {
            if (e.target === qrModal) {
                qrModal.style.display = 'none';
            }
        });
    }

    if (copyQrLinkBtn) {
        copyQrLinkBtn.addEventListener('click', () => {
            copyToClipboard(getShareableLink('receptor'), '🔗 Link direto copiado!');
        });
    }

    // AUTO-CONEXÃO VIA PARÂMETROS DE URL (?room=XYZ&role=receptor)
    function handleUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const roomParam = params.get('room');
        const roleParam = params.get('role');

        if (roomParam) {
            roomIdInput.value = roomParam.trim();
        }

        if (roleParam === 'receptor') {
            setTimeout(() => {
                selectReceptorBtn.click();
            }, 100);
        } else if (roleParam === 'transmissor') {
            setTimeout(() => {
                selectTransmissorBtn.click();
            }, 100);
        }
    }

    handleUrlParams();
});
