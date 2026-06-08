from __future__ import annotations

from azure.ai.projects.aio import AIProjectClient
from azure.identity.aio import DefaultAzureCredential

from worker.domain.models import ClassificationOutput

SYSTEM_PROMPT_TEMPLATE = """Tu es un assistant de tri de courriers physiques scannés.

Tu reçois le texte OCRisé d'un document et tu dois identifier :
1. Le client destinataire (parmi la liste fournie)
2. La catégorie et sous-catégorie du document

Catégories autorisées (catégorie / sous-catégories) :
- factures : <année> (4 chiffres, ex: 2026)
- contrats : assurance, bancaire, telecom, autre
- avis-officiels : impots, caf, prefecture, tribunal, autre
- courriers : medical, professionnel, autre
- autres : (pas de sous-catégorie, laisse null)

Liste des clients connus (id : nom) :
{clients_list}

RÈGLES :
- Si tu n'es PAS sûr du client, retourne client_id = null
- Si tu n'es PAS sûr de la catégorie, retourne category = "autres"
- La confidence doit refléter ta vraie certitude (0.0 à 1.0)
- En cas de doute, baisse la confidence — le doc sera revu manuellement
- reasoning : 1-2 phrases en français maximum
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

    async def classify(self, ocr_text: str, clients_list: str) -> ClassificationOutput:
        openai = self._project.get_openai_client()
        completion = await openai.beta.chat.completions.parse(
            model=self._model,
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT_TEMPLATE.format(clients_list=clients_list),
                },
                {"role": "user", "content": ocr_text[:8000]},
            ],
            response_format=ClassificationOutput,
        )
        parsed = completion.choices[0].message.parsed
        if parsed is None:
            raise RuntimeError("Le LLM n'a pas renvoyé un output parseable.")
        return parsed
