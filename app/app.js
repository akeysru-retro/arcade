const API_URL = "https://script.google.com/macros/s/AKfycby95eSWi6EYQPY7sMzNIjpV0X-CXqV8E8Ouhho21TIC2J5GFuT9KxkshrXY9ZdkBUWNdQ/exec";

const tg = window.Telegram.WebApp;
tg.expand();

let state = {
    games: [],
    filteredGames: [],
    secrets: [],
    filteredSecrets: [],
    currentTab: 'games',
    gamesPage: 1,
    secretsPage: 1,
    itemsPerPage: 5,
    showOnlyFavorites: false,
    selectedGame: null,
    isSoundOn: true
};

document.addEventListener("DOMContentLoaded", () => {
    loadDataFromGoogle();
    setupEventListeners();
    var videoEl = document.getElementById('bg-video');
    if(videoEl) { videoEl.muted = true; videoEl.play().catch(() => {}); }
});

function loadDataFromGoogle() {
    fetch(`${API_URL}?action=get_data`)
        .then(response => response.json())
        .then(data => {
            state.games = data.games || [];
            state.secrets = data.secrets || [];
            
            state.games.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase(), 'ru'));
            state.filteredGames = [...state.games];
            
            filterGames();
            filterAndRenderSecrets();
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

// 4. ИНИЦИАЛИЗАЦИЯ ЭМУЛЯТОРА — РЕШЕНИЕ ПРОБЛЕМЫ С 32X И TG16
function startEmulator(game) {
    state.selectedGame = game;
    document.getElementById("back-to-catalog").classList.remove("hidden");
    document.getElementById("emulator-layer").style.display = "block";
    document.getElementById("app-tab-bar").style.display = "none";
    
    const container = document.getElementById("emulator-container");
    container.innerHTML = ""; 

    const emuDiv = document.createElement("div");
    emuDiv.id = "game-player";
    emuDiv.style.width = "100%"; emuDiv.style.height = "100%";
    container.appendChild(emuDiv);

    // Системные коды для правильной отрисовки интерфейса кнопок START
    const platformMap = {
        'NES': 'nes',                  
        'SNES': 'snes9x',              
        'SEGA': 'genesis_plus_gx',     
        '32X': 'sega32X',            // Вернет геймпад 32X с кнопкой START
        'SMS': 'segaMS',             // Вернет геймпад SMS с кнопкой START
        'TG16': 'pcEngine',          // Вернет геймпад PC Engine
        'GB': 'gambatte',              
        'GBC': 'gambatte',             
        'GBA': 'mgba'
    };
    
    const systemCode = platformMap[game.platform.toUpperCase()] || 'nes';

    window.EJS_player = '#game-player';
    window.EJS_biosUrl = '';
    window.EJS_gameUrl = game.rom_url;
    window.EJS_core = systemCode;
    window.EJS_pathtodata = './'; 
    window.EJS_language = 'ru';
    window.EJS_gameName = game.title.replace(/ /g, '_');

    // Настройки IndexedDB ("keep in browser")
    window.EJS_DefaultSaveMode = 'browser'; 
    window.EJS_autosave = true;             
    window.EJS_ForceLocalSave = true;       

    // ПЕРЕНАПРАВЛЕНИЕ НА ТВОИ ФАЙЛЫ (Решает зависание при запуске)
    if (game.platform.toUpperCase() === '32X') {
        window.EJS_coreName = 'picodrive';      // Берет picodrive.js из твоей папкиcores
    } else if (game.platform.toUpperCase() === 'SMS') {
        window.EJS_coreName = 'smsplus';        // Берет smsplus.js из твоей папки cores
    } else if (game.platform.toUpperCase() === 'TG16') {
        window.EJS_coreName = 'mednafen_pce';   // Берет mednafen_pce.js из твоей папки cores
    }

    window.EJS_startOnLoaded = true;
    window.EJS_volume = state.isSoundOn ? 1 : 0;

    const oldLoader = document.getElementById("emu-loader-script");
    if (oldLoader) oldLoader.remove();

    const script = document.createElement("script");
    script.src = "loader.js";
    script.id = "emu-loader-script";
    document.body.appendChild(script);
}

function toggleEmuSound() {
    state.isSoundOn = !state.isSoundOn;
    const soundBtn = document.getElementById("emu-sound-btn");
    soundBtn.innerText = state.isSoundOn ? "🔊 ЗВУК" : "🔇 ЗВУК";
    
    if (window.EJS_emulator && typeof window.EJS_emulator.setVolume === "function") {
        window.EJS_emulator.setVolume(state.isSoundOn ? 1 : 0);
    }
    const bgVideo = document.getElementById("bg-video");
    if (bgVideo) bgVideo.muted = !state.isSoundOn;
}

function closeEmulator() {
    document.getElementById("emulator-layer").style.display = "none";
    document.getElementById("back-to-catalog").classList.add("hidden");
    document.getElementById("app-tab-bar").style.display = "flex";
    document.getElementById("emulator-container").innerHTML = "";
    
    if (window.EJS_emulator && typeof window.EJS_emulator.destroy === "function") {
        window.EJS_emulator.destroy();
    }
    window.EJS_emulator = null;
    switchTab('games');
}

// 5. СЕКРЕТЫ И ЗАКАЗ ИГРЫ
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

function switchTab(tabName) {
    state.currentTab = tabName;
    document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
    document.getElementById(`tab-${tabName}`).classList.add("active");
    
    document.querySelectorAll(".tab-item").forEach(el => el.classList.remove("active"));
    const idx = tabName === 'games' ? 0 : tabName === 'secrets' ? 1 : 2;
    document.querySelectorAll(".tab-item")[idx].classList.add("active");
}

function setupEventListeners() {
    document.getElementById("search-game-input").addEventListener("input", () => { state.gamesPage = 1; filterGames(); });
    document.getElementById("search-secret-input").addEventListener("input", () => { state.secretsPage = 1; filterAndRenderSecrets(); });
}