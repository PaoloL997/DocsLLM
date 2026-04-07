"""Utilities for the Ricerca (document search) page.

Manages a per-session Store with high-k for broad similarity search
and exposes an API endpoint to query it.
"""

import json
import os
import traceback

import yaml
from django.conf import settings
from django.http import JsonResponse

from graphrag.store.store import Store

# Per-session search store cache: session_key -> Store
SEARCH_STORES: dict[str, Store] = {}


def _load_config() -> dict:
    """Load the project YAML configuration.

    Returns:
        Parsed config dictionary.

    Raises:
        FileNotFoundError: If config.yaml is missing.
    """
    config_path = os.path.join(settings.BASE_DIR, 'config.yaml')
    if not os.path.exists(config_path):
        raise FileNotFoundError('Configuration file not found')
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def initialize_search_store(request):
    """POST JSON: { commessa, collection_name } — create a Store with k=50.

    Args:
        request: Django HTTP request.

    Returns:
        JsonResponse with success status.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
        commessa = data.get('commessa', '').strip()
        collection_name = data.get('collection_name', '').strip()

        if not commessa or not collection_name:
            return JsonResponse(
                {'error': 'Commessa e collection sono obbligatori'},
                status=400,
            )

        config = _load_config()
        db_name = f"comm_{commessa}"

        store = Store(
            uri=config['uri'],
            database=db_name,
            collection=collection_name,
            k=50,
            embedding_model=config.get('embedding_model'),
        )

        if not request.session.session_key:
            request.session.create()

        SEARCH_STORES[request.session.session_key] = store

        return JsonResponse({
            'success': True,
            'commessa': commessa,
            'collection': collection_name,
        })

    except FileNotFoundError as exc:
        return JsonResponse({'error': str(exc)}, status=500)
    except Exception:
        traceback.print_exc()
        return JsonResponse(
            {'error': 'Errore durante l\'inizializzazione dello store di ricerca.'},
            status=500,
        )


def search_documents(request):
    """POST JSON: { query } — run similarity search and return scored results.

    Args:
        request: Django HTTP request.

    Returns:
        JsonResponse with a list of search results, each containing
        content, metadata, and similarity score.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
        query = data.get('query', '').strip()

        if not query:
            return JsonResponse({'results': []})

        session_key = request.session.session_key
        store = SEARCH_STORES.get(session_key)

        if not store:
            return JsonResponse(
                {'error': 'Nessuno store attivo. Seleziona una commessa e un notebook.'},
                status=400,
            )

        raw_results = store.retrieve(query, score=True)

        results = _format_results(raw_results)

        return JsonResponse({'success': True, 'results': results})

    except Exception:
        traceback.print_exc()
        return JsonResponse(
            {'error': 'Errore durante la ricerca.'},
            status=500,
        )


def _format_results(raw_results: list) -> list[dict]:
    """Convert Store retrieve results into JSON-serializable dicts.

    Args:
        raw_results: List of (Document, score) tuples from Store.retrieve.

    Returns:
        List of dicts with content, metadata, and score.
    """
    results = []
    for doc, score in raw_results:
        meta = getattr(doc, 'metadata', {})
        if not isinstance(meta, dict):
            meta = {}

        # Skip placeholder documents
        if meta.get('namespace') == '__init__':
            continue

        results.append({
            'content': doc.page_content[:500],
            'name': meta.get('name', 'Documento'),
            'namespace': meta.get('namespace', ''),
            'type': meta.get('type', 'text'),
            'path': meta.get('path', ''),
            'page_start': meta.get('page_start'),
            'page_end': meta.get('page_end'),
            'score': round(float(score), 4),
            'metadata': meta,
        })

    return results
