let keycloak;
let fullData = [];

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
            fetchData();
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

async function fetchData() {
    const token = keycloak.token;
    const response = await fetch(`${window.BACKEND_URL}/api/cdrs`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    fullData = await response.json();
    displayCDRs(fullData);
    generateCharts(fullData);
}

// ✨ FULL no-filter load
async function loadCDRs() {
    const token = keycloak.token;
    const response = await fetch(`${window.BACKEND_URL}/api/cdrs`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();

    displayCDRs(data);
    generateCharts(data);
}

// ✨ FILTERED load
async function loadFilteredCDRs({ sort = null, serviceType = null } = {}) {
    const url = new URL(`${window.BACKEND_URL}/api/cdrs/filtered`);
    if (sort) url.searchParams.append('sort', sort);
    if (serviceType) url.searchParams.append('serviceType', serviceType);

    const token = keycloak.token;
    const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` }
    });
    let data = await response.json();

    const messageEl = document.getElementById('info-message');
    messageEl.style.display = 'none';

    if (sort === 'bnum') {
        const hasOnlyNullData = data.filter(cdr => cdr.serviceType === 'DATA').every(cdr => cdr.bnum === null || cdr.bnum === 'null');
        if (hasOnlyNullData) {
            data = data.filter(cdr => cdr.serviceType !== 'DATA');
            showTemporaryMessage("DATA removed because all its BNUM are null.");
        }
    }

    displayCDRs(data, serviceType);
    generateCharts(data);
}

function showTemporaryMessage(text) {
    const messageEl = document.getElementById('info-message');
    messageEl.innerText = text;
    messageEl.style.display = 'block';
    messageEl.style.color = '#d12c7f'; // dark pink
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 10000);
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

    if (chartInstances['mostUsedChart']) {
        chartInstances['mostUsedChart'].data.datasets[0].data = [counts.call, counts.sms, counts.data];
        chartInstances['mostUsedChart'].update();
    } else {
        chartInstances['mostUsedChart'] = new Chart(document.getElementById('mostUsedChart'), {
            type: 'doughnut',
            data: {
                labels: ['Call', 'SMS', 'Data'],
                datasets: [{
                    data: [counts.call, counts.sms, counts.data],
                    backgroundColor: ['#ffc0cb', '#dda0dd', '#87ceeb'],
                }]
            },
            options: { plugins: { title: { display: true, text: 'Total Service Type Distribution' } } }
        });
    }

    ['call', 'sms', 'data'].forEach(type => {
        if (chartInstances[`${type}Chart`]) {
            chartInstances[`${type}Chart`].data.datasets[0].data = [counts[type], total - counts[type]];
            chartInstances[`${type}Chart`].update();
        } else {
            chartInstances[`${type}Chart`] = new Chart(document.getElementById(`${type}Chart`), {
                type: 'pie',
                data: {
                    labels: [type.toUpperCase(), 'Other'],
                    datasets: [{
                        data: [counts[type], total - counts[type]],
                        backgroundColor: ['#ee92c3', '#f0f0f0']
                    }]
                },
                options: { plugins: { title: { display: true, text: `${type.toUpperCase()} Volume` } } }
            });
        }
    });

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

    // Apply date filter first, update charts
    if (dateFilter === 'today') {
        const today = new Date().toISOString().slice(0, 10);
        data = data.filter(cdr => cdr.startDateTime.startsWith(today));
    }
    generateCharts(data);

    // Apply table filters without changing charts
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
