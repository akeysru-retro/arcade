const API_URL = "https://script.google.com/macros/s/AKfycby95eSWi6EYQPY7sMzNIjpV0X-CXqV8E8Ouhho21TIC2J5GFuT9KxkshrXY9ZdkBUWNdQ/exec";
const tg = window.Telegram.WebApp;
tg.expand();

let pdfDoc = null;
let currentPdfPage = 1;
let totalPdfPages = 0;
let isPageRendering = false;
let pdfCanvas = null;
let pdfCtx = null;
let pdfScale = 1.0; // Текущий уровень масштаба (1.0 = по умолчанию)

// Переменные для отслеживания свайпов
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener("DOMContentLoaded", () => {
    loadDataFromGoogle();  
    setupEventListeners(); 

    const introVideo = document.getElementById('intro-video');
    const introLayer = document.getElementById('intro-layer');

    if (introVideo) {
        introVideo.muted = true; 
        introVideo.play().catch((err) => {
            console.log("Автоплей заблокирован, убираем интро:", err);
            endIntro(); 
        });

        if (introLayer) {
            introLayer.onclick = () => {
                introVideo.muted = false;
            };
        }

        introVideo.onended = () => {
            endIntro();
        };
    } else {
        endIntro();
    }
});

function endIntro() {
    const introLayer = document.getElementById("intro-layer");
    const introVideo = document.getElementById("intro-video");
    
    if (introVideo) {
        introVideo.pause(); 
    }
    
    if (introLayer) {
        introLayer.style.display = "none";
    }

    const menuBgVideo = document.getElementById('bg-video');
    if (menuBgVideo) { 
        menuBgVideo.muted = true; 
        menuBgVideo.play().catch(() => {}); 
    }
}

let state = {
    games: [],
    filteredGames: [],
    secrets: [],
    filteredSecrets: [],
    journals: [],       
    currentTab: 'games',
    gamesPage: 1,
    secretsPage: 1,
    journalsPage: 1,    
    itemsPerPage: 5,
    showOnlyFavorites: false,
    selectedGame: null,
    isSoundOn: true
};

function loadDataFromGoogle() {
    fetch(`${API_URL}?action=get_data`)
        .then(response => response.json())
        .then(data => {
            state.games = data.games || [];
            state.secrets = data.secrets || [];
            state.journals = data.journals || []; 
            
            state.games.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase(), 'ru'));
            state.filteredGames = [...state.games];
            
            filterGames();
            filterAndRenderSecrets();
            renderJournalsPage(); 
        })
        .catch(err => console.error("Ошибка сети:", err));
}

function isGameFavorite(gameId) {
    const favs = JSON.parse(localStorage.getItem('retro_favs') || "[]");
    return favs.includes(gameId);
}

function toggleFavorite(gameId, event) {
    event.stopPropagation();
    let favs = JSON.parse(localStorage.getItem('retro_favs') || "[]");
    const idx = favs.indexOf(gameId);
    if (idx === -1) { favs.push(gameId); } else { favs.splice(idx, 1); }
    localStorage.setItem('retro_favs', JSON.stringify(favs));
    
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    filterGames();
}

function filterGames() {
    const query = document.getElementById('search-game-input').value.toLowerCase().trim();
    state.filteredGames = state.games.filter(game => {
        const matchesSearch = game.title.toLowerCase().includes(query);
        const matchesFav = !state.showOnlyFavorites || isGameFavorite(game.id);
        return matchesSearch && matchesFav;
    });
    renderGamesPage();
}

function toggleFavFilter() {
    state.showOnlyFavorites = !state.showOnlyFavorites;
    const btn = document.getElementById('fav-filter-btn');
    if (state.showOnlyFavorites) {
        btn.classList.add('active'); btn.textContent = "[ РЕЖИМ: ТОЛЬКО ИЗБРАННОЕ ]";
    } else {
        btn.classList.remove('active'); btn.textContent = "[ ПОКАЗАТЬ ⭐ ИЗБРАННОЕ ]";
    }
    state.gamesPage = 1;
    filterGames();
}

