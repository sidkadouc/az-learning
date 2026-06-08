from __future__ import annotations

from azure.ai.projects.aio import AIProjectClient
from azure.identity.aio import DefaultAzureCredential

from worker.domain.models import ClassificationOutput

SYSTEM_PROMPT_TEMPLATE = """Tu es un assistant de tri de courriers physiques scannés.

Tu reçois le texte OCRisé d'un document et tu dois identifier :
1. Le destinataire du courrier (Nom Prénom ou raison sociale), en TOUJOURS le retournant dans `detected_recipient_name` quand un destinataire est visible — même s'il n'est pas dans la liste des clients connus.
2. Le `client_id` correspondant — UNIQUEMENT si le destinataire détecté correspond clairement à un client de la liste ci-dessous. Sinon, `client_id = null`.
3. La catégorie et sous-catégorie du document.
4. Le dossier cible (`target_folder`) dans l'arborescence du client.

## Catégories autorisées (catégorie / sous-catégories) :
- factures : <année> (4 chiffres, ex: 2026)
- contrats : assurance, bancaire, telecom, autre
- avis-officiels : impots, caf, prefecture, tribunal, autre
- courriers : medical, professionnel, autre
- autres : (pas de sous-catégorie, laisse null)

## Liste des clients connus (id : nom) :
{clients_list}

## Structure actuelle du stockage :
{storage_tree}

## RÈGLES :
- `detected_recipient_name` : essaie TOUJOURS de remplir ce champ (ex: "Jean Dupont", "SARL Martin & Fils"). Mets `null` UNIQUEMENT si aucun destinataire n'est lisible.
- `client_id` : retourne l'id EXACT d'un client de la liste si le destinataire détecté correspond sans ambiguïté. Sinon `null`.
- `target_folder` : chemin RELATIF du dossier cible sous `clients/<clientId>/`. Exemples : `contrats/assurance`, `factures/2026`, `courriers/medical`.
  - Regarde la structure existante ci-dessus. Si un dossier existant correspond, RÉUTILISE-LE (même path exact).
  - Sinon, propose un nouveau chemin cohérent avec la catégorie/sous-catégorie.
  - Le chemin NE doit PAS contenir `clients/` ni le clientId — juste la partie après.
- Si tu n'es PAS sûr de la catégorie, retourne category = "autres".
- La confidence doit refléter ta vraie certitude (0.0 à 1.0). Un destinataire détecté mais non matché en base = confidence ≤ 0.5.
- En cas de doute, baisse la confidence — le doc sera revu manuellement.
- reasoning : 1-2 phrases en français maximum, explique pourquoi tu as choisi ce client et ce dossier.
"""


class FoundryClassifier:
    """Appelle le LLM Foundry avec output structuré Pydantic."""

    def __init__(
        self,
        project_endpoint: str,
        model_deployment: str,
        credential: DefaultAzureCredential,
    ):
        self._project = AIProjectClient(endpoint=project_endpoint, credential=credential)
        self._model = model_deployment

    async def close(self) -> None:
        await self._project.close()

    async def classify(
        self,
        ocr_text: str,
        clients_list: str,
        storage_tree: str = "(structure non disponible)",
    ) -> ClassificationOutput:
        openai = self._project.get_openai_client()
        completion = await openai.beta.chat.completions.parse(
            model=self._model,
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT_TEMPLATE.format(
                        clients_list=clients_list,
                        storage_tree=storage_tree,
                    ),
                },
                {"role": "user", "content": ocr_text[:8000]},
            ],
            response_format=ClassificationOutput,
        )
        parsed = completion.choices[0].message.parsed
        if parsed is None:
            raise RuntimeError("Le LLM n'a pas renvoyé un output parseable.")
        return parsed
