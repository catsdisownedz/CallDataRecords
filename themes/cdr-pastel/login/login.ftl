<#-- Extend default login layout -->
<#import "template.ftl" as layout>

<!-- Google Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400..700&family=WDXL+Lubrifont+TC&display=swap" rel="stylesheet">

<!-- Your theme CSS -->
<link rel="stylesheet" type="text/css" href="${url.resourcesPath}/css/theme.css">

<@layout.registrationLayout displayInfo=true; section>
    <#if section == "header">
        <!-- Centered title -->
        <div class="kc-login-title-container">
            <h2 class="kc-login-title">Log in to Call Data Records</h2>
        </div>

    <#elseif section == "form">
        <form id="kc-form-login" class="kc-form-login" action="${url.loginAction}" method="post">
            <div class="kc-form-group">
                <input type="text" id="username" name="username" placeholder="Username" class="input-field" autofocus autocomplete="username"/>
            </div>
            <div class="kc-form-group">
                <input type="password" id="password" name="password" placeholder="Password" class="input-field" autocomplete="current-password"/>
            </div>
            <div class="kc-form-group">
                <input type="submit" id="kc-login" class="login-button" value="Login"/>
            </div>
        </form>

        <#if message?has_content>
            <div class="message ${message.type}">${message.summary}</div>
        </#if>

        <div class="signup-link">
            <p>Don’t have an account? <a href="/signup.html">Sign up</a></p>
        </div>

        <p class="redirect-message" id="redirect-login" style="display: none;"></p>

        <script>
            document.addEventListener('DOMContentLoaded', () => {
                document.getElementById('kc-form-login').addEventListener('submit', () => {
                    const redirectEl = document.getElementById('redirect-login');
                    redirectEl.style.display = 'block';
                    let dots = '';
                    const interval = setInterval(() => {
                        dots = dots.length < 3 ? dots + '.' : '';
                        redirectEl.textContent = 'Redirecting to CDRs' + dots;
                    }, 300);
                    setTimeout(() => clearInterval(interval), 3000);
                });
            });
        </script>
    </#if>
</@layout.registrationLayout>
