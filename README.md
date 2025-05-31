# Call Data Records (CDR) Project

A monorepo containing three Spring Boot microservices (`ms-loader`, `ms-backend`, `ms-frontend`), all coordinated via Docker Compose **or** Kubernetes (Minikube). This README will guide you through:

1. **Prerequisites**
2. **Repository Structure**
3. **Running with Docker Compose**
4. **Running with Kubernetes (Minikube)**

    * Using the provided interactive `bash.sh` script
    * Manual steps (if you prefer)
5. **Accessing the UI**
6. **Troubleshooting**

---

## 1. Prerequisites

Before you begin, make sure your machine meets the following requirements:

(The bash file at scripts/bash.sh also checks for them and runs in k8s environment if you want to skip this part.)
1. **Git**

    * To clone/fork this repository.

2. **Java 11 (or higher)**

    * Required to build and run the Spring Boot modules.

3. **Gradle**

    * You can use the included `gradlew` wrapper; no need to install Gradle system-wide.

4. **Docker**

    * Community Edition (CE) is fine.
    * Make sure Docker Desktop (Windows/Mac) or Docker Engine (Linux) is installed and running.
    * Verify:

      ```bash
      $ docker --version
      ```

5. **Docker Compose**

    * Usually bundled with Docker Desktop on Windows/Mac.
    * On Linux, install via your package manager (e.g., `sudo apt install docker-compose`).
    * Verify:

      ```bash
      $ docker-compose --version
      ```

