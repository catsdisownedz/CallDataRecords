let keycloak;
let fullData = [];
let pollingInterval;

window.onload = async function () {
    try {
        const config = await fetch('config.json').then(r => r.json());
        window.KEYCLOAK_URL = config.KEYCLOAK_URL;
        window.BACKEND_URL = config.BACKEND_URL;

        console.log('✅ Loaded config:', config);

        const form = document.getElementById('signup-form');
        if (form) {
            initSignupForm();
        } else {
            await initKeycloak();
            startPolling(); // 🆕 Start live polling after auth
        }
    } catch (error) {
        console.error('❌ Failed to load config.json', error);
    }
};

async function initKeycloak() {
    const keycloakConfig = {
        url: window.KEYCLOAK_URL,
        realm: 'cdr-realm',
        clientId: 'cdr-frontend'
    };

    keycloak = new Keycloak(keycloakConfig);

    await keycloak.init({
        onLoad: 'login-required',
        checkLoginIframe: false
    });

    if (keycloak.authenticated) {
        localStorage.setItem("cdr-token", keycloak.token);
        const username = keycloak.tokenParsed?.preferred_username || "User";
        document.getElementById('welcome-message').innerText = `Welcome, ${username}`;
    } else {
        keycloak.login();
    }
}

// 🆕 Start polling data from backend every 5 seconds
function startPolling() {
    showLiveIndicator(true);
    fetchAndUpdate();
    pollingInterval = setInterval(fetchAndUpdate, 5000);
}

// 🆕 Fetch latest CDRs and update UI
async function fetchAndUpdate() {
    const token = keycloak.token;
    const statusEl = document.getElementById('status-message');
    statusEl.innerText = 'Receiving from Kafka...';

    try {
        const response = await fetch(`${window.BACKEND_URL}/api/cdrs`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        fullData = await response.json();
        displayCDRs(fullData);
        generateCharts(fullData);
        updateLastUpdated(); // 🆕
        statusEl.innerText = '';
    } catch (error) {
        console.error('❌ Error fetching CDRs:', error);
        statusEl.innerText = '❌ Failed to fetch data!';
    }
}

// 🆕 Show timestamp of last update
function updateLastUpdated() {
    const now = new Date();
    document.getElementById('last-updated').innerText = `Last updated: ${now.toLocaleTimeString()}`;
}

// 🆕 Show or hide pulsing dot
function showLiveIndicator(show) {
    const dot = document.getElementById('live-dot');
    dot.style.display = show ? 'inline-block' : 'none';
}

function displayCDRs(data, options = {}) {
    const tbody = document.getElementById('cdrs-table-body');
    const thead = document.getElementById('table-head');
    const infoMsg = document.getElementById('info-message');
    let filteredData = [...data];

    infoMsg.style.display = 'none';

    if (options.sort === 'bnum') {
        const allDataNull = filteredData.filter(cdr => cdr.serviceType.toLowerCase() === 'data')
            .every(cdr => !cdr.bnum || cdr.bnum === 'null');
        if (allDataNull) {
            filteredData = filteredData.filter(cdr => cdr.serviceType.toLowerCase() !== 'data');
            showTemporaryMessage("DATA removed because all its bnum are null.");
        }
    }

    if (options.serviceType === 'data') {
        thead.innerHTML = `<tr><th>ID</th><th>Customer</th><th>Service Type</th><th>Usage</th><th>Start Date-Time</th></tr>`;
        tbody.innerHTML = filteredData
            .filter(cdr => cdr.serviceType.toLowerCase() === 'data')
            .map(cdr => `
                <tr style="background-color: ${getRandomPastelColor()}">
                    <td>${cdr.id}</td>
                    <td>${cdr.anum}</td>
                    <td>${cdr.serviceType}</td>
                    <td>${cdr.usage}</td>
                    <td>${cdr.startDateTime}</td>
                </tr>`).join('');
    } else {
        thead.innerHTML = `<tr><th>ID</th><th>ANUM</th><th>BNUM</th><th>Service Type</th><th>Usage</th><th>Start Date-Time</th></tr>`;
        tbody.innerHTML = filteredData.map(cdr => `
            <tr style="background-color: ${getRandomPastelColor()}">
                <td>${cdr.id}</td>
                <td>${cdr.anum}</td>
                <td>${cdr.bnum}</td>
                <td>${cdr.serviceType}</td>
                <td>${cdr.usage}</td>
                <td>${cdr.startDateTime}</td>
            </tr>`).join('');
    }
}

let chartInstances = {};

function generateCharts(data) {
    const counts = { call: 0, sms: 0, data: 0 };
    data.forEach(cdr => {
        const type = cdr.serviceType.toLowerCase();
        if (counts[type] !== undefined) counts[type]++;
    });

    const total = counts.call + counts.sms + counts.data;

    const doughnutData = [counts.call, counts.sms, counts.data];
    const pieData = {
        call: [counts.call, total - counts.call],
        sms: [counts.sms, total - counts.sms],
        data: [counts.data, total - counts.data]
    };

    // Update or create mostUsedChart
    if (chartInstances['mostUsedChart']) {
        chartInstances['mostUsedChart'].data.datasets[0].data = doughnutData;
        chartInstances['mostUsedChart'].update();
    } else {
        chartInstances['mostUsedChart'] = new Chart(document.getElementById('mostUsedChart'), {
            type: 'doughnut',
            data: {
                labels: ['Call', 'SMS', 'Data'],
                datasets: [{
                    data: doughnutData,
                    backgroundColor: ['#ffc0cb', '#dda0dd', '#87ceeb'],
                }]
            },
            options: { plugins: { title: { display: true, text: 'Total Service Type Distribution' } } }
        });
    }

    // Update or create individual pie charts
    ['call', 'sms', 'data'].forEach(type => {
        if (chartInstances[`${type}Chart`]) {
            chartInstances[`${type}Chart`].data.datasets[0].data = pieData[type];
            chartInstances[`${type}Chart`].update();
        } else {
            chartInstances[`${type}Chart`] = new Chart(document.getElementById(`${type}Chart`), {
                type: 'pie',
                data: {
                    labels: [type.toUpperCase(), 'Other'],
                    datasets: [{
                        data: pieData[type],
                        backgroundColor: ['#ee92c3', '#f0f0f0']
                    }]
                },
                options: { plugins: { title: { display: true, text: `${type.toUpperCase()} Volume` } } }
            });
        }
    });

    // Update info text
    document.getElementById('mostUsedInfo').innerText =
        `Call: ${counts.call} (${((counts.call / total) * 100 || 0).toFixed(1)}%) | ` +
        `SMS: ${counts.sms} (${((counts.sms / total) * 100 || 0).toFixed(1)}%) | ` +
        `Data: ${counts.data} (${((counts.data / total) * 100 || 0).toFixed(1)}%)`;

    document.getElementById('callInfo').innerText =
        `CALL: ${counts.call} (${((counts.call / total) * 100 || 0).toFixed(1)}%)`;

    document.getElementById('smsInfo').innerText =
        `SMS: ${counts.sms} (${((counts.sms / total) * 100 || 0).toFixed(1)}%)`;

    document.getElementById('dataInfo').innerText =
        `DATA: ${counts.data} (${((counts.data / total) * 100 || 0).toFixed(1)}%)`;
}


function getRandomPastelColor() {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    return `rgba(${r}, ${g}, ${b}, 0.3)`;
}

function showTemporaryMessage(text) {
    const messageEl = document.getElementById('info-message');
    messageEl.innerText = text;
    messageEl.style.display = 'block';
    messageEl.style.color = '#d12c7f';
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 10000);
}