function renderGamesPage() {
    const container = document.getElementById("games-list");
    container.innerHTML = "";
    
    if (state.filteredGames.length === 0) {
        container.innerHTML = '<div style="text-align:center; font-size:8px; color:#555; padding:30px 0;">СПИСОК ПУСТ</div>';
        renderPagination('games-pagination', 0, 1, () => {});
        return;
    }
    
    const start = (state.gamesPage - 1) * state.itemsPerPage;
    const end = start + state.itemsPerPage;
    const pageItems = state.filteredGames.slice(start, end);
    
    pageItems.forEach((game, index) => {
        const globalIndex = start + index + 1;
        const num = globalIndex.toString().padStart(4, '0');
        const item = document.createElement('div');
        item.className = 'retro-item';
        
        const isFav = isGameFavorite(game.id);
        const badgeClass = `badge-${game.platform.toLowerCase()}`;
        
        item.innerHTML = `
            <div class="game-click-zone">
                <div class="game-title-text">${num}. ${game.title}</div>
                <span class="item-system-badge ${badgeClass}">${game.platform}</span>
            </div>
            <div class="fav-star-btn ${isFav ? 'active' : ''}">⭐</div>
        `;
        
        item.querySelector('.game-click-zone').onclick = () => startEmulator(game);
        item.querySelector('.fav-star-btn').onclick = (e) => toggleFavorite(game.id, e);
        
        container.appendChild(item);
    });
    
    const totalPages = Math.ceil(state.filteredGames.length / state.itemsPerPage);
    renderPagination('games-pagination', totalPages, state.gamesPage, (newPage) => {
        state.gamesPage = newPage;
        renderGamesPage();
    });
}

function renderJournalsPage() {
    const container = document.getElementById("journals-list");
    if (!container) return;
    container.innerHTML = "";
    
    if (state.journals.length === 0) {
        container.innerHTML = '<div style="text-align:center; font-size:8px; color:#555; padding:30px 0;">НЕТ ДОСТУПНЫХ КНИГ</div>';
        renderPagination('journals-pagination', 0, 1, () => {});
        return;
    }
    
    const start = (state.journalsPage - 1) * state.itemsPerPage;
    const end = start + state.itemsPerPage;
    const pageJournals = state.journals.slice(start, end);
    
    pageJournals.forEach((journal, index) => {
        const globalIndex = start + index + 1;
        const num = globalIndex.toString().padStart(4, '0');
        const item = document.createElement('div');
        item.className = 'retro-item';
        item.style.cursor = 'pointer';
        
        item.innerHTML = `
            <div class="game-click-zone" style="justify-content: flex-start; gap: 10px;">
                <div class="game-title-text">${num}. ${journal.title}</div>
            </div>
            <span class="item-system-badge" style="background:#00aa00;">PDF</span>
        `;
        
        item.onclick = () => openPdfReader(journal.file_url);
        container.appendChild(item);
    });
    
    const totalPages = Math.ceil(state.journals.length / state.itemsPerPage);
    renderPagination('journals-pagination', totalPages, state.journalsPage, (newPage) => {
        state.journalsPage = newPage;
        renderJournalsPage();
    });
}

function openPdfReader(pdfUrl) {
    document.getElementById("back-to-catalog").classList.remove("hidden");
    document.getElementById("journal-layer").style.display = "block";
    document.getElementById("app-tab-bar").style.display = "none";
    
    pdfCanvas = document.getElementById('pdf-canvas');
    pdfCtx = pdfCanvas.getContext('2d');
    
    currentPdfPage = 1;
    pdfScale = 1.0; // Сбрасываем зум при открытии новой книги
    document.getElementById('pdf-page-num').textContent = "ЗАГРУЗКА...";
    
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    
    pdfjsLib.getDocument(pdfUrl).promise.then(pdfDoc_ => {
        pdfDoc = pdfDoc_;
        totalPdfPages = pdfDoc.numPages;
        renderPdfPage(currentPdfPage);
        setupPdfSwipeEvents(); // Инициализируем свайпы
    }).catch(err => {
        alert("ОШИБКА ОТКРЫТИЯ PDF КНИГИ!");
        closeEmulator();
    });
}

