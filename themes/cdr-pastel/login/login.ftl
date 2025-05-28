<#-- Extend default login layout -->
<#import "template.ftl" as layout>
<link rel="stylesheet" type="text/css" href="${url.resourcesPath}/css/theme.css">
<@layout.registrationLayout displayInfo=true; section>
    <#if section == "header">
        <h2 style="font-family: 'Courier New', monospace;">Log in to Call Data Records</h2>
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
            <p>Don’t have an account? <a href="http://localhost:8080/signup.html">Sign up</a></p>
        </div>
        <p class="redirect-message" id="redirect-login" style="display: none;"></p>

        <script>
            document.addEventListener('DOMContentLoaded', function () {
                const form = document.getElementById('kc-form-login');
                form.addEventListener('submit', function (e) {
                    const redirectEl = document.getElementById('redirect-login');
                    redirectEl.style.display = 'block';
                    let baseMessage = 'Redirecting to CDRs';
                    let counter = 0;
                    const interval = setInterval(() => {
                        let dots = '.'.repeat(counter % 4);
                        redirectEl.textContent = baseMessage + dots;
                        counter++;
                    }, 300);
                    setTimeout(() => {
                        clearInterval(interval);
                    }, 3000);
                });
            });
        </script>
    </#if>
</@layout.registrationLayout>
