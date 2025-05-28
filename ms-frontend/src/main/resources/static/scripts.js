let keycloak;

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
    } else {
        keycloak.login();
    }
}

async function fetchData() {
    try {
        await loadCDRs();  // No filters, full load
    } catch (error) {
        console.error('Error fetching data:', error);
    }
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
    const data = await response.json();

    displayCDRs(data);
    generateCharts(data);
}

function displayCDRs(data) {
    const tbody = document.getElementById('cdrs-table-body');
    tbody.innerHTML = data.map(cdr => `
        <tr style="background-color: ${getRandomPastelColor()}">
            <td>${cdr.id}</td>
            <td>${cdr.anum}</td>
            <td>${cdr.bnum}</td>
            <td>${cdr.serviceType}</td>
            <td>${cdr.usage}</td>
            <td>${cdr.startDateTime}</td>
        </tr>`).join('');
}

function generateCharts(data) {
    const counts = { call: 0, sms: 0, data: 0 };
    data.forEach(cdr => {
        const type = cdr.serviceType.toLowerCase();
        if (counts[type] !== undefined) counts[type]++;
    });

    const total = counts.call + counts.sms + counts.data;

    // Clear existing chart info
    ['mostUsedInfo', 'callInfo', 'smsInfo', 'dataInfo'].forEach(id => {
        document.getElementById(id).innerHTML = '';
    });

    // Total distribution chart
    new Chart(document.getElementById('mostUsedChart'), {
        type: 'doughnut',
        data: {
            labels: ['Call', 'SMS', 'Data'],
            datasets: [{
                data: [counts.call, counts.sms, counts.data],
                backgroundColor: ['#ffc0cb', '#dda0dd', '#87ceeb'],
            }]
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: 'Total Service Type Distribution'
                }
            }
        }
    });

    // Show percentages and counts below
    document.getElementById('mostUsedInfo').innerText =
        `Call: ${counts.call} (${((counts.call / total) * 100 || 0).toFixed(1)}%) | ` +
        `SMS: ${counts.sms} (${((counts.sms / total) * 100 || 0).toFixed(1)}%) | ` +
        `Data: ${counts.data} (${((counts.data / total) * 100 || 0).toFixed(1)}%)`;

    // Individual charts + info
    ['call', 'sms', 'data'].forEach(type => {
        new Chart(document.getElementById(`${type}Chart`), {
            type: 'pie',
            data: {
                labels: [type.toUpperCase(), 'Other'],
                datasets: [{
                    data: [counts[type], total - counts[type]],
                    backgroundColor: ['#ee92c3', '#f0f0f0']
                }]
            },
            options: {
                plugins: {
                    title: {
                        display: true,
                        text: `${type.toUpperCase()} Volume`
                    }
                }
            }
        });

        document.getElementById(`${type}Info`).innerText =
            `${type.toUpperCase()}: ${counts[type]} (${((counts[type] / total) * 100 || 0).toFixed(1)}%)`;
    });
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
    const by = document.getElementById('filter-by').value;
    const serviceType = document.getElementById('service-type-filter').value;

    // Always clear and apply only the current selection
    if (by === 'anum' || by === 'bnum' || by === 'usage') {
        await loadFilteredCDRs({ sort: by });
    } else if (by === 'service') {
        await loadFilteredCDRs({ serviceType });
    } else {
        await loadCDRs();
    }
}
