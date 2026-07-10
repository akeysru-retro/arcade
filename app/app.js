// Ссылка на твое веб-приложение Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycby95eSWi6EYQPY7sMzNIjpV0X-CXqV8E8Ouhho21TIC2J5GFuT9KxkshrXY9ZdkBUWNdQ/exec";

// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand(); // Расширяем на весь экран смартфона

// Глобальное состояние приложения
let state = {
    games: [],
    secrets: [],
    currentTab: 'games',
    filteredSecrets: [],
    secretsPage: 1,
    secretsPerPage: 3, // Сколько секретов показывать на одной странице
    selectedGame: null,
    isSoundOn: true
};

// Запуск при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
    loadDataFromGoogle();
    setupEventListeners();
});

// 1. ЗАГРУЗКА ДАННЫХ ИЗ GOOGLE ТАБЛИЦЫ
function loadDataFromGoogle() {
    fetch(`${API_URL}?action=get_data`)
        .then(response => response.json())
        .then(data => {
            state.games = data.games || [];
            state.secrets = data.secrets || [];
            
            renderGames(state.games);
            filterAndRenderSecrets();
        })
        .catch(err => console.error("Ошибка загрузки данных:", err));
}

// 2. ОТРИСОВКА СПИСКА ИГР С ПОДДЕРЖКОЙ ИЗБРАННОГО
function renderGames(gamesList) {
    const container = document.getElementById("games-list");
    container.innerHTML = "";
    
    if (gamesList.length === 0) {
        container.innerHTML = "<div style='padding:20px; text-align:center;'>Игры не найдены...</div>";
        return;
    }
    
    // Получаем список ID избранных игр из localStorage устройства
    const favorites = JSON.parse(localStorage.getItem("v4_favorites") || "[]");
    
    // Сортируем игры: избранные всегда идут на самый верх списка!
    const sortedGames = [...gamesList].sort((a, b) => {
        const aFav = favorites.includes(a.id);
        const bFav = favorites.includes(b.id);
        return bFav - aFav; 
    });
    
    sortedGames.forEach(game => {
        const item = document.createElement("div");
        item.className = "game-item";
        
        const isFav = favorites.includes(game.id);
        const badgeClass = `badge-${game.platform.toLowerCase()}`;
        
        // Создаем структуру: Звезда + Название кликабельны отдельно от плашки платформы
        item.innerHTML = `
            <div class="game-left-side">
                <span class="fav-star ${isFav ? 'active' : ''}" data-id="${game.id}">★</span>
                <span class="game-click-zone" style="cursor:pointer;">${game.title}</span>
            </div>
            <span class="badge ${badgeClass}">${game.platform}</span>
        `;
        
        // Клик по звезде — добавляет/удаляет из избранного
        item.querySelector(".fav-star").onclick = (e) => {
            e.stopPropagation(); // Чтобы не запускалась игра при клике на звезду
            toggleFavorite(game.id);
        };
        
        // Клик по названию — запускает игру
        item.querySelector(".game-click-zone").onclick = () => openLaunchModal(game);
        
        container.appendChild(item);
    });
}

// Функция добавления/удаления игры из избранного устройства
function toggleFavorite(gameId) {
    let favorites = JSON.parse(localStorage.getItem("v4_favorites") || "[]");
    
    if (favorites.includes(gameId)) {
        favorites = favorites.filter(id => id !== gameId);
    } else {
        favorites.push(gameId);
    }
    
    localStorage.setItem("v4_favorites", JSON.stringify(favorites));
    
    // Мгновенно перерисовываем список игр с учетом новой сортировки
    const query = document.getElementById("search-game-input").value.toLowerCase();
    const filtered = state.games.filter(g => g.title.toLowerCase().includes(query));
    renderGames(filtered);
}

