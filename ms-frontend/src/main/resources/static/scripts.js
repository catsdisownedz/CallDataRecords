let keycloak;
let fullData = [];
let pollingInterval;

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 NEW GLOBAL FLAGS TO TRACK DATA STATE
//    - haveReceivedData: becomes true as soon as we successfully fetch ≥1 CDR.
//    - stopPollingFlag: once true, we will stop further polling.
//─────────────────────────────────────────────────────────────────────────────
let haveReceivedData = false;
let stopPollingFlag   = false;

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Decode a JWT payload so we can extract "preferred_username" after signup.
//─────────────────────────────────────────────────────────────────────────────
function parseJwt(token) {
    const base64Url    = token.split('.')[1];
    const base64       = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload  = decodeURIComponent(
        atob(base64)
            .split('')
            .map(c => ('%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)))
            .join('')
    );
    return JSON.parse(jsonPayload);
}

// ─────────────────────────────────────────────────────────────────────────────
// On window.load, load config.json and decide: “Is this the signup page?” etc.
//─────────────────────────────────────────────────────────────────────────────
window.onload = async function () {
    try {
        // 1) Load config.json
        const config = await fetch('config.json').then(r => r.json());
        window.KEYCLOAK_URL = config.KEYCLOAK_URL;
        window.BACKEND_URL   = config.BACKEND_URL;

        // 2) If #signup-form exists, just init signup
        const form = document.getElementById('signup-form');
        if (form) {
            initSignupForm();
            return;
        }

        // 3) Otherwise (we’re on index.html), check for token
        const storedToken = localStorage.getItem('cdr-token');
        if (storedToken) {
            window.token = storedToken;
            const parsed   = parseJwt(storedToken);
            const username = parsed.preferred_username || 'User';
            document.getElementById('welcome-message').innerText = `Welcome, ${username}`;

            // Show the dot and start polling immediately
            showLiveIndicator(true);
            startPolling();
            return;
        }

        // 4) No token? Fall back to Keycloak
        await initKeycloak();
        showLiveIndicator(true);
        startPolling();

    } catch (error) {
        console.error('❌ Failed to load config.json or initialize:', error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// initKeycloak: as before, but calls showLiveIndicator(true) & startPolling() once authenticated.
//─────────────────────────────────────────────────────────────────────────────
async function initKeycloak() {
    const keycloakConfig = {
        url:    window.KEYCLOAK_URL,
        realm:  'cdr-realm',
        clientId: 'cdr-frontend'
    };
    keycloak = new Keycloak(keycloakConfig);

    await keycloak.init({
        onLoad: 'login-required',
        checkLoginIframe: false
    });

    if (keycloak.authenticated) {
        localStorage.setItem('cdr-token', keycloak.token);
        localStorage.setItem('cdr-refresh', keycloak.refreshToken);

        const username = keycloak.tokenParsed?.preferred_username || 'User';
        document.getElementById('welcome-message').innerText = `Welcome, ${username}`;
        window.token = keycloak.token;

        showLiveIndicator(true);
        startPolling();
    } else {
        keycloak.login();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 Updated startPolling(): checks stopPollingFlag before scheduling.
//─────────────────────────────────────────────────────────────────────────────
function startPolling() {
    if (stopPollingFlag) return;

    fetchAndUpdate();
    pollingInterval = setInterval(() => {
        if (!stopPollingFlag) {
            fetchAndUpdate();
        } else {
            clearInterval(pollingInterval);
        }
    }, 5000);
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 UPDATED fetchAndUpdate():
//    • While `haveReceivedData===false`, do NOT overwrite “building” message.
//    • As soon as `data.length > 0`, set `haveReceivedData=true` and render normally.
//    • When `data.length===0 && haveReceivedData===true`, stop polling forever.
//─────────────────────────────────────────────────────────────────────────────
async function fetchAndUpdate() {
    if (stopPollingFlag) return;  // Already decided to stop—do nothing.

    const statusEl = document.getElementById('status-message');
    const dotEl    = document.getElementById('live-dot');

    // ─────────── CASE: We haven’t received any real data yet ───────────
    if (!haveReceivedData) {
        // Make sure the dot is visible and show “building” message
        dotEl.style.display = 'inline-block';
        statusEl.innerText = 'Application is still building, please wait...';

        // Still attempt to fetch in the background to detect first data arrival:
        try {
            const response = await fetch(`${window.BACKEND_URL}/api/cdrs`, {
                headers: { Authorization: `Bearer ${window.token}` }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            fullData = data;

            // If we finally got data > 0, switch to normal (haveReceivedData=true)
            if (Array.isArray(data) && data.length > 0) {
                haveReceivedData = true;
                // Immediately render the first batch of data:
                displayCDRs(data);
                generateCharts(data);
                updateLastUpdated();
                // Clear “building” message after a moment, but keep the dot
                setTimeout(() => { statusEl.innerText = ''; }, 2000);
            }
            // If still [], keep showing the building message next time
        } catch (err) {
            console.error('❌ Error fetching CDRs while building:', err);
            // Leave “building” message up and keep dot on—retry on next interval
        }

        return; // Do not proceed further in this function.
    }

    // ─────────── CASE: We already have received data at least once ───────────
    // Now we switch to “Receiving from database…” before each new poll.
    dotEl.style.display = 'inline-block';
    statusEl.innerText  = 'Receiving from database…';

    try {
        const response = await fetch(`${window.BACKEND_URL}/api/cdrs`, {
            headers: { Authorization: `Bearer ${window.token}` }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        fullData = data;

        // ─────────── CASE: After having data, now get an empty array => STOP ───────────
        if (Array.isArray(data) && data.length === 0) {
            statusEl.innerText = '✅ All CDRs received. Stopping updates.';
            stopPollingFlag = true;
            // Hide the dot after a short delay so user sees the final message
            setTimeout(() => {
                dotEl.style.display = 'none';
            }, 2000);
            return;
        }

        // ─────────── CASE: Normal: data.length > 0 ───────────
        displayCDRs(data);
        generateCharts(data);
        updateLastUpdated();

        // Clear the “Receiving from database…” message after 2s,
        // but keep the dot on until we explicitly stop.
        setTimeout(() => {
            statusEl.innerText = '';
        }, 2000);

    } catch (error) {
        console.error('❌ Error fetching CDRs:', error);

        // If we’ve seen data before, this is a real fetch error:
        statusEl.innerText = '❌ Failed to fetch data!';
        dotEl.style.display = 'none';
        setTimeout(() => {
            statusEl.innerText = '';
        }, 3000);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Show timestamp of last update (unchanged)
//─────────────────────────────────────────────────────────────────────────────
function updateLastUpdated() {
    const now = new Date();
    document.getElementById('last-updated').innerText =
        `Last updated: ${now.toLocaleTimeString()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Show or hide pulsing dot
//─────────────────────────────────────────────────────────────────────────────
function showLiveIndicator(show) {
    const dot = document.getElementById('live-dot');
    dot.style.display = show ? 'inline-block' : 'none';
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE displayCDRs(): newest record on top + fade-in animation
//─────────────────────────────────────────────────────────────────────────────
function displayCDRs(data, options = {}) {
    const tbody   = document.getElementById('cdrs-table-body');
    const thead   = document.getElementById('table-head');
    const infoMsg = document.getElementById('info-message');

    infoMsg.style.display = 'none';

    // Handle any “bnum”‐sorting message if requested
    let filteredData = [...data];
    if (options.sort === 'bnum') {
        const allDataNull = filteredData
            .filter(cdr => cdr.serviceType.toLowerCase() === 'data')
            .every(cdr => !cdr.bnum || cdr.bnum === 'null');
        if (allDataNull) {
            filteredData = filteredData.filter(cdr => cdr.serviceType.toLowerCase() !== 'data');
            showTemporaryMessage("DATA removed because all its bnum are null.");
        }
    }

    // Reverse so newest (last in JSON) appears first
    filteredData = filteredData.reverse();

    if(!stopPollingFlag){
        // Re‐build <thead> depending on serviceType filter
        if (options.serviceType === 'data') {
            thead.innerHTML = `
            <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Service Type</th>
                <th>Usage</th>
                <th>Start Date-Time</th>
            </tr>`;
            tbody.innerHTML = '';
            filteredData
                .filter(cdr => cdr.serviceType.toLowerCase() === 'data')
                .forEach(cdr => {
                    const tr = document.createElement('tr');
                    tr.classList.add('new-row'); // fade-in animation
                    tr.style.backgroundColor = getRandomPastelColor();
                    tr.innerHTML = `
                    <td>${cdr.id}</td>
                    <td>${cdr.anum}</td>
                    <td>${cdr.serviceType}</td>
                    <td>${cdr.usage}</td>
                    <td>${cdr.startDateTime}</td>`;
                    tbody.appendChild(tr);
                    // Remove animation class after 0.5s (one cycle) to avoid re-trigger
                    setTimeout(() => { tr.classList.remove('new-row'); }, 500);
                });
        } else {
            thead.innerHTML = `
            <tr>
                <th>ID</th>
                <th>ANUM</th>
                <th>BNUM</th>
                <th>Service Type</th>
                <th>Usage</th>
                <th>Start Date-Time</th>
            </tr>`;
            tbody.innerHTML = '';
            filteredData.forEach(cdr => {
                const tr = document.createElement('tr');
                tr.classList.add('new-row');
                tr.style.backgroundColor = getRandomPastelColor();
                tr.innerHTML = `
                <td>${cdr.id}</td>
                <td>${cdr.anum}</td>
                <td>${cdr.bnum}</td>
                <td>${cdr.serviceType}</td>
                <td>${cdr.usage}</td>
                <td>${cdr.startDateTime}</td>`;
                tbody.appendChild(tr);
                setTimeout(() => { tr.classList.remove('new-row'); }, 500);
            });
        }
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

    // Update or create the “Total Service Type Distribution” doughnut
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

    // Update/create each individual pie chart
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
// initSignupForm(): unchanged from before
//─────────────────────────────────────────────────────────────────────────────
function initSignupForm() {
    const form       = document.getElementById("signup-form");
    const msgEl      = document.getElementById("message");
    const redirectEl = document.getElementById("redirect-signup");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value.trim();

        msgEl.innerText = "ℹ️ Please wait...";
        msgEl.className = "info";

        try {
            const response = await fetch(`${window.BACKEND_URL}/api/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                const tokens = await response.json();
                localStorage.setItem("cdr-token", tokens.access_token);
                localStorage.setItem("cdr-refresh", tokens.refresh_token);

                msgEl.innerText = "✅ Signup successful!";
                msgEl.className = "success";

                redirectEl.style.display = "block";
                let dots = "";
                const interval = setInterval(() => {
                    dots = dots.length < 3 ? dots + "." : "";
                    redirectEl.textContent = "Redirecting to CDRs" + dots;
                }, 300);

                setTimeout(() => {
                    clearInterval(interval);
                    window.location.href = "/";
                }, 3000);
            } else {
                const errorText = await response.text();
                msgEl.innerText = errorText;
                msgEl.className = "error";
            }
        } catch (err) {
            console.error("Signup error:", err);
            msgEl.innerText = "❌ Signup failed: " + err.message;
            msgEl.className = "error";
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
    localStorage.removeItem('cdr-token');
    localStorage.removeItem('cdr-refresh');

    const msg = document.getElementById('redirect-msg');
    msg.style.display = 'block';

    setTimeout(() => {
        if (keycloak) {
            keycloak.logout({ redirectUri: window.location.origin });
        } else {
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
    const by          = document.getElementById('filter-by').value;
    const serviceType = document.getElementById('service-type-filter').value;
    const dateFilter  = document.getElementById('date-selector').value;

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
