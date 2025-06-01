#!/usr/bin/env bash
# ----------------------------------------------------------------------
# Interactive script to:
#   1) Check/install prerequisites (Docker, kubectl, Minikube on Windows)
#   2) Start Minikube with the Docker driver (Windows minikube.exe via cmd.exe)
#   3) Mount ./data to /mnt/data in Minikube (WSL-aware, using forward slashes)
#   4) Start 'minikube tunnel' (Windows minikube.exe via cmd.exe)
#   5) Apply all manifests in k8s/
#   6) Open the UI at http://localhost
#   7) Offer an option to tear down: stop, delete cluster, kill mount/tunnel
#
# This version explicitly handles WSL by calling Windows-installed minikube
# and kubectl via cmd.exe and polls for the mount to become available.
# The crucial change: the Windows host path is output as C:/Users/.../data
# (forward‐slashes) with no extra quoting around the colon suffix.
# ----------------------------------------------------------------------

set -euo pipefail
IFS=$'\n\t'

# ------------------------------ Color Helpers -------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# -------------------------- Detect WSL vs. Native Linux ----------------------
OS_TYPE="$(uname -s)"
if [[ "${OS_TYPE}" == "Linux" ]] && grep -qi microsoft /proc/version 2>/dev/null; then
    MACHINE="WSL"
elif [[ "${OS_TYPE}" == "Linux" ]]; then
    MACHINE="Linux"
elif [[ "${OS_TYPE}" == "Darwin" ]]; then
    MACHINE="Mac"
elif [[ "${OS_TYPE}" =~ ^(CYGWIN|MINGW|MSYS).* ]]; then
    MACHINE="Windows"
else
    MACHINE="UNKNOWN:${OS_TYPE}"
fi

echo -e "${CYAN}Detected environment: ${MACHINE}${NC}"

# --------------------------- Helper Functions -------------------------------
pause() {
    read -rp "Press <Enter> to continue..."
}
command_exists() {
    command -v "$1" &>/dev/null
}

# Wrapper to run a Windows program via cmd.exe when under WSL/Windows
win_cmd() {
    cmd.exe /C "$*"
}

# --------------------------- Prerequisite Checks -----------------------------
echo -e "${CYAN}Checking prerequisites…${NC}"

# 1) Docker
if ! command_exists docker; then
    echo -e "${RED}Docker not found. Please install Docker Desktop and ensure it’s running.${NC}"
    exit 1
else
    echo -e "${GREEN}✔ Docker found: $(docker --version)${NC}"
fi

# 2) kubectl
if [[ "${MACHINE}" == "WSL" || "${MACHINE}" == "Windows" ]]; then
    if ! win_cmd "where kubectl" &>/dev/null; then
        echo -e "${RED}kubectl not found on Windows. Please install it (e.g. 'choco install kubernetes-cli').${NC}"
        exit 1
    else
        kubectl_version="$(win_cmd "kubectl version --client" | tr -d '\r\n')"
        echo -e "${GREEN}✔ Windows kubectl found: ${kubectl_version}${NC}"
    fi
else
    if ! command_exists kubectl; then
        echo -e "${RED}kubectl not found. Please install kubectl (e.g. via apt, brew, or downloading binary).${NC}"
        exit 1
    else
        echo -e "${GREEN}✔ kubectl found: $(kubectl version --client | head -n1)${NC}"
    fi
fi

# 3) minikube
if [[ "${MACHINE}" == "WSL" || "${MACHINE}" == "Windows" ]]; then
    if ! win_cmd "where minikube.exe" &>/dev/null; then
        echo -e "${RED}minikube.exe not found on Windows. Please install it (e.g. 'choco install minikube').${NC}"
        exit 1
    else
        minikube_version="$(win_cmd "minikube version" | tr -d '\r\n')"
        echo -e "${GREEN}✔ Windows minikube found: ${minikube_version}${NC}"
    fi
else
    if ! command_exists minikube; then
        echo -e "${RED}minikube not found. Please install minikube (e.g. via apt, brew, or binary).${NC}"
        exit 1
    else
        echo -e "${GREEN}✔ minikube found: $(minikube version | head -n1)${NC}"
    fi
fi

# 4) Docker daemon check
echo -e "${CYAN}Verifying Docker daemon is running…${NC}"
if ! docker info &>/dev/null; then
    echo -e "${RED}Docker daemon is not running. Please start Docker Desktop or the Docker service.${NC}"
    exit 1
else
    echo -e "${GREEN}✔ Docker daemon is running.${NC}"
fi

pause

# ---------------------------- Start Minikube ---------------------------------
echo -e "${CYAN}Starting Minikube (driver=docker)…${NC}"
if [[ "${MACHINE}" == "WSL" || "${MACHINE}" == "Windows" ]]; then
    status_out="$(win_cmd "minikube status" 2>/dev/null || echo "")"
    if echo "${status_out}" | grep -qi "host: Running"; then
        echo -e "${YELLOW}Minikube is already running (Windows).${NC}"
    else
        echo -e "${YELLOW}→ cmd.exe /C minikube start --driver=docker${NC}"
        win_cmd "minikube start --driver=docker" \
            || { echo -e "${RED}Failed to start minikube.exe.${NC}"; exit 1; }
    fi
