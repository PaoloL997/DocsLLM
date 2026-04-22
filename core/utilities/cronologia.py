"""Cronologia API — retrieve conversational memory (Q&A) from Milvus."""

import logging

from django.http import JsonResponse

from .files import _load_config, _connect_milvus

logger = logging.getLogger(__name__)

MEMORY_DB = "memory"
QUERY_PREFIX = "QUERY: "
RESPONSE_SEP = "\nRESPONSE: "
MAX_QUERY_LIMIT = 16384


def _parse_qa(text: str) -> tuple[str, str] | None:
    """Parse a memory document text into (query, response).

    Args:
        text: Stored page_content in the format "QUERY: ...\\nRESPONSE: ...".

    Returns:
        Tuple (query, response) or None if parsing fails.
    """
    if not text or not text.startswith(QUERY_PREFIX):
        return None
    sep_idx = text.find(RESPONSE_SEP)
    if sep_idx == -1:
        return None
    query = text[len(QUERY_PREFIX):sep_idx].strip()
    response = text[sep_idx + len(RESPONSE_SEP):].strip()
    return query, response


def _extract_notebook_user(collection_name: str, commessa: str) -> tuple[str, str]:
    """Extract notebook and username from a memory collection name.

    Collection naming convention: ``comm_{commessa}_{notebook}_{username}``.

    Args:
        collection_name: Full Milvus collection name.
        commessa: Commessa identifier to strip from the prefix.

    Returns:
        Tuple (notebook, username). The notebook may contain underscores; the
        username is always the last segment.
    """
    prefix = f"comm_{commessa}_"
    remainder = collection_name[len(prefix):] if collection_name.startswith(prefix) else collection_name
    parts = remainder.rsplit("_", 1)
    if len(parts) == 2:
        return parts[0], parts[1]
    return remainder, ""


def get_cronologia(request, commessa: str):
    """Return all Q&A pairs stored in memory for a given commessa.

    Iterates all collections in the Milvus ``memory`` database whose names
    start with ``comm_{commessa}_``, extracts Q&A pairs and returns them as
    a single flat list ordered by ``pk`` descending (most recent first).

    Args:
        request: Django HTTP request.
        commessa: Commessa identifier (URL path parameter).

    Returns:
        JsonResponse with ``{commessa, items: [{pk, notebook, user, query, response}]}``.
    """
    commessa = (commessa or "").strip()
    if not commessa:
        return JsonResponse({"error": "Commessa richiesta"}, status=400)

    try:
        from pymilvus import Collection, db, utility

        config = _load_config()
        uri = config.get("uri")
        if not uri:
            return JsonResponse({"error": "URI non configurato"}, status=500)

        _connect_milvus(uri)

        if MEMORY_DB not in db.list_database():
            return JsonResponse({"commessa": commessa, "items": []})

        db.using_database(MEMORY_DB)
        prefix = f"comm_{commessa}_"
        collections = [c for c in utility.list_collections() if c.startswith(prefix)]

        items: list[dict] = []
        for coll_name in collections:
            notebook, user = _extract_notebook_user(coll_name, commessa)
            try:
                coll = Collection(coll_name)
                coll.load()
                rows = coll.query(
                    expr="pk >= 0",
                    output_fields=["pk", "text"],
                    limit=MAX_QUERY_LIMIT,
                )
            except Exception as exc:
                logger.warning("Errore lettura collection %s: %s", coll_name, exc)
                continue

            for row in rows:
                parsed = _parse_qa(row.get("text", ""))
                if not parsed:
                    continue
                query_text, response_text = parsed
                items.append({
                    "pk": row.get("pk"),
                    "notebook": notebook,
                    "user": user,
                    "query": query_text,
                    "response": response_text,
                })

        items.sort(key=lambda x: x.get("pk") or 0, reverse=True)

        return JsonResponse({"commessa": commessa, "items": items})

    except FileNotFoundError as exc:
        return JsonResponse({"error": str(exc)}, status=500)
    except Exception as exc:
        logger.exception("Errore nel recupero cronologia")
        return JsonResponse({"error": str(exc)}, status=500)
