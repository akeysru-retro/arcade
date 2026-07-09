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

// 2. ОТРИСОВКА СПИСКА ИГР
function renderGames(gamesList) {
    const container = document.getElementById("games-list");
    container.innerHTML = "";
    
    if (gamesList.length === 0) {
        container.innerHTML = "<div style='padding:20px; text-align:center;'>Игры не найдены...</div>";
        return;
    }
    
    gamesList.forEach(game => {
        const item = document.createElement("div");
        item.className = "game-item";
        item.onclick = () => openLaunchModal(game);
        
        // Превращаем код платформы в CSS класс для цвета плашки
        const badgeClass = `badge-${game.platform.toLowerCase()}`;
        
        item.innerHTML = `
            <span>${game.title}</span>
            <span class="badge ${badgeClass}">${game.platform}</span>
        `;
        container.appendChild(item);
    });
}

// 3. ОТРИСОВКА И ПАГИНАЦИЯ СЕКРЕТОВ
function filterAndRenderSecrets() {
    const query = document.getElementById("search-secret-input").value.toLowerCase();
    
    // Фильтруем секреты по поисковому запросу (по названию игры или тексту чита)
    state.filteredSecrets = state.secrets.filter(sec => 
        sec.game_title.toLowerCase().includes(query) || 
        sec.content.toLowerCase().includes(query)
    );
    
    const totalPages = Math.ceil(state.filteredSecrets.length / state.secretsPerPage) || 1;
    if (state.secretsPage > totalPages) state.secretsPage = totalPages;
    
    // Пагинация (вырезаем нужный кусок массива)
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
    
    // Проверяем, есть ли сохранение для этой игры в LocalStorage устройства
    const hasSave = localStorage.getItem(`save_${game.id}`);
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
    
    // Показываем полноэкранный слой интро со вставкой картриджа
    const introLayer = document.getElementById("intro-layer");
    const introVideo = document.getElementById("intro-video");
    
    // Динамически выбираем видео под платформу (например, assets/intro/sega.mp4)
    introVideo.src = `assets/intro/${state.selectedGame.platform.toLowerCase()}.mp4`;
    introVideo.muted = !state.isSoundOn;
    
    introLayer.classList.remove("hidden");
    introVideo.play();
    
    // Когда интро-ролик закончился, запускаем эмулятор
    introVideo.onended = () => {
        introLayer.classList.add("hidden");
        startEmulator(state.selectedGame, loadFromSave);
    };
}

// 5. ИНИЦИАЛИЗАЦИЯ И РАБОТА ЭМУЛЯТОРА
function startEmulator(game, loadFromSave) {
    document.getElementById("emulator-layer").classList.remove("hidden");
    const container = document.getElementById("emulator-container");
    
    // Тут будет интеграция с EmulatorJS. Пока создаем симуляцию игрового окна.
    container.innerHTML = `
        <div style="width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; background:#002200;">
            <p style="color:#00ff00; margin-bottom:10px;">ЗАПУЩЕН ЭМУЛЯТОР ${game.platform}</p>
            <p style="font-size:10px; color:#fff;">ИГРА: ${game.title}</p>
            <p style="font-size:8px; color:#888; margin-top:20px;">
                ${loadFromSave ? "Загружено последнее сохранение с устройства" : "Начата новая игра"}
            </p>
        </div>
    `;
    
    // Если EmulatorJS инициализирован, мы передаем ему game.rom_url
    // И если loadFromSave === true, скармливаем ему строку из localStorage.getItem(`save_${game.id}`)
}

function saveGameState() {
    if (!state.selectedGame) return;
    
    // Симуляция получения слепка данных (State Save) от EmulatorJS
    const dummySaveData = `bytes_array_data_for_${state.selectedGame.id}_timestamp_${Date.now()}`;
    
    // Мгновенно сохраняем на устройство юзера
    localStorage.setItem(`save_${state.selectedGame.id}`, dummySaveData);
    
    alert("ИГРА УСПЕШНО СОХРАНЕНА НА УСТРОЙСТВО!");
}

function closeEmulator() {
    document.getElementById("emulator-layer").classList.add("hidden");
    document.getElementById("emulator-container").innerHTML = "";
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
    
    // Вытаскиваем данные юзера из Telegram
    const userId = tg.initDataUnsafe?.user?.id || "Локальный тест";
    const username = tg.initDataUnsafe?.user?.username ? `@${tg.initDataUnsafe.user.username}` : "Без никнейма";
    
    const orderData = {
        action: "create_order",
        user_id: userId,
        username: username,
        game_name: gameName,
        platform: platform
    };
    
    // Отправляем данные на наш Google бэкенд
    fetch(API_URL, {
        method: "POST",
        mode: "no-cors", // Предотвращает ошибки CORS при отправке в GAS
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
    
    // Переключаем активные вкладки в CSS
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    document.getElementById(`tab-${tabName}`).classList.remove("hidden");
    
    // Переключаем подсветку кнопок в меню навигации
    document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
    
    const targetIndex = tabName === 'games' ? 0 : tabName === 'secrets' ? 1 : 2;
    document.querySelectorAll(".nav-item")[targetIndex].classList.add("active");
}

function setupEventListeners() {
    // Живой поиск игр
    document.getElementById("search-game-input").addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = state.games.filter(g => g.title.toLowerCase().includes(query));
        renderGames(filtered);
    });

    // Живой поиск секретов
    document.getElementById("search-secret-input").addEventListener("input", () => {
        state.secretsPage = 1;
        filterAndRenderSecrets();
    });

    // Кнопки пагинации секретов
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
    bgVideo.muted = !state.isSoundOn;
    document.getElementById("global-sound-btn").innerText = state.isSoundOn ? "🔊 ЗВУК" : "🔇 ЗВУК";
}

function toggleEmuSound() {
    // Тут будет переключение звука внутри EmulatorJS
    alert("Звук в эмуляторе изменен!");
}