// 3. ОТРИСОВКА И ПАГИНАЦИЯ СЕКРЕТОВ
function filterAndRenderSecrets() {
    const query = document.getElementById("search-secret-input").value.toLowerCase();
    
    state.filteredSecrets = state.secrets.filter(sec => 
        sec.game_title.toLowerCase().includes(query) || 
        sec.content.toLowerCase().includes(query)
    );
    
    const totalPages = Math.ceil(state.filteredSecrets.length / state.secretsPerPage) || 1;
    if (state.secretsPage > totalPages) state.secretsPage = totalPages;
    
    const start = (state.secretsPage - 1) * state.secretsPerPage;
    const end = start + state.secretsPerPage;
    const pageSecrets = state.filteredSecrets.slice(start, end);
    
    const container = document.getElementById("secrets-list");
    container.innerHTML = "";
    
    if (pageSecrets.length === 0) {
        container.innerHTML = "<div style='padding:20px; text-align:center;'>Ничего не найдено...</div>";
        document.getElementById("page-info").innerText = `PAGE 1/1`;
        return;
    }
    
    pageSecrets.forEach(sec => {
        const item = document.createElement("div");
        item.className = "secret-item";
        item.style.flexDirection = "column";
        item.style.alignItems = "flex-start";
        
        const badgeClass = `badge-${sec.platform.toLowerCase()}`;
        
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; width:100%; margin-bottom:8px;">
                <strong style="color:#ffcc00;">[${sec.platform}] ${sec.game_title}</strong>
                <span class="badge ${badgeClass}">${sec.type}</span>
            </div>
            <div style="background:#111; border:1px dashed #444; padding:8px; width:100%; font-size:10px; color:#aaa; line-height:1.4;">
                ${sec.content}
            </div>
        `;
        container.appendChild(item);
    });
    
    document.getElementById("page-info").innerText = `PAGE ${state.secretsPage}/${totalPages}`;
}

// 4. СИСТЕМА ЛОКАЛЬНЫХ СОХРАНЕНИЙ И МЕНЮ ЗАПУСКА
function openLaunchModal(game) {
    state.selectedGame = game;
    document.getElementById("launch-game-title").innerText = game.title.toUpperCase();
    
    // Для режима 'keep in browser' мы проверяем, зафиксировал ли сам EmulatorJS данные в IndexedDB.
    // Так как к IndexedDB из JS до загрузки ядра достучаться сложно, оставим базовую проверку флага,
    // либо кнопка "Продолжить" будет активна всегда, если игра запускалась ранее.
    const hasSave = localStorage.getItem(`save_initiated_${game.id}`);
    const continueBtn = document.getElementById("btn-continue-save");
    
    if (hasSave) {
        continueBtn.classList.remove("hidden");
    } else {
        continueBtn.classList.add("hidden");
    }
    
    document.getElementById("launch-modal").classList.remove("hidden");
}

function closeLaunchModal() {
    document.getElementById("launch-modal").classList.add("hidden");
}
      
function launchGame(loadFromSave) {
    closeLaunchModal();
    startEmulator(state.selectedGame, loadFromSave);
}

// 5. ИНИЦИАЛИЗАЦИЯ ЛОКАЛЬНОГО ЭМУЛЯТОРА НАПРЯМУЮ (БЕЗ IFRAME)
function startEmulator(game, loadFromSave) {
    document.getElementById("emulator-layer").classList.remove("hidden");
    const container = document.getElementById("emulator-container");
    container.innerHTML = ""; // Очищаем контейнер

    const emuDiv = document.createElement("div");
    emuDiv.id = "game-player";
    emuDiv.style.width = "100%";
    emuDiv.style.height = "100%";
    container.appendChild(emuDiv);

    const platformMap = {
        'NES': 'nes', 'SNES': 'snes', 'SEGA': 'segaMD', '32X': 'sega32X',
        'SMS': 'segaMS', 'TG16': 'pcEngine', 'GB': 'gb', 'GBC': 'gbc', 'GBA': 'gba', 'ZX': 'zxSpectrum'
    };
    const systemCode = platformMap[game.platform.toUpperCase()] || 'nes';

    // Конфигурация EmulatorJS (версия 4.0.0+)
    window.EJS_player = '#game-player';
    window.EJS_biosUrl = '';
    window.EJS_gameUrl = game.rom_url;
    window.EJS_core = systemCode;
    window.EJS_pathtodata = './'; 
    window.EJS_language = 'ru';

    // НАСТРОЙКИ АВТО-СОХРАНЕНИЙ ПО ТВОЕМУ МЕТОДУ
    window.EJS_DefaultSaveMode = 'browser'; // По умолчанию переводим в IndexedDB ("keep in browser")
    window.EJS_autosave = true;             // Автосейв при закрытии страницы
    window.EJS_ForceLocalSave = true;       // Сохраняем только локально в браузере

    window.EJS_startOnLoaded = true;
    window.EJS_volume = state.isSoundOn ? 1 : 0;

    window.EJS_onGameStart = function() {
        console.log("Игра успешно стартовала напрямую!");
        // Помечаем, что игра запускалась, чтобы кнопка "Продолжить" знала о существовании кэша
        localStorage.setItem(`save_initiated_${game.id}`, "true");
    };

    // Перезапуск скрипта лоадера
    const oldLoader = document.getElementById("emu-loader-script");
    if (oldLoader) oldLoader.remove();

    const script = document.createElement("script");
    script.src = "loader.js";
    script.id = "emu-loader-script";
    document.body.appendChild(script);
}

// ЖЕЛЕЗНАЯ ФУНКЦИЯ СОХРАНЕНИЯ С ВЕРХНЕЙ КНОПКИ
function saveGameState() {
    if (window.EJS_emulator && typeof window.EJS_emulator.quickSave === "function") {
        window.EJS_emulator.quickSave(); // Эмулируем нажатие сохранения самого движка в браузер
        alert("ИГРА УСПЕШНО СОХРАНЕНА! 💾");
        
        if (state.selectedGame) {
            localStorage.setItem(`save_initiated_${state.selectedGame.id}`, "true");
        }
    } else {
        alert("Подожди полной загрузки игры для сохранения...");
    }
}

// УПРАВЛЕНИЕ ЗВУКОМ С ВЕРХНЕЙ КНОПКИ ВНУТРИ ЭМУЛЯТОРА
function toggleEmuSound() {
    state.isSoundOn = !state.isSoundOn;
    const soundBtn = document.getElementById("emu-sound-btn");
    
    if (window.EJS_emulator && typeof window.EJS_emulator.setVolume === "function") {
        window.EJS_emulator.setVolume(state.isSoundOn ? 1 : 0);
        if (soundBtn) soundBtn.innerText = state.isSoundOn ? "🔊 ЗВУК" : "🔇 ЗВУК";
    } else {
        alert("Эмулятор еще загружается...");
    }
}

// КОРРЕКТНОЕ ЗАКРЫТИЕ С ОЧИСТКОЙ ГЛОБАЛЬНОЙ ПАМЯТИ
function closeEmulator() {
    document.getElementById("emulator-layer").classList.add("hidden");
    document.getElementById("emulator-container").innerHTML = "";
    
    if (window.EJS_emulator && typeof window.EJS_emulator.destroy === "function") {
        window.EJS_emulator.destroy();
    }
    
    window.EJS_emulator = null;
    window.EJS_player = null;
}

// 6. ОБРАБОТКА ЗАКАЗА ИГРЫ
function submitOrder() {
    const gameName = document.getElementById("order-game-name").value.trim();
    if (!gameName) {
        alert("ВВЕДИТЕ НАЗВАНИЕ ИГРЫ!");
        return;
    }
    document.getElementById("payment-modal").classList.remove("hidden");
}

function closeModal() {
    document.getElementById("payment-modal").classList.add("hidden");
}

function confirmOrder() {
    closeModal();
    const gameName = document.getElementById("order-game-name").value.trim();
    const platform = document.getElementById("order-platform").value;
    
    const userId = tg.initDataUnsafe?.user?.id || "Локальный тест";
    const username = tg.initDataUnsafe?.user?.username ? `@${tg.initDataUnsafe.user.username}` : "Без никнейма";
    
    const orderData = {
        action: "create_order",
        user_id: userId,
        username: username,
        game_name: gameName,
        platform: platform
    };
    
    fetch(API_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData)
    }).then(() => {
        alert("ЗАЯВКА ОТПРАВЛЕНА!\n\nРеквизиты для оплаты отправлены администратору. Скоро игра появится в списке!");
        document.getElementById("order-game-name").value = "";
    }).catch(err => {
        alert("Ошибка отправки заказа.");
        console.error(err);
    });
}

// 7. СЕРВИСНЫЕ ФУНКЦИИ И НАВИГАЦИЯ
function switchTab(tabName) {
    state.currentTab = tabName;
    
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    document.getElementById(`tab-${tabName}`).classList.remove("hidden");
    
    document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
    
    const targetIndex = tabName === 'games' ? 0 : tabName === 'secrets' ? 1 : 2;
    document.querySelectorAll(".nav-item")[targetIndex].classList.add("active");
}

function setupEventListeners() {
    document.getElementById("search-game-input").addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = state.games.filter(g => g.title.toLowerCase().includes(query));
        renderGames(filtered);
    });

    document.getElementById("search-secret-input").addEventListener("input", () => {
        state.secretsPage = 1;
        filterAndRenderSecrets();
    });

    document.getElementById("prev-page").addEventListener("click", () => {
        if (state.secretsPage > 1) {
            state.secretsPage--;
            filterAndRenderSecrets();
        }
    });
    document.getElementById("next-page").addEventListener("click", () => {
        const totalPages = Math.ceil(state.filteredSecrets.length / state.secretsPerPage);
        if (state.secretsPage < totalPages) {
            state.secretsPage++;
            filterAndRenderSecrets();
        }
    });
}

function toggleGlobalSound() {
    state.isSoundOn = !state.isSoundOn;
    const bgVideo = document.getElementById("bg-video");
    if (bgVideo) bgVideo.muted = !state.isSoundOn;
    document.getElementById("global-sound-btn").innerText = state.isSoundOn ? "🔊 ЗВУК" : "🔇 ЗВУК";
}