function renderPdfPage(num) {
    if (!pdfDoc) return;
    isPageRendering = true;
    document.getElementById('pdf-page-num').textContent = `${num} / ${totalPdfPages}`;
    
    pdfDoc.getPage(num).then(page => {
        const viewport = page.getViewport({ scale: 1 });
        
        // Базовая адаптивная ширина под экран смартфона
        const desiredWidth = Math.min(window.innerWidth - 20, 380);
        const baseScale = desiredWidth / viewport.width;
        
        // Итоговый масштаб с учетом пользовательского зума
        const finalScale = baseScale * pdfScale;
        const scaledViewport = page.getViewport({ scale: finalScale });
        
        pdfCanvas.height = scaledViewport.height;
        pdfCanvas.width = scaledViewport.width;
        
        const renderContext = {
            canvasContext: pdfCtx,
            viewport: scaledViewport
        };
        
        page.render(renderContext).promise.then(() => {
            isPageRendering = false;
        });
    });
}

// Функция инициализации жестов свайпа
function setupPdfSwipeEvents() {
    const canvas = document.getElementById('pdf-canvas');
    if (!canvas) return;

    // Удаляем старые слушатели, чтобы не дублировались
    canvas.ontouchstart = null;
    canvas.ontouchend = null;

    canvas.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipeGesture();
    }, { passive: true });
}

function handleSwipeGesture() {
    const swipeDistance = touchEndX - touchStartX;
    const swipeThreshold = 50; // Минимальное расстояние в пикселях для срабатывания свайпа

    // Если страница сильно увеличена, отключаем свайпы, чтобы не мешать горизонтальной прокрутке страницы
    if (pdfScale > 1.2) return;

    if (swipeDistance < -swipeThreshold) {
        // Свайп влево -> Следующая страница
        if (currentPdfPage < totalPdfPages && !isPageRendering) {
            if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
            currentPdfPage++;
            renderPdfPage(currentPdfPage);
        }
    } else if (swipeDistance > swipeThreshold) {
        // Свайп вправо -> Предыдущая страница
        if (currentPdfPage > 1 && !isPageRendering) {
            if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
            currentPdfPage--;
            renderPdfPage(currentPdfPage);
        }
    }
}

function queueRenderPage(num) {
    if (isPageRendering) return;
    renderPdfPage(num);
}

function startEmulator(game) {
    state.selectedGame = game;
    document.getElementById("back-to-catalog").classList.remove("hidden");
    document.getElementById("emulator-layer").style.display = "block";
    document.getElementById("app-tab-bar").style.display = "none";
    
    const container = document.getElementById("emulator-container");
    container.innerHTML = ""; 

    if (document.getElementById('gamepad')) {
        document.getElementById('gamepad').style.display = 'none';
    }

    const emuDiv = document.createElement("div");
    emuDiv.id = "game-player";
    emuDiv.style.width = "100%"; emuDiv.style.height = "100%";
    container.appendChild(emuDiv);

    const currentPlatform = game.platform.toUpperCase();

    const coreMap = {
        'NES': 'fceumm',          
        'SNES': 'snes9x',         
        'TG16': 'mednafen_pce',   
        'GB': 'gambatte',         
        'GBC': 'gambatte',        
        'GBA': 'mgba',            
        'SEGA': 'segaMD',         
        '32X': 'sega32x'          
    };

    const coreCode = coreMap[currentPlatform] || 'segaMD';

    window.EJS_system = undefined;
    window.EJS_VirtualGamepadSettings = undefined;
    window.EJS_controlScheme = undefined;
    window.EJS_Buttons = null;

    if (window.EJS_emulator && typeof window.EJS_emulator.destroy === "function") {
        try { window.EJS_emulator.destroy(); } catch(e) {}
    }

    window.EJS_player = '#game-player';
    window.EJS_biosUrl = '';
    window.EJS_gameUrl = game.rom_url; 
    window.EJS_core = coreCode; 
    window.EJS_pathtodata = './'; 
    window.EJS_language = 'ru';
    window.EJS_gameName = game.title.replace(/ /g, '_');

    window.EJS_loadOnStart = true; 
    window.EJS_DefaultSaveMode = 'browser'; 
    window.EJS_autosave = true;             
    window.EJS_ForceLocalSave = true;       
    window.EJS_startOnLoaded = true;
    window.EJS_volume = state.isSoundOn ? 1 : 0;

    const oldLoader = document.getElementById("emu-loader-script");
    if (oldLoader) oldLoader.remove();

    const script = document.createElement("script");
    script.src = "loader.js"; 
    script.id = "emu-loader-script";
    document.body.appendChild(script);
}

