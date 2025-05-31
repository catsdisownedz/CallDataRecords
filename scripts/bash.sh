#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# Interactive script to:
#  1) Check/install prerequisites (Docker, kubectl, Minikube)
#  2) Start Minikube (docker driver)
#  3) Mount ./data to /mnt/data in Minikube
#  4) Start 'minikube tunnel'
#  5) Apply all manifests in k8s/
#  6) Open the UI at http://localhost
# ------------------------------------------------------------------------------

set -euo pipefail
IFS=$'\n\t'

# ------------------------------ Color Helpers -------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ------------------------------- OS Detection ------------------------------
OS_TYPE="$(uname -s)"
case "${OS_TYPE}" in
    Linux*)   MACHINE=Linux;;
    Darwin*)  MACHINE=Mac;;
    CYGWIN*|MINGW*|MSYS*) MACHINE=Windows;;
    *)        MACHINE="UNKNOWN:${OS_TYPE}"
esac

echo -e "${CYAN}Detected OS:${MACHINE}${NC}"

# --------------------------- Helper Functions -------------------------------
function pause() {
    read -rp "Press <Enter> to continue..."
}

function command_exists() {
    command -v "$1" >/dev/null 2>&1
}

function install_kubectl() {
    echo -e "${YELLOW}kubectl not found. Installing...${NC}"
    if [[ "${MACHINE}" == "Mac" ]]; then
        if command_exists brew; then
            brew install kubectl || { echo -e "${RED}Failed to brew install kubectl.${NC}"; exit 1; }
        else
            echo -e "${RED}Homebrew not installed. Please install Homebrew or install kubectl manually.${NC}"
            exit 1
        fi
    elif [[ "${MACHINE}" == "Linux" ]]; then
        echo -e "${YELLOW}Downloading kubectl binary...${NC}"
        curl -LO "https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl"
        chmod +x kubectl
        sudo mv kubectl /usr/local/bin/
    elif [[ "${MACHINE}" == "Windows" ]]; then
        echo -e "${YELLOW}Please install kubectl via Chocolatey:${NC} ${CYAN}choco install kubernetes-cli${NC}"
        exit 1
    else
        echo -e "${RED}Unsupported OS for installing kubectl. Please install manually.${NC}"
        exit 1
    fi
}

function install_minikube() {
    echo -e "${YELLOW}minikube not found. Installing...${NC}"
    if [[ "${MACHINE}" == "Mac" ]]; then
        if command_exists brew; then
            brew install minikube || { echo -e "${RED}Failed to brew install minikube.${NC}"; exit 1; }
        else
            echo -e "${RED}Homebrew not installed. Please install Homebrew or install minikube manually.${NC}"
            exit 1
        fi
    elif [[ "${MACHINE}" == "Linux" ]]; then
        echo -e "${YELLOW}Downloading minikube binary...${NC}"
        curl -Lo minikube https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
        chmod +x minikube
        sudo mv minikube /usr/local/bin/
    elif [[ "${MACHINE}" == "Windows" ]]; then
        echo -e "${YELLOW}Please install minikube via Chocolatey:${NC} ${CYAN}choco install minikube${NC}"
        exit 1
    else
        echo -e "${RED}Unsupported OS for installing minikube. Please install manually.${NC}"
        exit 1
    fi
}

# --------------------------- Prerequisite Checks ----------------------------
echo -e "${CYAN}Checking prerequisites...${NC}"

# 1) Docker
if ! command_exists docker; then
    echo -e "${RED}Docker not found. Please install Docker first and ensure it is running.${NC}"
    exit 1
else
    echo -e "${GREEN}✔ Docker found: $(docker --version)${NC}"
fi

# 2) kubectl
if ! command_exists kubectl; then
    install_kubectl
else
    echo -e "${GREEN}✔ kubectl found: $(kubectl version --client --short)${NC}"
fi

# 3) minikube
if ! command_exists minikube; then
    install_minikube
