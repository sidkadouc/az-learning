---
description: Python — typage strict (mypy), SOLID, conception orientée objet, qualité de code (ruff, tests).
applyTo: "**/*.py"
---

# Python — qualité, typage, SOLID

## Outillage standard (à mettre dans `pyproject.toml`)

```toml
[tool.ruff]
line-length = 100
target-version = "py313"

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP", "N", "SIM", "RUF"]

[tool.mypy]
strict = true
python_version = "3.13"
warn_return_any = true
warn_unused_ignores = true
disallow_untyped_decorators = true

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

## Typage — règles strictes

1. **Toute** fonction publique est typée : paramètres + retour.
2. `Any` interdit sauf justification commentée (`# type: ignore[arg-type]  # raison`).
3. Préférer les types modernes Python 3.13 :
   - `list[int]` plutôt que `List[int]`
   - `dict[str, X]` plutôt que `Dict[str, X]`
   - `X | None` plutôt que `Optional[X]`
   - `X | Y` plutôt que `Union[X, Y]`
4. **`Protocol`** pour le duck typing structurel (interfaces sans héritage).
5. **`TypedDict`** pour les dicts à shape fixe (JSON externes).
6. **`Literal`** et **`Enum`** pour les ensembles finis de valeurs.
7. **Generics** quand on a un container ou un wrapper typé : `class Repository[T]:` (syntaxe PEP 695).

```python
from typing import Protocol

class Classifier(Protocol):
    async def classify(self, text: str) -> tuple[str, float]: ...


class FoundryClassifier:
    async def classify(self, text: str) -> tuple[str, float]:
        ...

# usage : on dépend du Protocol, pas de l'implémentation
async def process(doc: str, classifier: Classifier) -> None:
    label, conf = await classifier.classify(doc)
    ...
```

## SOLID — application concrète

### S — Single Responsibility
- Une classe = **une raison de changer**.
- Si tu écris "et" dans le docstring (*"cette classe gère X **et** Y"*), c'est qu'il faut splitter.

### O — Open/Closed
- Ouvert à l'extension, fermé à la modification.
- Concrètement : préférer la **composition** et les **Protocols** à l'héritage. Ajouter une stratégie = ajouter une classe, pas modifier les existantes.

### L — Liskov Substitution
- Une sous-classe doit pouvoir remplacer sa parent sans casser le code appelant.
- Si on a besoin de `isinstance(x, SubClass)` pour faire un cas spécial, le design est faux.

### I — Interface Segregation
- Préférer plusieurs **petits Protocols** ciblés à un gros Protocol fourre-tout.
- Le client ne doit pas dépendre de méthodes qu'il n'utilise pas.

### D — Dependency Inversion
- Le code de haut niveau dépend d'**abstractions** (Protocols), pas d'implémentations concrètes.
- Injection par constructeur ou par paramètre, pas de `import` direct d'une classe concrète dans la logique métier.

```python
# ❌ Mauvais — dépendance dure
class DocumentService:
    def __init__(self) -> None:
        self.cosmos = CosmosClient(...)  # couplage direct

# ✅ Bon — dépendance inversée
class DocumentService:
    def __init__(self, repository: DocumentRepository) -> None:
        self._repo = repository
```

## Conception orientée objet — règles

### Ce qu'on FAIT
- **`@dataclass(frozen=True, slots=True)`** pour les value objects immuables.
- **Pydantic models** pour les DTOs (entrées/sorties HTTP, JSON externes).
- **Classes** quand on a un comportement + état lié.
- **Méthodes courtes** : < 20 lignes en règle générale. Si plus long, extraire.
- **Composition > héritage**. Héritage uniquement pour vrai polymorphisme ou réutilisation de comportement fort.

### Ce qu'on ÉVITE
- ❌ Classes "utility" avec uniquement des `@staticmethod` → utiliser un module avec des fonctions.
- ❌ Classes avec un seul `__init__` + une seule méthode publique → souvent une fonction suffit.
- ❌ Setters / getters pour exposer un attribut — utiliser l'attribut directement (`@property` seulement si calcul réel).
- ❌ Héritage multiple sauf vrai cas de mixin.
- ❌ Variables globales mutables.
- ❌ Singletons "à la Java" — préférer l'injection ou le pattern modulaire Python.

## Functions vs classes — comment choisir

| Cas | Choix |
|-----|-------|
| Transformation pure d'une entrée vers une sortie | **Fonction** |
| Pipeline d'étapes sans état partagé | **Fonctions composées** |
| Comportement + état + cycle de vie | **Classe** |
| Plusieurs implémentations interchangeables | **Protocol + classes** |
| Configuration paramétrée à l'instanciation | **Classe avec `__init__`** |
| Cache, connexion, ressource limitée | **Classe avec gestion de ressource** |

## Gestion des erreurs

- **Exceptions custom** dans `domain/errors.py` pour les erreurs métier.
- **Jamais** `except Exception: pass`.
- **Jamais** `except:` (bare except).
- Re-raise avec contexte : `raise NewError("contexte") from original_error`.
- Logger AVANT de raiser : `logger.warning("message", extra={"doc_id": x}); raise ...`.

## Modules & imports

- Imports triés par `ruff` (`isort` integré, ordre : stdlib → third-party → local).
- Imports absolus, pas de `from . import x` sauf dans `__init__.py`.
- Pas de `from x import *`.
- **Cycles d'import = bug d'archi**, refactorer plutôt que `if TYPE_CHECKING`.

## Tests

- **pytest** uniquement. Pas d'`unittest`.
- Convention de nommage : `test_<fonction>_<scenario>_<résultat>`.
  - Ex. `test_classify_with_low_confidence_returns_needs_review`
- **Arrange / Act / Assert** clairement séparés par des lignes vides.
- **1 assertion logique par test** (pas une seule `assert`, mais une seule chose à vérifier).
- **Fixtures** pour partager le setup, pas de classes de test.
- **Fakes > Mocks** : préférer une vraie implémentation in-memory à un mock.

## Documentation

- **Docstrings** sur les fonctions/classes publiques de bibliothèque.
- Format : **Google style** (sections `Args:`, `Returns:`, `Raises:`).
- **Pas** de docstring qui paraphrase le code. Documenter le **pourquoi**, les invariants, les pièges.
- Un module qui mérite une explication d'architecture → un `README.md` à côté.

## Ce qu'il NE FAUT PAS faire (anti-patterns courants)

- ❌ `from typing import List, Dict, Optional` — utiliser `list`, `dict`, `| None`
- ❌ Méthode qui prend `**kwargs` sans type → être explicite
- ❌ Mutation d'un default argument (`def f(x=[]):`) → utiliser `None` puis `if x is None: x = []`
- ❌ `assert` pour valider des inputs utilisateur (asserts sont désactivés en `python -O`)
- ❌ Classe `God object` qui fait tout
- ❌ Couplage temporel : *"il faut appeler `init()` avant `process()`"* — soit le constructeur le garantit, soit context manager
