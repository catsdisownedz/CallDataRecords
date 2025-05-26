let keycloak;

document.addEventListener('DOMContentLoaded', async function () {
    const form = document.getElementById('signup-form');
    if (form) {
        initSignupForm(); // Only runs if we're on signup page
    } else {
        await initKeycloak(); // Runs if we're on protected pages
        fetchData();
    }
});

async function initKeycloak() {
    keycloak = new Keycloak('/keycloak.json');
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
        const token = keycloak.token;
        await fetchCDRs(token);
        await fetchUsers(token);
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

async function fetchCDRs(token) {
    const response = await fetch('http://localhost:8082/api/cdrs', {
        headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
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

async function fetchUsers(token) {
    const response = await fetch('http://localhost:8082/api/users', {
        headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = data.map(user => `
        <tr style="background-color: ${getRandomPastelColor()}">
            <td>${user.id}</td>
            <td>${user.username}</td>
        </tr>`).join('');
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
            const response = await fetch('http://localhost:8082/api/signup', {
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
