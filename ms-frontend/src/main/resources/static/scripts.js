let keycloak;
let fullData = [];
let pollingInterval;

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Decode a JWT payload so we can extract "preferred_username" after signup.
// (We only need this on the frontend to show "Welcome, X".)
//─────────────────────────────────────────────────────────────────────────────
function parseJwt(token) {
    // Split into header.payload.signature
    const base64Url = token.split('.')[1];
    const base64    = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
        atob(base64)
            .split('')
            .map(c => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            })
            .join('')
    );
    return JSON.parse(jsonPayload);
}

// ─────────────────────────────────────────────────────────────────────────────
// On window.load, we load config.json and then decide: “Is this the signup page?”
//
// If it is the signup form, wire up initSignupForm() as before.
// Otherwise, check localStorage for an existing token. If we find one,
// skip Keycloak’s forced redirect and start polling immediately. If not,
// fall back to initKeycloak() which uses onLoad: 'login-required'.
//─────────────────────────────────────────────────────────────────────────────
window.onload = async function () {
    try {
        // 1) Load config.json exactly as before
        const config = await fetch('config.json').then(r => r.json());
        window.KEYCLOAK_URL = config.KEYCLOAK_URL;
        window.BACKEND_URL  = config.BACKEND_URL;
        console.log('✅ Loaded config:', config);

        // 2) If we are on the signup page (i.e. #signup-form exists), set up signup logic:
        const form = document.getElementById('signup-form');
        if (form) {
            initSignupForm();
            return;
        }

        // 3) Otherwise, we are on “/” (the index.html with CDR table). Check for a stored token:
        const storedToken   = localStorage.getItem('cdr-token');
        const storedRefresh = localStorage.getItem('cdr-refresh');

        if (storedToken) {
            // ─────────────────────────────────────────────────────────────────────────
            // The user has just signed up (or previously logged in). They already have
            // a valid JWT in localStorage. We treat them as authenticated:
            //
            //   • Decode the token payload to get their username.
            //   • Show “Welcome, username” in the UI.
            //   • Store `window.token = storedToken` so our fetch calls can use it.
            //   • Start polling immediately (skip Keycloak redirect).
            //─────────────────────────────────────────────────────────────────────────
            window.token = storedToken; // make it global for fetchAndUpdate

            const parsed   = parseJwt(storedToken);
            const username = parsed.preferred_username || 'User';
            document.getElementById('welcome-message').innerText = `Welcome, ${username}`;

            // Show the live-dot, and begin polling
            startPolling();
            return;
        }

        // 4) If no stored token, we fall back to the normal Keycloak adapter:
        await initKeycloak();
        startPolling(); // after Keycloak init, begin polling
    }
    catch (error) {
        console.error('❌ Failed to load config.json or initialize:', error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// initKeycloak: almost the same as before, except we change `onLoad: 'login-required'`
// to `onLoad: 'login-required'` only if no token is in localStorage. But since
// we already returned early when token exists, we can keep it as-is. After `init()`,
// we store the token in localStorage and set the welcome message.
//─────────────────────────────────────────────────────────────────────────────
async function initKeycloak() {
    const keycloakConfig = {
        url: window.KEYCLOAK_URL,
        realm: 'cdr-realm',
        clientId: 'cdr-frontend'
    };

    keycloak = new Keycloak(keycloakConfig);

    // Force Keycloak login if no SSO session is active:
    await keycloak.init({
        onLoad: 'login-required',
        checkLoginIframe: false
    });

    if (keycloak.authenticated) {
        // 1) Save tokens so that a page refresh can pick them up:
        localStorage.setItem('cdr-token', keycloak.token);
        localStorage.setItem('cdr-refresh', keycloak.refreshToken);

        // 2) Pull out username from tokenParsed:
        const username = keycloak.tokenParsed?.preferred_username || 'User';
        document.getElementById('welcome-message').innerText = `Welcome, ${username}`;

        // 3) Ensure our global window.token is set, so fetchAndUpdate picks it up:
        window.token = keycloak.token;
    } else {
        // (In practice, 'login-required' should redirect to login if not authenticated.)
        console.warn('Keycloak not authenticated—forcing login.');
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
    // Choose the token from keycloak.adapter or fallback to locally stored token
    const token = (keycloak && keycloak.token) ? keycloak.token : window.token;
    const statusEl = document.getElementById('status-message');
    statusEl.innerText = 'Receiving from Kafka...';

    try {
        const response = await fetch(`${window.BACKEND_URL}/api/cdrs`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        fullData = await response.json();
        displayCDRs(fullData);
        generateCharts(fullData);
        updateLastUpdated(); // show “Last updated: …”
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


// ─────────────────────────────────────────────────────────────────────────────
// initSignupForm: only minor addition: we already did localStorage here,
// but removing the extra `window.location.href = '/'` after 2 seconds.
// We just keep it, because the logic below “window.onload” now picks up localStorage.
//─────────────────────────────────────────────────────────────────────────────
function initSignupForm() {
    const form = document.getElementById('signup-form');
    const msg  = document.getElementById('message');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();

        msg.innerText = 'ℹ️ Please wait…';
        msg.className = 'info';

        try {
            const response = await fetch(`${window.BACKEND_URL}/api/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                // 1) backend returns { access_token, refresh_token }
                const tokens = await response.json();
                localStorage.setItem('cdr-token'   , tokens.access_token);
                localStorage.setItem('cdr-refresh' , tokens.refresh_token);

                msg.innerText = '✅ Signup successful!';
                msg.className = 'success';

                // 2) Show a little “redirecting…” animation and then go to “/”
                animateRedirectMessage(
                    'Created user, skipping login, redirecting to CDRs',
                    'redirect-signup'
                );
                setTimeout(() => {
                    // When we land on "/", our window.onload sees localStorage.token and starts polling.
                    window.location.href = '/';
                }, 2000);
            }
            else {
                const result = await response.text();
                msg.innerText = result;
                msg.className = 'error';
            }
        } catch (error) {
            console.error('Signup error:', error);
            msg.innerText = '❌ Signup failed: ' + error.message;
            msg.className = 'error';
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
    // 1) Always remove tokens from localStorage
    localStorage.removeItem('cdr-token');
    localStorage.removeItem('cdr-refresh');

    // 2) Show the “Redirecting to login page…” message immediately
    const msg = document.getElementById('redirect-msg');
    msg.style.display = 'block';

    // 3) After a short delay, either call keycloak.logout (if it exists),
    //    or else just reload “/” so that initKeycloak() runs on the next load.
    setTimeout(() => {
        if (keycloak) {
            // If we previously initialized Keycloak, terminate its session and redirect.
            keycloak.logout({ redirectUri: window.location.origin });
        } else {
            // If keycloak is undefined (we only used localStorage), reload “/”
            // so your onload() sees no token and forces login.
            window.location.href = '/';
        }
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