6. **kubectl** (Kubernetes CLI)

    * Used for applying Kubernetes manifests.
    * Install from [Kubernetes docs](https://kubernetes.io/docs/tasks/tools/) or via your package manager:

        * **macOS (Homebrew)**:

          ```bash
          brew install kubectl
          ```
        * **Linux**:

          ```bash
          curl -LO "https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl"
          chmod +x kubectl
          sudo mv kubectl /usr/local/bin/
          ```
        * **Windows (Chocolatey)**:

          ```powershell
          choco install kubernetes-cli
          ```
    * Verify:

      ```bash
      $ kubectl version --client
      ```

7. **Minikube**

    * To spin up a local single-node Kubernetes cluster.
    * Install instructions:

        * **macOS (Homebrew)**:

          ```bash
          brew install minikube
          ```
        * **Linux**:

          ```bash
          curl -Lo minikube https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
          chmod +x minikube
          sudo mv minikube /usr/local/bin/
          ```
        * **Windows (Chocolatey)**:

          ```powershell
          New-Item -Path 'c:\' -Name 'minikube' -ItemType Directory -Force
          $ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -OutFile 'c:\minikube\minikube.exe' -Uri 'https://github.com/kubernetes/minikube/releases/latest/download/minikube-windows-amd64.exe' -UseBasicParsing
          ```
          _(Don't forget to add the minikube.exe binary to your PATH)_
        
    * Verify:

      ```bash
      $ minikube version
      ```

> **Important**:
>
> * On Windows you may need to run these commands from **PowerShell as Administrator** or from **Git Bash** (with elevated privileges).
> * Make sure your user has permission to run Docker commands.

---

## 2. Repository Structure

```text
CallDataRecords/
├── Dockerfile
├── README.md
├── data/
│   ├── names.csv
│   └── users.csv
├── docker-compose.yml
├── k8s/                       # Kubernetes manifests
│   ├── backend-deployment.yaml
│   ├── backend-service.yaml
│   ├── cdr-ingress.yaml
│   ├── frontend-config-configmap.yaml
│   ├── frontend-deployment.yaml
│   ├── frontend-keycloak-configmap.yaml
│   ├── frontend-service.yaml
│   ├── hostpath-pv.yaml
│   ├── kafka-deployment.yaml
│   ├── kafka-service.yaml
│   ├── keycloak-deployment.yaml
│   ├── keycloak-service.yaml
│   ├── loader-deployment.yaml
│   ├── loader-service.yaml
│   ├── mysql-deployment.yaml
│   ├── mysql-service.yaml
│   ├── nginx-configmap.yaml
│   ├── nginx-deployment.yaml
│   ├── nginx-service.yaml
│   ├── nginx-static-configmap.yaml
│   ├── postgres-deployment.yaml
│   └── postgres-service.yaml
├── ms-backend/                # Spring Boot backend (Kafka consumer + MySQL + Keycloak integration)
│   ├── Dockerfile
│   ├── HELP.md
│   ├── build.gradle
│   ├── src/main/java/…        # Java source code
│   └── src/main/resources/…   # application.properties, SQL migrations, etc.
├── ms-frontend/               # Spring Boot frontend (serves static UI + Keycloak realm generator)
│   ├── Dockerfile
│   ├── HELP.md
│   ├── build.gradle
│   ├── src/main/resources/static/
│   │   ├── index.html
│   │   ├── scripts.js
│   │   ├── styles.css
│   │   ├── signup.html
│   │   ├── signup.css
│   │   ├── config-docker.json
│   │   ├── config-k8s.json
│   │   ├── config.json
│   │   └── keycloak.json
│   └── src/main/java/…        # Java code for realm generation, etc.
├── ms-loader/                 # Spring Boot loader (Kafka producer + PostgreSQL + user CSV ingestion)
│   ├── Dockerfile
│   ├── HELP.md
│   ├── build.gradle
│   ├── src/main/java/…        # Java source code
│   └── src/main/resources/…   # application.properties, SQL migrations, etc.
├── realms/
│   └── cdr-realm.json         # Keycloak realm export
├── scripts/
│   ├── bash.sh                # Interactive script for Kubernetes setup & deployment
│   └── generate-realm.sh      # Helper script to import Keycloak realm
├── settings.gradle
└── themes/                    # Keycloak custom theme
    └── cdr-pastel/
        └── login/
            ├── login.ftl
            ├── resources/css/theme.css
            └── theme.properties
```

---

## 3. Running with Docker Compose

If you simply want to spin everything up locally (without installing Kubernetes), use Docker Compose:

```bash
# Build and start all services:
docker-compose up --build
```

* This brings up:

    1. **PostgreSQL** (for ms-loader)
    2. **MySQL** (for ms-backend)
    3. **Kafka & Zookeeper**
    4. **Keycloak** (with `cdr-realm.json` pre-imported)
    5. **ms-loader** (produces CDRs to Kafka)
    6. **ms-backend** (consumes CDRs, writes to MySQL, exposes REST API)
    7. **ms-frontend** (serves static UI, integrates with Keycloak)
    8. **Nginx** (reverse proxy for frontend + Keycloak)

Once all containers are healthy, open your browser to:

```
http://localhost
```

You should see the **Login** page (via Keycloak).
After logging in or signing up, you’ll be redirected to the CDR UI, which pulls from `ms-backend`’s API and displays charts + tables.

> **Stopping**:
>
> ```bash
> docker-compose down
> ```

---

## 4. Running with Kubernetes (Minikube)

We provide an **interactive `bash.sh` script** that will:

1. Detect your OS (Linux, macOS, or Windows via Git Bash/WSL).
2. Install any missing prerequisites (minikube, kubectl, Docker, etc.) if possible.
3. Start a Minikube cluster using the Docker driver.
4. Mount the local `data/` directory into the Minikube VM (`/mnt/data`).
5. Run `minikube tunnel` (for LoadBalancer services such as Keycloak & Nginx).
6. Apply all Kubernetes manifests from `k8s/`.
7. Open `http://localhost` in your default browser.

### 4.1. Using the Interactive Script

1. Make sure you are in the project root:

   ```bash
   cd /path/to/CallDataRecords
   ```
2. Ensure the `bash.sh` script is executable:

   ```bash
   chmod +x scripts/bash.sh
   ```
3. Run the script:

   ```bash
   ./scripts/bash.sh
   ```

The script will guide you step by step. If a prerequisite is already installed, it will skip the installation. If it is missing and can be installed via a package manager (Homebrew, APT, Chocolatey), the script will install it for you.

> **Note for Windows Users**:
>
> * Use **Git Bash** or **WSL Bash** as administrator.
> * If you see prompts about installing via Chocolatey, allow them (you may need to open Git Bash as Admin).

### 4.2. Manual Steps (If You Prefer)

If you’d rather do everything “by hand,” follow these steps:

1. **Start Minikube** with Docker driver:

   ```bash
   minikube start --driver=docker
   ```

    * If you see “**Kubectl not installed**,” install it (see Prerequisites).
    * If “**Minikube not installed**,” install it (see Prerequisites).
    * If Docker is not running, start Docker Desktop first.

2. **Mount local `data/` directory** (so that the Spring Boot services inside Minikube can see it):

   ```bash
   # On Linux/macOS:
   minikube mount ./data:/mnt/data &

   # On Windows (Git Bash/WSL):
   minikube mount C:/Users/Zeina/IdeaProjects/CallDataRecords/data:/mnt/data &
   ```

   Keep this process running in the background.

3. **Run Minikube tunnel** (needed for LoadBalancer services):

   ```bash
   minikube tunnel &
   ```

4. **Apply Kubernetes manifests**:

   ```bash
   kubectl apply -f k8s/
   ```

5. **Wait for all pods/services to become ready**. You can check status with:

   ```bash
   kubectl get pods,svc
   ```

   Look for `RUNNING`/`READY` states for pods and external IPs on services.

6. **Open the browser**:

   ```bash
   # Linux:
   xdg-open http://localhost

   # macOS:
   open http://localhost

   # Windows (Git Bash/WSL):
   cmd.exe /C start http://localhost
   ```

    * This should open the Nginx-fronted login page.
    * If the page doesn’t load, wait a minute and retry:
      `kubectl get pods` to see if all pods are `READY`.

---

## 5. Accessing the UI

After the cluster is up (either via Docker Compose or Minikube):

1. Open your browser at:

   ```
   http://localhost
   ```

2. You should see the **Keycloak** login page (custom “cdr-pastel” theme).

3. **Sign up** (it writes to `data/users.csv` and creates a user in Keycloak).

    * On success, you’re redirected to `index.html`.
    * The UI polls the backend for CDRs, shows a pulsing dot + charts + table.

4. **Logout**: click “🚪 Logout” in the top right to end your session.

---

## 6. Troubleshooting

* ### Docker Compose Fails to Build/Run

    * Ensure Docker Desktop (Windows/Mac) or Docker Engine (Linux) is running.
    * Run:

      ```bash
      docker info
      ```

      to confirm Docker is healthy.

* ### Minikube Won’t Start

    1. Run:

       ```bash
       minikube delete
       minikube start --driver=docker
       ```
    2. If you get an error about virtualization, ensure your machine supports virtualization and it’s enabled in BIOS/UEFI.
    3. If `docker driver` is unavailable, try:

       ```bash
       minikube start --driver=virtualbox
       ```

       (You may need VirtualBox installed.)

* ### `kubectl apply` Errors

    * If it complains “**the connection to the server was refused**,” ensure Minikube is running:

      ```bash
      minikube status
      ```
    * If the API versions changed, open the manifest file and update the `apiVersion:` lines accordingly (unlikely if following this repo).

* ### Keycloak Realm Import Doesn’t Work

    * Make sure the `realms/cdr-realm.json` file is present.
    * If deploying via Minikube, check the `frontend-keycloak-configmap.yaml` and `keycloak-deployment.yaml` to confirm the `KEYCLOAK_IMPORT` environment variable is set to `/opt/keycloak/data/import/cdr-realm.json`.
    * Check Keycloak pod logs:

      ```bash
      kubectl logs <keycloak-pod-name>
      ```

* ### Kafka / ZooKeeper Connectivity Issues

    * Ensure the Kafka and ZooKeeper services are healthy:

      ```bash
      kubectl get svc kafka
      kubectl get svc zookeeper   # if applicable
      ```
    * Check the `bootstrap.servers` in `ms-backend` and `ms-loader` config:
      They point to `kafka:9092` or `kafka.default.svc.cluster.local:9092`.
    * If DNS isn’t resolving, try adding a host alias or re-deploying the Kafka manifests.

* ### Database (PostgreSQL / MySQL) Issues

    * For Docker Compose, ports are published automatically.
    * For Minikube:

      ```bash
      kubectl get pods
      kubectl logs <postgres-pod-name>
      kubectl logs <mysql-pod-name>
      ```
    * Confirm that `ms-loader` is writing to PostgreSQL and `ms-backend` is writing to MySQL by checking their pod logs.

---

## 7. `scripts/bash.sh` (Interactive Kubernetes Launcher)

Below is the **`bash.sh`** script (in the `scripts/` directory).
Run it from the project root:

```bash
chmod +x scripts/bash.sh
./scripts/bash.sh
```

It will:

1. Check for Docker, kubectl, and Minikube.
2. Install missing tools where possible.
3. Start Minikube (Docker driver).
4. Mount `./data` → `/mnt/data`.
5. Run `minikube tunnel` for LoadBalancer services.
6. Apply the `k8s/` manifests.
7. Open `http://localhost` in your default browser.
8. Provide clear logs/errors if something fails.


> **Script Workflow Summary**
>
> 1. **Check** Docker, kubectl, minikube (install if missing).
> 2. **Start** Minikube with `--driver=docker` (skip if already running).
> 3. **Mount** local `./data` → Minikube’s `/mnt/data` (skip if already mounted).
> 4. **Run** `minikube tunnel` (skip if already running).
> 5. **Apply** all manifests in `k8s/`.
> 6. **Wait** for pods to become ready.
> 7. **List** pods/services status.
> 8. **Open** `http://localhost` in default browser.

---

## 8. Windows, Linux, and macOS Compatibility

* The `bash.sh` script uses `uname -s` to detect your OS and runs the proper installation commands (Homebrew on macOS, APT on Linux, Chocolatey hints on Windows).
* On **Windows**, you should run this in **Git Bash** or **WSL Bash**, **as Administrator**, for the `minikube tunnel` step to work.

---

## 9. Summary of Commands

Once you have everything cloned, you can either:

1. **Run with Docker Compose**:

   ```bash
   docker-compose up --build
   ```

    * Access: `http://localhost`

2. **Run with Kubernetes (Minikube)**:

   ```bash
   chmod +x scripts/bash.sh
   ./scripts/bash.sh
   ```

    * Interactive prompts will guide you.
    * Access: `http://localhost`

---

## 10. Additional Tips

* **Logs**

    * If something goes wrong, inspect logs with:

      ```bash
      # For Docker Compose
      docker-compose logs <service-name>
  
      # For Kubernetes
      kubectl logs <pod-name>
      ```
* **Deleting the Minikube Cluster**

  ```bash
  minikube delete
  ```
* **Destroy Docker Compose**

  ```bash
  docker-compose down
  ```
* **Keycloak Admin**

    * The initial admin user is:

      ```
      Username:   admin
      Password:   admin
      ```
    * Access Keycloak at: `http://localhost/auth`
* **Data Files**

    * New users are appended to `data/users.csv`.
    * CDRs (generated by `ms-loader`) are printed to console and sent through Kafka to `ms-backend` → MySQL.

---

Thank you for using the **Call Data Records** monorepo. If you run into any issues, consult the logs or review the “Troubleshooting” section above. Happy coding!