else
    if minikube status &>/dev/null && minikube status | grep -qi "host: Running"; then
        echo -e "${YELLOW}Minikube is already running (native).${NC}"
    else
        echo -e "${YELLOW}→ minikube start --driver=docker${NC}"
        minikube start --driver=docker \
            || { echo -e "${RED}Failed to start minikube.${NC}"; exit 1; }
    fi
fi

pause

# ------------------ Mount Local data/ Directory in Minikube ------------------
echo -e "${CYAN}Mounting ./data → /mnt/data in Minikube…${NC}"
if [[ "${MACHINE}" == "WSL" || "${MACHINE}" == "Windows" ]]; then
    # Check if a Windows-side mount is already running
    pgrep -f "minikube.exe mount .*data:/mnt/data" &>/dev/null && MOUNT_EXISTS=$? || MOUNT_EXISTS=1
    if [[ ${MOUNT_EXISTS} -eq 0 ]]; then
        echo -e "${YELLOW}Data already mounted in Minikube (Windows).${NC}"
    else
        # Convert WSL path (/mnt/c/Users/Zeina/IdeaProjects/CallDataRecords) into Windows forward-slash form:
        #    C:/Users/Zeina/IdeaProjects/CallDataRecords/data
        HOST_PATH_WSL="$(pwd)"
        drive_and_rest=$(echo "$HOST_PATH_WSL" | sed -E 's#^/mnt/([a-z])/(.*)#\1:/\2#')
        drive_letter_upper=$(echo "${drive_and_rest}" | cut -d':' -f1 | tr '[:lower:]' '[:upper:]')
        rest_path=$(echo "${drive_and_rest}" | cut -d':' -f2)
        WIN_PATH="${drive_letter_upper}:${rest_path}/data"

        echo -e "${YELLOW}→ cmd.exe /C minikube mount ${WIN_PATH}:/mnt/data${NC}"
        # Mount without quotes around the host path:
        win_cmd "minikube mount ${WIN_PATH}:/mnt/data" &
        MOUNT_PID=$!

        # Poll up to 10 seconds for files to appear under /mnt/data
        for ((i=1; i<=10; i++)); do
            sleep 1
            FILE_LIST=$(win_cmd "minikube ssh -- ls /mnt/data" 2>/dev/null || echo "")
            if [[ -n "${FILE_LIST//no such file*/}" ]]; then
                echo -e "${GREEN}✔ data/ now visible in Minikube (Windows):${NC}"
                echo "${FILE_LIST}" | sed 's/^/    /'
                break
            fi
            if [[ $i -eq 10 ]]; then
                echo -e "${RED}❌ Timeout: /mnt/data is still empty or not accessible in Minikube after 10s.${NC}"
                echo -e "${RED}Make sure 'minikube mount' is running and that ./data contains your files.${NC}"
                exit 1
            fi
        done
    fi
else
    # Native Linux/macOS case (unchanged)
    pgrep -f "minikube mount .*data:/mnt/data" &>/dev/null && MOUNT_EXISTS=$? || MOUNT_EXISTS=1
    if [[ ${MOUNT_EXISTS} -eq 0 ]]; then
        echo -e "${YELLOW}Data already mounted in Minikube (native).${NC}"
    else
        echo -e "${YELLOW}→ minikube mount \"$(pwd)/data:/mnt/data\"${NC}"
        minikube mount "$(pwd)/data:/mnt/data" &
        MOUNT_PID=$!

        # Poll up to 10 seconds for files to appear under /mnt/data
        for ((i=1; i<=10; i++)); do
            sleep 1
            FILE_LIST=$(minikube ssh -- ls /mnt/data 2>/dev/null || echo "")
            if [[ -n "${FILE_LIST//no such file*/}" ]]; then
                echo -e "${GREEN}✔ data/ now visible in Minikube (native):${NC}"
                echo "${FILE_LIST}" | sed 's/^/    /'
                break
            fi
            if [[ $i -eq 10 ]]; then
                echo -e "${RED}❌ Timeout: /mnt/data is still empty or not accessible in Minikube after 10s.${NC}"
                echo -e "${RED}Make sure 'minikube mount' is running and that ./data contains your files.${NC}"
                exit 1
            fi
        done
    fi
fi

pause

# -------------------------- Start Minikube Tunnel ----------------------------
echo -e "${CYAN}Starting minikube tunnel for LoadBalancer services…${NC}"
if [[ "${MACHINE}" == "WSL" || "${MACHINE}" == "Windows" ]]; then
    pgrep -f "minikube.exe tunnel" &>/dev/null && TUNNEL_EXISTS=$? || TUNNEL_EXISTS=1
    if [[ ${TUNNEL_EXISTS} -eq 0 ]]; then
        echo -e "${YELLOW}minikube tunnel already running (Windows).${NC}"
    else
        echo -e "${YELLOW}→ cmd.exe /C minikube tunnel${NC}"
        win_cmd "minikube tunnel" 2>&1 &
        sleep 3
        echo -e "${GREEN}✔ minikube tunnel started (Windows).${NC}"
    fi
