# 🎓 Parcours de formation — Plateforme IA & Cloud (Azure + Microsoft Foundry)

Bienvenue ! Ce dépôt contient une série de **notebooks pratiques** pour découvrir Azure et la plateforme IA **Microsoft Foundry**, en partant **de zéro**.

> 📚 Aucun prérequis cloud n'est nécessaire. Juste un peu de Python (les bases : variables, `import`, exécuter un script).

---

## 👋 Avant de commencer — Ce que votre encadrant doit vous fournir

Pour suivre ce parcours, on suppose qu'on vous a déjà donné :

1. **Un compte Microsoft Entra ID** (l'identifiant Azure de votre tenant) avec accès à un abonnement Azure.
2. **Le nom d'un Resource Group** déjà créé pour vous, suivant la convention **`rg-stage-<votre-identifiant>`** (ex. `rg-stage-leo`).
3. **Le rôle `Owner` (ou `Contributor`) sur ce Resource Group** — c'est ce qui vous permet de créer des ressources dedans (Web App, Foundry, App Insights, etc.).

> ❗ **Vous ne créerez PAS de Resource Group dans ce parcours.** Vous travaillez dans celui qu'on vous a fourni. À la fin de chaque notebook, **vous supprimez uniquement les ressources que VOUS avez créées** — jamais le RG.

Notez ces deux infos quelque part, vous en aurez besoin :

```
Nom du Resource Group : rg-...........
Abonnement Azure      : .....................
```

---

## 🚀 Démarrage rapide — Deux options

Choisissez **une seule** des deux options. La **A (Codespaces)** est la plus rapide — tout est déjà installé.

| Option | Pour qui ? | Temps de mise en route |
|--------|------------|------------------------|
| **A — GitHub Codespaces** ⭐ | Vous voulez juste démarrer, sans rien installer sur votre poste | ~3 minutes |
| **B — Installation locale** | Vous voulez tout maîtriser sur votre machine | ~15-30 minutes |

---

### Option A — GitHub Codespaces (recommandé)

GitHub Codespaces vous donne un **VS Code dans le navigateur**, avec Python, Azure CLI et toutes les extensions déjà installées.

#### A.1 — Lancer un Codespace

1. Sur la page GitHub de ce dépôt, cliquez le bouton vert **`Code`** en haut à droite.
2. Onglet **`Codespaces`** → **`Create codespace on main`**.
3. Patientez ~1 minute : votre environnement se construit automatiquement grâce au fichier [.devcontainer/devcontainer.json](.devcontainer/devcontainer.json) — Python 3.13, Azure CLI, extensions VS Code, install des SDK Python via `requirements.txt`.
4. Quand l'éditeur est prêt, un terminal s'ouvre en bas.

> 💡 Les Codespaces sont **gratuits jusqu'à 60h/mois** pour les comptes individuels. Suspendez votre Codespace quand vous ne travaillez pas (clic droit dans la liste des Codespaces → *Stop*).

#### A.2 — Se connecter à Azure depuis le Codespace

Dans le terminal du Codespace :

```bash
az login --use-device-code
```

(Pourquoi `--use-device-code` ? Parce qu'on est dans un navigateur, donc pas de fenêtre pop-up. La commande affiche un code et une URL : ouvrez l'URL, collez le code, connectez-vous avec votre compte Azure.)

Vérifiez :

```bash
az account show --output table
```

#### A.3 — Ouvrir le premier notebook

Dans VS Code (le Codespace), ouvrez `notebooks/01-fondamentaux-azure-paas.ipynb` et **passez à la section [📖 Comment dérouler chaque notebook](#-comment-dérouler-chaque-notebook)**.

---

### Option B — Installation locale

Cette option vous fait installer tous les outils sur votre machine. Choisissez votre OS ci-dessous.

#### B.1 — Sur Windows 10/11

##### Étape 1 — Installer les outils via `winget`

`winget` est le gestionnaire de paquets de Windows (déjà installé sur Windows 11 et la plupart des Windows 10). Ouvrez **PowerShell** (touche Windows → tapez `powershell`) puis copiez-collez ces commandes une par une :

```powershell
# Git (versionnage)
winget install --id Git.Git -e

# Python 3.13
winget install --id Python.Python.3.13 -e

# Azure CLI
winget install --id Microsoft.AzureCLI -e

# VS Code (éditeur)
winget install --id Microsoft.VisualStudioCode -e
```

> ⚠️ Après l'installation, **fermez et rouvrez PowerShell** pour que les nouvelles commandes soient reconnues.

##### Étape 2 — Vérifier les installations

```powershell
git --version       # doit afficher "git version 2.x"
python --version    # doit afficher "Python 3.13.x"
az --version        # doit afficher "azure-cli 2.x"
code --version      # doit afficher la version de VS Code
```

Si une commande n'est pas reconnue, redémarrez PowerShell, voire votre machine.

##### Étape 3 — Cloner le dépôt

```powershell
# Allez dans un dossier où vous voulez stocker votre code (créez-le si besoin)
cd C:\dev
git clone <URL-DU-REPO-GITHUB> stage
cd stage
```

> 🔑 Remplacez `<URL-DU-REPO-GITHUB>` par l'URL HTTPS du dépôt (bouton vert `Code → HTTPS` sur GitHub).

##### Étape 4 — Créer un environnement Python virtuel et installer les SDK

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

> 🛑 Si `Activate.ps1` est bloqué par la politique d'exécution, ouvrez PowerShell **en administrateur** et tapez : `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`. Puis ré-essayez.

##### Étape 5 — Ouvrir VS Code et les extensions

```powershell
code .
```

Une fois VS Code ouvert, installez ces 3 extensions (panneau de gauche → icône Extensions, ou `Ctrl+Shift+X`) :

- **Python** (`ms-python.python`)
- **Jupyter** (`ms-toolsai.jupyter`)
- **Azure Tools** (`ms-vscode.vscode-node-azure-pack`) — pack qui regroupe les extensions Azure utiles

##### Étape 6 — Se connecter à Azure

Dans le terminal intégré de VS Code (menu *Terminal → New Terminal*) :

```powershell
az login
```

Une fenêtre de navigateur s'ouvre. Connectez-vous avec votre compte Azure. Puis :

```powershell
az account show --output table
```

Vous devez voir votre abonnement.

#### B.2 — Sur macOS

```bash
# Homebrew (gestionnaire de paquets macOS) — si pas déjà installé :
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Les outils
brew install git python@3.13 azure-cli
brew install --cask visual-studio-code
```

Ensuite suivez les **étapes 2 à 6** de la section Windows (les commandes sont les mêmes, mais utilisez `source .venv/bin/activate` au lieu de `.\.venv\Scripts\Activate.ps1`).

#### B.3 — Sur Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y git python3.13 python3.13-venv python3-pip
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
# VS Code : suivez https://code.visualstudio.com/docs/setup/linux
```

Puis étapes 2 à 6 ci-dessus (`source .venv/bin/activate` pour activer le venv).

---

## ✅ Vérifier que tout marche

Dans un terminal (local ou Codespace), avec le venv activé si vous êtes en local :

```bash
az --version          # ≥ 2.86
python --version      # ≥ 3.11 (3.13 recommandé)
az account show       # doit afficher VOTRE abonnement
az group show --name <NOM-DE-VOTRE-RG> --output table   # doit afficher VOTRE RG
```

Si toutes ces commandes répondent correctement, **vous êtes prêt·e**. 🎉

---

## 📖 Comment dérouler chaque notebook

1. Ouvrez le notebook (`notebooks/01-...ipynb`) dans VS Code.
2. En haut à droite du notebook, cliquez **`Select Kernel`** et choisissez votre Python (`.venv` en local, ou le Python 3.13 global en Codespace).
3. **Lisez les cellules markdown** (les explications) avant d'exécuter le code.
4. Pour exécuter une cellule de code : cliquez le ▷ à gauche de la cellule, ou `Shift+Enter`.
5. Quand le notebook vous demande de remplir une variable `RG = "rg-stage-<votre-identifiant>"`, **mettez votre vraie valeur** avant de continuer. C'est la **seule** chose à éditer — tous les autres noms (Web App, Foundry, App Insights…) en sont déduits automatiquement.
6. **À la fin de chaque notebook**, exécutez la section **🧹 Nettoyage** si vous ne comptez pas enchaîner.

> 📝 **Une seule variable à retenir entre notebooks : votre nom de RG.** Tous les noms de ressources sont dérivés du RG (convention `*-stage-<votre-identifiant>`), donc les notebooks 02 et 06 retrouveront automatiquement les ressources créées par le 01.

---

## 🗺️ Parcours

| # | Notebook | Thème |
|---|----------|-------|
| 01 | [notebooks/01-fondamentaux-azure-paas.ipynb](notebooks/01-fondamentaux-azure-paas.ipynb) | Concepts cloud (IaaS/PaaS/SaaS), bases de l'IA (ML/DL/GenAI), Azure CLI, déploiement **App Service** + **Microsoft Foundry** |
| 02 | [notebooks/02-foundry-agent-playground.ipynb](notebooks/02-foundry-agent-playground.ipynb) | Qu'est-ce qu'un agent IA, 3 types d'agents Foundry (prompt / workflow / hosted), déployer un modèle, **Chat playground**, créer un **prompt agent** + outil custom, créer un **workflow** Sequential dans le visual designer |
| 03 | [notebooks/03-projet-devops-agile.ipynb](notebooks/03-projet-devops-agile.ipynb) | Projet, **DevOps**, **Agile/Scrum**, collaboration : sprints, PR, CI/CD, SRE, avec 3 mises en situation concrètes |
| 04 | [notebooks/04-architecture-web.ipynb](notebooks/04-architecture-web.ipynb) | Architecture web : client/serveur, **API REST/GraphQL/gRPC/WebSocket**, SPA/SSR/static, monolithe/microservices/serverless, CDN, load balancer, BFF |
| 05 | [notebooks/05-securite-cloud.ipynb](notebooks/05-securite-cloud.ipynb) | Sécurité cloud (survol) : **Entra ID**, **RBAC**, **Managed Identity**, **Key Vault**, réseau, Defender for Cloud, sécurité spécifique IA |
| 06 | [notebooks/06-monitoring-et-evaluation.ipynb](notebooks/06-monitoring-et-evaluation.ipynb) | Application Insights, OpenTelemetry, KQL, tracing des agents et **évaluation** (à compléter) |
| 07 | [notebooks/07-docker-container-apps.ipynb](notebooks/07-docker-container-apps.ipynb) | Docker, containers, registries (ACR), **Azure Container Apps** (Apps & Jobs, KEDA) |
| 08 | [notebooks/08-bicep-iac.ipynb](notebooks/08-bicep-iac.ipynb) | **Bicep & Infrastructure as Code** : concepts, exemples, déploiement d'une ressource + **cleanup final du parcours** |

---

## 🎯 Après la formation — le projet `mailroom-ia`

Une fois les notebooks 01-07 complétés, direction `projet/mailroom-ia/` :
1. Lire [SPEC.md](projet/mailroom-ia/SPEC.md) et [DESIGN.md](projet/mailroom-ia/DESIGN.md)
2. Dérouler [setup.ipynb](projet/mailroom-ia/setup.ipynb) qui provisionne tout en 2 passes Bicep + build images + déploiement ACA

---

## 💰 Coûts & règles à respecter

- Les ressources créées utilisent autant que possible des SKU **gratuits** (`F1`) ou **bas coût** (`S0` pour Foundry, facturé à l'usage).
- **Vous ne supprimez JAMAIS le Resource Group** — il appartient à votre équipe. Si vous lancez `az group delete`, vous risquez d'effacer le travail des autres.
- À la fin de chaque session, exécutez la cellule **🧹 Nettoyage** pour supprimer **vos** ressources individuelles.
- Les déploiements de modèles Foundry sont facturés **au token** : pas de frais récurrents tant que personne ne les appelle.

---

## 🆘 Besoin d'aide ?

- **`az login` ne marche pas** → essayez `az login --use-device-code`.
- **« No subscriptions found »** → demandez à votre encadrant qu'on vous donne accès à un abonnement.
- **« AuthorizationFailed » sur une ressource** → vérifiez que vous êtes bien Owner sur le RG :  
  ```bash
  az role assignment list --scope $(az group show --name <RG> --query id -o tsv) \
                          --assignee $(az ad signed-in-user show --query id -o tsv) -o table
  ```
- **`pip install` est lent** → c'est normal la première fois (~2 min). Patience.
- **Un notebook plante** → relisez le message d'erreur, vérifiez les variables en haut, et n'hésitez pas à demander.

📚 Documentation officielle :
- Azure CLI : https://learn.microsoft.com/cli/azure/
- Microsoft Foundry : https://learn.microsoft.com/azure/foundry/
- Parcours débutant **AZ-900** : https://learn.microsoft.com/training/paths/microsoft-azure-fundamentals-describe-cloud-concepts/
- Parcours débutant **AI-900** : https://learn.microsoft.com/training/paths/get-started-with-artificial-intelligence-on-azure/
