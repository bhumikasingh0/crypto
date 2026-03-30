const cryptoList = document.getElementById('crypto-list');
const currencySelect = document.getElementById('currency-select');
const limitSelect = document.getElementById('limit-select');
const searchInput = document.getElementById('search-input');
const refreshBtn = document.getElementById('refresh-btn');
const toggleRefreshBtn = document.getElementById('toggle-refresh');
const activeCount = document.getElementById('active-count');
const lastUpdated = document.getElementById('last-updated');
const topGainer = document.getElementById('top-gainer');
const topLoser = document.getElementById('top-loser');
const averageChange = document.getElementById('average-change');
const refreshStatus = document.getElementById('refresh-status');
const themeToggleBtn = document.getElementById('theme-toggle');

let allCoins = [];
let currentTheme = 'dark';
let refreshInterval = null;
let autoRefreshEnabled = true;
let countdownValue = 60;
let countdownTimer = null;

function formatCurrency(value) {
    const currencyCode = currencySelect.value.toUpperCase();
    return value.toLocaleString(undefined, {
        style: 'currency',
        currency: currencyCode,
        maximumFractionDigits: 2,
    });
}

function formatCompact(value) {
    return value !== undefined && value !== null
        ? value.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 })
        : '-';
}

function renderLoading() {
    cryptoList.innerHTML = Array.from({ length: 6 }, () => `
        <div class="card skeleton">
            <div class="skeleton-dot"></div>
            <div class="skeleton-line short"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
        </div>
    `).join('');
}

function createCoinCard(coin) {
    const priceChange = coin.price_change_percentage_24h ?? 0;
    const changeClass = priceChange >= 0 ? 'up' : 'down';
    const symbol = coin.symbol.toUpperCase();

    return `
        <div class="card">
            <div class="card-header">
                <img src="${coin.image}" width="44" height="44" alt="${coin.name}">
                <div>
                    <h3>${coin.name}</h3>
                    <p class="symbol">${symbol}</p>
                </div>
            </div>
            <p class="price">${formatCurrency(coin.current_price)}</p>
            <p class="${changeClass}">24h ${priceChange.toFixed(2)}%</p>
            <div class="card-meta">
                <span>Market cap</span>
                <strong>${formatCompact(coin.market_cap)}</strong>
            </div>
            <div class="card-meta">
                <span>24h volume</span>
                <strong>${formatCompact(coin.total_volume)}</strong>
            </div>
        </div>
    `;
}

function getTopMover(coins, direction = 'max') {
    if (!coins.length) return null;
    return coins.reduce((best, coin) => {
        if (!best) return coin;
        const current = coin.price_change_percentage_24h ?? 0;
        const bestValue = best.price_change_percentage_24h ?? 0;
        return direction === 'max'
            ? (current > bestValue ? coin : best)
            : (current < bestValue ? coin : best);
    }, null);
}

function formatChangeLabel(coin) {
    if (!coin) return '—';
    return `${coin.name} (${coin.symbol.toUpperCase()}) ${coin.price_change_percentage_24h.toFixed(2)}%`;
}

function updateSummary(coins) {
    const gainer = getTopMover(coins, 'max');
    const loser = getTopMover(coins, 'min');
    const average = coins.length
        ? coins.reduce((sum, coin) => sum + (coin.price_change_percentage_24h ?? 0), 0) / coins.length
        : 0;

    topGainer.textContent = formatChangeLabel(gainer);
    topLoser.textContent = formatChangeLabel(loser);
    averageChange.textContent = `${average.toFixed(2)}%`;
}

function setLastUpdated(timestamp) {
    const date = new Date(timestamp);
    lastUpdated.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function updateRefreshStatus() {
    refreshStatus.textContent = autoRefreshEnabled ? 'On' : 'Paused';
    toggleRefreshBtn.textContent = autoRefreshEnabled ? 'Pause auto refresh' : 'Resume auto refresh';
}

function setTheme(theme) {
    currentTheme = theme === 'light' ? 'light' : 'dark';
    document.body.classList.toggle('light-theme', currentTheme === 'light');
    themeToggleBtn.textContent = currentTheme === 'light' ? '🌙 Dark mode' : '☀️ Light mode';
    localStorage.setItem('theme', currentTheme);
}

function toggleTheme() {
    setTheme(currentTheme === 'light' ? 'dark' : 'light');
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
}

function updateCards(coins) {
    const query = searchInput.value.trim().toLowerCase();
    const filteredCoins = coins.filter(coin => {
        return coin.name.toLowerCase().includes(query) || coin.symbol.toLowerCase().includes(query);
    });

    activeCount.textContent = filteredCoins.length;

    if (!filteredCoins.length) {
        cryptoList.innerHTML = `<p class="empty-state">No coins found for "${searchInput.value}".</p>`;
        return;
    }

    cryptoList.innerHTML = filteredCoins.map(createCoinCard).join('');
}

async function fetchPrices() {
    renderLoading();

    try {
        const currency = currencySelect.value;
        const perPage = Number(limitSelect.value);
        const apiUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${currency}&order=market_cap_desc&per_page=${perPage}&page=1&sparkline=false`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error('Failed to fetch crypto data');
        }

        const data = await response.json();
        allCoins = data;
        updateSummary(data);
        updateCards(data);
        setLastUpdated(Date.now());

        if (autoRefreshEnabled) {
            scheduleAutoRefresh();
        }
    } catch (error) {
        cryptoList.innerHTML = '<p class="empty-state">Unable to load prices. Please try again later.</p>';
        console.error(error);
    }
}

function scheduleAutoRefresh() {
    if (!autoRefreshEnabled) return;
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    refreshInterval = setInterval(fetchPrices, 60000);
}

function toggleAutoRefresh() {
    autoRefreshEnabled = !autoRefreshEnabled;
    updateRefreshStatus();

    if (autoRefreshEnabled) {
        fetchPrices();
        scheduleAutoRefresh();
    } else if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

refreshBtn.addEventListener('click', fetchPrices);
currencySelect.addEventListener('change', fetchPrices);
limitSelect.addEventListener('change', fetchPrices);
searchInput.addEventListener('input', () => updateCards(allCoins));
toggleRefreshBtn.addEventListener('click', toggleAutoRefresh);
themeToggleBtn.addEventListener('click', toggleTheme);

initTheme();
updateRefreshStatus();
fetchPrices();
scheduleAutoRefresh();