function initSignupForm() {
    const form = document.getElementById('signup-form');
    const msg = document.getElementById('message');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();

        msg.innerText = "ℹ️ Please wait...";
        msg.className = "info";

        try {
            const response = await fetch(`${window.BACKEND_URL}/api/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const tokens = await response.json();
                localStorage.setItem("cdr-token", tokens.access_token);
                localStorage.setItem("cdr-refresh", tokens.refresh_token);
                msg.innerText = "✅ Signup successful!";
                msg.className = "success";
                animateRedirectMessage("Created user, skipping login, redirecting to CDRs", "redirect-signup");
                setTimeout(() => {
                    window.location.href = "/";
                }, 2000);
            } else {
                const result = await response.text();
                msg.innerText = result;
                msg.className = "error";
            }
        } catch (error) {
            console.error('Signup error:', error);
            msg.innerText = "❌ Signup failed: " + error.message;
            msg.className = "error";
        }
    });
}

function animateRedirectMessage(message, elementId) {
    const el = document.getElementById(elementId);
    el.style.display = 'block';
    let baseMessage = message;
    let counter = 0;
    const interval = setInterval(() => {
        let dots = '.'.repeat(counter % 4);
        el.textContent = `${baseMessage}${dots}`;
        counter++;
    }, 300);

    setTimeout(() => {
        clearInterval(interval);
        window.location.href = "/";
    }, 3000);
}

document.getElementById('logout-btn').onclick = () => {
    const msg = document.getElementById('redirect-msg');
    msg.style.display = 'block';
    setTimeout(() => {
        keycloak.logout({ redirectUri: window.location.origin });
    }, 2000);
};

document.getElementById('filter-by').onchange = function () {
    const serviceDropdown = document.getElementById('service-type-filter');
    if (this.value === 'service') {
        serviceDropdown.style.display = 'inline';
    } else {
        serviceDropdown.style.display = 'none';
    }
};

async function applyFilter() {
    let data = [...fullData];
    const by = document.getElementById('filter-by').value;
    const serviceType = document.getElementById('service-type-filter').value;
    const dateFilter = document.getElementById('date-selector').value;

    if (dateFilter === 'today') {
        const today = new Date().toISOString().slice(0, 10);
        data = data.filter(cdr => cdr.startDateTime.startsWith(today));
    }
    generateCharts(data);

    if (by === 'id') {
        data.sort((a, b) => a.id - b.id);
    } else if (by === 'anum') {
        data.sort((a, b) => a.anum.localeCompare(b.anum));
    } else if (by === 'bnum') {
        data.sort((a, b) => a.bnum?.localeCompare(b.bnum));
    } else if (by === 'usage') {
        data.sort((a, b) => b.usage - a.usage);
    } else if (by === 'service') {
        displayCDRs(data, { serviceType });
        return;
    }
    displayCDRs(data, { sort: by });
}
