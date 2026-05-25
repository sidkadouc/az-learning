# Parcours de formation - Plateforme IA & Cloud

Bienvenue ! Ce dépôt contient une série de notebooks pratiques pour découvrir progressivement le cloud Azure et la plateforme IA Microsoft Foundry.

## Public visé

Stagiaire ou débutant souhaitant apprendre à manipuler Azure et les services IA depuis zéro. Aucun prérequis cloud n'est nécessaire, juste un peu de Python.

## Pré-requis techniques

- Un abonnement Azure (un compte gratuit suffit pour démarrer : https://azure.microsoft.com/free/)
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) version **≥ 2.86** (`az upgrade` pour mettre à jour)
- Python **≥ 3.11** (3.13 recommandé, c'est la version utilisée pour l'App Service déployé dans le notebook 01)
- VS Code avec l'extension Jupyter
- Optionnel : extension [Azure Tools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-node-azure-pack)

### Installer les SDK Python

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Les versions des SDK Azure utilisées sont **épinglées aux dernières stables** vérifiées sur PyPI (mai 2026) dans [requirements.txt](requirements.txt).

## Parcours

| # | Notebook | Thème |
|---|----------|-------|
| 01 | [notebooks/01-fondamentaux-azure-paas.ipynb](notebooks/01-fondamentaux-azure-paas.ipynb) | Concepts cloud (IaaS/PaaS/SaaS), bases de l'IA (ML/DL/GenAI), Azure CLI, déploiement App Service + Microsoft Foundry |
| 02 | [notebooks/02-monitoring-application-insights.ipynb](notebooks/02-monitoring-application-insights.ipynb) | Observabilité : Azure Monitor, Log Analytics, Application Insights, OpenTelemetry, premières requêtes KQL |
| 03 | *à venir* | Identité, RBAC, Managed Identity, Key Vault |
| 04 | *à venir* | Déploiement d'un modèle + agent IA sur Microsoft Foundry (avec tracing dans App Insights) |
| 05 | *à venir* | Infrastructure as Code avec Bicep |
| 06 | *à venir* | Évaluation des agents Foundry |

## Convention

- Chaque notebook est **autonome** et peut être ré-exécuté.
- Chaque notebook se termine par une section **Nettoyage** pour supprimer les ressources et éviter les coûts.
- Les variables (nom de Resource Group, région, etc.) sont définies en haut du notebook : adaptez-les à votre environnement.

## Coûts

Les ressources créées dans ce parcours utilisent autant que possible des SKU gratuits ou très bas coût (`F1`, `S0`). Pensez **toujours** à exécuter la cellule de nettoyage à la fin de votre session.