else
    echo -e "${GREEN}✔ minikube found: $(minikube version)${NC}"
fi

# 4) Ensure Docker daemon is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}Docker daemon is not running. Please start Docker Desktop or docker service.${NC}"
    exit 1
fi

echo -e "${CYAN}All prerequisites satisfied.${NC}"
pause

# ---------------------------- Start Minikube --------------------------------
echo -e "${CYAN}Starting Minikube (driver=docker)...${NC}"
if minikube status >/dev/null 2>&1; then
    echo -e "${YELLOW}Minikube is already running. Skipping 'minikube start'.${NC}"
else
    minikube start --driver=docker || { echo -e "${RED}Failed to start Minikube.${NC}"; exit 1; }
fi

# ------------------ Mount Local data/ Directory in Minikube -----------------
echo -e "${CYAN}Mounting ./data → /mnt/data in Minikube...${NC}"
# Check if a mount is already in place by looking at `minikube mount` processes
if pgrep -f "minikube mount .*data:/mnt/data" >/dev/null; then
    echo -e "${YELLOW}Data already mounted. Skipping mount step.${NC}"
else
    # For Windows Git Bash/WSL, translate path
    if [[ "${MACHINE}" == "Windows" ]]; then
        # Convert Windows path to WSL path automatically
        MOUNT_SRC="$(pwd | sed 's#^/\([a-z]\)/#\1:/#; s#/#\\#g')\\data"
        minikube mount "${MOUNT_SRC}:/mnt/data" >/dev/null 2>&1 &
    else
        minikube mount "$(pwd)/data:/mnt/data" >/dev/null 2>&1 &
    fi
    sleep 2
fi

echo -e "${GREEN}✔ data/ successfully mounted.${NC}"
pause

# -------------------------- Start Minikube Tunnel ---------------------------
echo -e "${CYAN}Starting minikube tunnel for LoadBalancer services...${NC}"
if pgrep -f "minikube tunnel" >/dev/null; then
    echo -e "${YELLOW}‘minikube tunnel’ is already running. Skipping.${NC}"
else
    # Must be run with sudo or as Administrator
    if [[ "${MACHINE}" == "Linux" || "${MACHINE}" == "Mac" ]]; then
        sudo minikube tunnel >/dev/null 2>&1 &
    else
        echo -e "${YELLOW}Ensure you run Git Bash as Administrator so minikube tunnel works. Starting tunnel...${NC}"
        minikube tunnel >/dev/null 2>&1 &
    fi
    sleep 3
fi

echo -e "${GREEN}✔ minikube tunnel is running.${NC}"
pause

# ------------------------- Apply Kubernetes Manifests -----------------------
echo -e "${CYAN}Applying Kubernetes manifests (k8s/)...${NC}"
kubectl apply -f k8s/ || { echo -e "${RED}kubectl apply failed. Exiting.${NC}"; exit 1; }
echo -e "${GREEN}✔ Kubernetes resources created.${NC}"

echo -e "${CYAN}Waiting for pods to be ready (this may take a minute)...${NC}"
kubectl wait --for=condition=Ready pods --all --timeout=120s || \
    echo -e "${YELLOW}Some pods did not reach 'Ready' in 120s. Check 'kubectl get pods' for details.${NC}"

# Show pods status
kubectl get pods,svc
pause

# ------------------------------ Open Browser --------------------------------
echo -e "${CYAN}Opening http://localhost in default browser...${NC}"
if [[ "${MACHINE}" == "Mac" ]]; then
    open http://localhost
elif [[ "${MACHINE}" == "Linux" ]]; then
    xdg-open http://localhost
elif [[ "${MACHINE}" == "Windows" ]]; then
    cmd.exe /C start http://localhost
else
    echo -e "${YELLOW}Please manually open your browser and navigate to http://localhost${NC}"
fi

echo -e "${GREEN}🎉 All done! The CDR UI should be available at http://localhost${NC}"