function closeEmulator() {
    document.getElementById("emulator-layer").style.display = "none";
    document.getElementById("journal-layer").style.display = "none";
    document.getElementById("back-to-catalog").classList.add("hidden");
    document.getElementById("app-tab-bar").style.display = "flex";
    
    try {
        if (window.EJS_emulator) {
            if (typeof window.EJS_emulator.stop === "function") window.EJS_emulator.stop();
            if (typeof window.EJS_emulator.destroy === "function") window.EJS_emulator.destroy();
            
            if (window.EJS_emulator.audioContext && typeof window.EJS_emulator.audioContext.close === "function") {
                window.EJS_emulator.audioContext.close().catch(() => {});
            }
        }

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            if (window.__ejsAudioContext && typeof window.__ejsAudioContext.close === "function") {
                window.__ejsAudioContext.close().catch(() => {});
                window.__ejsAudioContext = null;
            }
        }
    } catch (e) {}

    const oldContainer = document.getElementById("emulator-container");
    if (oldContainer) {
        oldContainer.remove();
        const newContainer = document.createElement("div");
        newContainer.id = "emulator-container";
        newContainer.style.width = "100%"; newContainer.style.height = "100%";
        newContainer.style.background = "#000";
        document.getElementById("emulator-layer").appendChild(newContainer);
    }
    
    window.EJS_emulator = null; pdfDoc = null;
    
    const oldLoader = document.getElementById("emu-loader-script");
    if (oldLoader) oldLoader.remove();

    const bgVideo = document.getElementById("bg-video");
    if (bgVideo) {
        if (state.isSoundOn) { bgVideo.muted = false; }
        bgVideo.play().catch(() => {});
    }

    switchTab(state.currentTab);
}

function submitOrder() {
    const gameName = document.getElementById("order-game-name").value.trim();
    const platform = document.getElementById("order-platform").value;
    if (!gameName) { alert("ВВЕДИТЕ НАЗВАНИЕ ИГРЫ!"); return; }
    
    const userId = tg.initDataUnsafe?.user?.id || "Локальный тест";
    const username = tg.initDataUnsafe?.user?.username ? `@${tg.initDataUnsafe.user.username}` : "no_name";

    tg.showPopup({
        title: "ВНИМАНИЕ!",
        message: "Добавление новой игры платное и стоит 100 рублей за заказ. Вас это устраивает?",
        buttons: [
            { id: "yes", type: "default", text: "ДА" },
            { id: "no", type: "destructive", text: "ОТМЕНА" }
        ]
    }, (buttonId) => {
        if (buttonId === "yes") {
            const orderData = { 
                action: "create_order", 
                status: "paid_intent",
                user_id: userId, 
                username: username, 
                game_name: gameName, 
                platform: platform 
            };
            
            fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "application/json" }, body: JSON.stringify(orderData) });
            
            tg.showAlert(`ОТЛИЧНО!\n\nДля активации заказа переведите 100 руб. по реквизитам:\n\n📞 Тел: 89132971262\n👤 Денис Владимирович Ф.\n🏦 Альфа банк\n\nЗаявка отправлена администратору!`);
            document.getElementById("order-game-name").value = "";
            
        } else {
            const cancelData = { 
                action: "create_order", 
                status: "cancelled_by_user",
                user_id: userId, 
                username: username, 
                game_name: gameName, 
                platform: platform 
            };
            
            fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cancelData) });
            document.getElementById("order-game-name").value = "";
        }
    });
}

function filterAndRenderSecrets() {
    const query = document.getElementById('search-secret-input').value.toLowerCase().trim();
    state.filteredSecrets = state.secrets.filter(sec => 
        sec.game_title.toLowerCase().includes(query) || sec.content.toLowerCase().includes(query)
    );
    renderSecretsPage();
}