else
    pgrep -f "minikube tunnel" &>/dev/null && TUNNEL_EXISTS=$? || TUNNEL_EXISTS=1
    if [[ ${TUNNEL_EXISTS} -eq 0 ]]; then
        echo -e "${YELLOW}minikube tunnel already running (native).${NC}"
    else
        echo -e "${YELLOW}→ sudo minikube tunnel${NC}"
        sudo minikube tunnel &
        sleep 3
        echo -e "${GREEN}✔ minikube tunnel started (native).${NC}"
    fi
fi

pause

# ------------------------- Apply Kubernetes Manifests ------------------------
echo -e "${CYAN}Applying Kubernetes manifests under ./k8s/…${NC}"
if [[ "${MACHINE}" == "WSL" || "${MACHINE}" == "Windows" ]]; then
    win_cmd "kubectl apply -f k8s\\" \
        || { echo -e "${RED}kubectl apply failed (Windows).${NC}"; exit 1; }
else
    kubectl apply -f k8s/ || { echo -e "${RED}kubectl apply failed (native).${NC}"; exit 1; }
fi
echo -e "${GREEN}✔ Manifests applied successfully.${NC}"

echo -e "${CYAN}Waiting for pods to be Ready (timeout 120s)…${NC}"
if [[ "${MACHINE}" == "WSL" || "${MACHINE}" == "Windows" ]]; then
    win_cmd "kubectl wait --for=condition=Ready pods --all --timeout=120s" || \
      echo -e "${YELLOW}Some pods did not become Ready within 120s (Windows).${NC}"
    win_cmd "kubectl get pods,svc"
else
    kubectl wait --for=condition=Ready pods --all --timeout=120s || \
      echo -e "${YELLOW}Some pods did not become Ready within 120s (native).${NC}"
    kubectl get pods,svc
fi

pause

# ------------------------------ Open Browser --------------------------------
echo -e "${CYAN}Opening http://localhost in default browser…${NC}"
if [[ "${MACHINE}" == "Mac" ]]; then
    open http://localhost
elif [[ "${MACHINE}" == "Linux" ]]; then
    xdg-open http://localhost
else
    # For WSL/Windows, launch via PowerShell or cmd
    if command_exists powershell.exe; then
        powershell.exe /c start "http://localhost"
    else
        cmd.exe /C start "http://localhost"
    fi
fi

echo -e "${GREEN}🎉 All done! The CDR UI should be available at http://localhost${NC}"

# ------------------------------ Teardown Option ------------------------------
echo
read -rp $'\e[33mPress [Y] to STOP & DELETE the Minikube cluster (and kill mount/tunnel), or any other key to exit: \e[0m' teardown
if [[ "${teardown}" =~ ^[Yy]$ ]]; then
    echo -e "${CYAN}\nTearing down Minikube cluster and background processes…${NC}"

    # 1) Kill any minikube mount processes
    if [[ "${MACHINE}" == "WSL" || "${MACHINE}" == "Windows" ]]; then
        win_cmd "taskkill /IM minikube.exe /FI \"WINDOWTITLE eq *mount*\" /F" &>/dev/null || true
        pkill -f "minikube.exe mount" &>/dev/null || true
    else
        pkill -f "minikube mount" &>/dev/null || true
    fi
    echo -e "${YELLOW}✔ Killed any 'minikube mount' processes.${NC}"

    # 2) Kill any minikube tunnel processes
    if [[ "${MACHINE}" == "WSL" || "${MACHINE}" == "Windows" ]]; then
        win_cmd "taskkill /IM minikube.exe /FI \"WINDOWTITLE eq *tunnel*\" /F" &>/dev/null || true
        pkill -f "minikube.exe tunnel" &>/dev/null || true
    else
        pkill -f "minikube tunnel" &>/dev/null || true
    fi
    echo -e "${YELLOW}✔ Killed any 'minikube tunnel' processes.${NC}"

    # 3) Delete the Minikube cluster
    if [[ "${MACHINE}" == "WSL" || "${MACHINE}" == "Windows" ]]; then
        echo -e "${YELLOW}→ cmd.exe /C minikube delete${NC}"
        win_cmd "minikube delete" &>/dev/null || echo -e "${RED}Warning: 'minikube delete' failed.${NC}"
    else
        minikube delete &>/dev/null || echo -e "${RED}Warning: 'minikube delete' failed.${NC}"
    fi
    echo -e "${GREEN}✔ Minikube cluster deleted.${NC}"

    echo -e "${GREEN}\nAll teardown steps completed. Exiting.${NC}"
else
    echo -e "${CYAN}\nExiting without touching Minikube. Have a good day!${NC}"
fi