function renderSecretsPage() {
    const container = document.getElementById("secrets-list");
    container.innerHTML = "";
    
    if (state.filteredSecrets.length === 0) {
        container.innerHTML = '<div style="text-align:center; font-size:8px; color:#555; padding-top:20px;">НИЧЕГО НЕ НАЙДЕНО</div>';
        renderPagination('secrets-pagination', 0, 1, () => {});
        return;
    }
    
    const start = (state.secretsPage - 1) * state.itemsPerPage;
    const end = start + state.itemsPerPage;
    const pageSecrets = state.filteredSecrets.slice(start, end);
    
    pageSecrets.forEach(item => {
        const card = document.createElement('div'); card.className = 'secret-card';
        card.innerHTML = `
            <div class="secret-game">[${item.platform}] ${item.game_title}</div>
            <div class="secret-title">${item.type}</div>
            <div class="secret-code">${item.content}</div>
        `;
        container.appendChild(card);
    });
    
    const totalPages = Math.ceil(state.filteredSecrets.length / state.itemsPerPage);
    renderPagination('secrets-pagination', totalPages, state.secretsPage, (newPage) => {
        state.secretsPage = newPage;
        renderSecretsPage();
    });
}

function renderPagination(containerId, totalPages, currentPage, callback) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    if (totalPages <= 1) return;

    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn'; prevBtn.disabled = (currentPage === 1); prevBtn.textContent = "◀ НАЗАД";
    prevBtn.onclick = () => { if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light'); callback(currentPage - 1); };

    const infoSpan = document.createElement('span');
    infoSpan.className = 'page-info-text'; infoSpan.innerHTML = `PAGE<br>${currentPage}/${totalPages}`;

    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn'; nextBtn.disabled = (currentPage === totalPages); nextBtn.textContent = "ВПЕРЕД ▶";
    nextBtn.onclick = () => { if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light'); callback(currentPage + 1); };

    container.appendChild(prevBtn); container.appendChild(infoSpan); container.appendChild(nextBtn);
}

// ТОЧНОЕ ИСПРАВЛЕНИЕ: Теперь перебираются строго классы .tab-content и корректно вешается активный класс!
function switchTab(tabName) {
    state.currentTab = tabName;
    
    // Скрываем абсолютно все вкладки с экрана
    document.querySelectorAll(".tab-content").forEach(el => {
        el.classList.remove("active");
    });
    
    // Показываем нужную вкладку по её ID (tab-games, tab-journals и т.д.)
    const targetSection = document.getElementById(`tab-${tabName}`);
    if (targetSection) {
        targetSection.classList.add("active");
    }
    
    // Переключаем подсветку кнопок в нижнем меню
    document.querySelectorAll(".tab-item").forEach(el => {
        el.classList.remove("active");
    });
    
    const idx = tabName === 'games' ? 0 : tabName === 'journals' ? 1 : tabName === 'secrets' ? 2 : 3;
    const activeBtn = document.querySelectorAll(".tab-item")[idx];
    if (activeBtn) {
        activeBtn.classList.add("active");
    }
}

function setupEventListeners() {
    document.getElementById("search-game-input").addEventListener("input", () => { state.gamesPage = 1; filterGames(); });
    document.getElementById("search-secret-input").addEventListener("input", () => { state.secretsPage = 1; filterAndRenderSecrets(); });

    document.getElementById('pdf-prev-btn').onclick = () => {
        if (currentPdfPage <= 1 || isPageRendering) return;
        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
        currentPdfPage--;
        queueRenderPage(currentPdfPage);
    };
    
    document.getElementById('pdf-next-btn').onclick = () => {
        if (currentPdfPage >= totalPdfPages || isPageRendering) return;
        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
        currentPdfPage++;
        queueRenderPage(currentPdfPage);
    };

    // Кнопки масштабирования PDF
    document.getElementById('pdf-zoom-in-btn').onclick = () => {
        if (pdfScale < 3.0) { // Ограничим зум максимум в 3 раза
            if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
            pdfScale += 0.25;
            renderPdfPage(currentPdfPage);
        }
    };

    document.getElementById('pdf-zoom-out-btn').onclick = () => {
        if (pdfScale > 0.75) { // Ограничим уменьшение
            if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
            pdfScale -= 0.25;
            renderPdfPage(currentPdfPage);
        }
    };

    document.getElementById('back-to-catalog').onclick = closeEmulator;
}