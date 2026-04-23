import json
import logging
import os
import yaml
from pathlib import Path

from celery import shared_task
from django.conf import settings

from services.milvus_compat import apply as _apply_milvus_patch

_apply_milvus_patch()
logger = logging.getLogger(__name__)


@shared_task
def process_collection(collection_task_id: int) -> dict:
    """Process all files in a CollectionTask sequentially.

    For each file path:
      1. Extract documents with DucklingGraph
      2. Add them to the Milvus Store via graphrag
    Finally set the CollectionTask status to 'ready' or 'error'.

    Args:
        collection_task_id: PK of the CollectionTask to process.

    Returns:
        Dict with ``collection_task_id`` and final ``status``.
    """
    from core.models import CollectionTask

    try:
        ct = CollectionTask.objects.get(id=collection_task_id)
    except CollectionTask.DoesNotExist:
        logger.error("CollectionTask %s non trovata", collection_task_id)
        return {'error': f'CollectionTask {collection_task_id} non trovata'}

    ct.status = 'processing'
    ct.save(update_fields=['status'])

    has_error = False

    try:
        config_path = os.path.join(settings.BASE_DIR, 'config.yaml')
        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)

        uri = config['uri']
        db_name = f"comm_{ct.commessa}"
        collection_name = ct.collection_name
        embedding_model = config.get('embedding_model')

        from graphrag.store.store import Store

        store = Store(
            uri=uri,
            database=db_name,
            collection=collection_name,
            embedding_model=embedding_model,
        )

        if ct.files:
            _update_collection_files(uri, db_name, collection_name, ct.files)

        from duckling.graph import DucklingGraph

        for file_path in ct.files:
            try:
                filename = Path(file_path).stem
                if filename != filename.strip():
                    logger.warning(
                        "Il file '%s' contiene spazi iniziali o finali nel nome: "
                        "il processing potrebbe fallire su Windows. "
                        "Rinomina il file rimuovendo gli spazi.",
                        file_path,
                    )
                result = DucklingGraph().run(file_path, namespace=filename)
                documents = result.get('documents', [])

                if not documents:
                    logger.warning("Nessun documento estratto da %s", file_path)
                else:
                    store.add(documents)
                    logger.info("File %s indicizzato con successo", file_path)

                from django.db.models import F
                CollectionTask.objects.filter(id=ct.id).update(files_done=F('files_done') + 1)

            except Exception:
                logger.exception("Errore processing file %s", file_path)
                has_error = True

    except Exception:
        logger.exception("Errore fatale nella CollectionTask %s", collection_task_id)
        has_error = True

    ct.status = 'error' if has_error else 'ready'
    ct.save(update_fields=['status'])
    return {'collection_task_id': collection_task_id, 'status': ct.status}


@shared_task
def generate_report_task(report_id: int) -> dict:
    """Run all queries of a Report through the GraphRAG agent, saving Q/A + references.

    A random user_id is generated so the agent refinement pipeline works
    correctly. This also means Q/A pairs end up in Milvus ``memory`` and
    are visible in Cronologia.

    Args:
        report_id: PK of the Report to process.

    Returns:
        Dict with ``report_id`` and final ``status``.
    """
    import uuid

    from core.models import Report, ReportItem

    try:
        rpt = Report.objects.get(id=report_id)
    except Report.DoesNotExist:
        logger.error("Report %s non trovato", report_id)
        return {'error': f'Report {report_id} non trovato'}

    rpt.status = 'processing'
    rpt.save(update_fields=['status'])

    has_error = False

    try:
        config_path = os.path.join(settings.BASE_DIR, 'config.yaml')
        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)

        from services.agent import Agent
        from graphrag.store.store import Store

        mode_cfg = Agent.MODES.get(rpt.mode, {})
        k_value = mode_cfg.get('k', 5)

        store = Store(
            uri=config.get('uri'),
            database=f"comm_{rpt.commessa}",
            collection=rpt.collection_name,
            k=k_value,
            embedding_model=config.get('embedding_model'),
        )
        agent = Agent(store=store, mode=rpt.mode, rerank=True)

        # user_id is used verbatim by graphRAG as the memory collection name.
        # Match the pattern used in send_message: comm_{commessa}_{collection}_{uid}
        user_id = f"comm_{rpt.commessa}_{rpt.collection_name}_report{rpt.id}{uuid.uuid4().hex[:6]}"

        for item in rpt.items.order_by('order'):
            try:
                final_state = agent.invoke(item.query, user_id=user_id)
                response = final_state.get('response', '')
                if isinstance(response, dict):
                    response = response.get('response', '') or str(response)
                context = final_state.get('context') or []

                references = []
                for doc in context:
                    meta = (
                        doc.get('metadata', {})
                        if isinstance(doc, dict)
                        else (getattr(doc, 'metadata', {}) or {})
                    ) or {}
                    references.append({
                        'name': meta.get('name') or meta.get('source') or meta.get('filename') or 'unknown',
                        'page_start': meta.get('page_start'),
                        'page_end': meta.get('page_end'),
                    })

                item.response = str(response)
                item.references = references
                item.save(update_fields=['response', 'references'])

                from django.db.models import F
                Report.objects.filter(id=rpt.id).update(done_queries=F('done_queries') + 1)

            except Exception:
                logger.exception("Errore processing query report %s item %s", rpt.id, item.id)
                has_error = True

    except Exception as exc:
        logger.exception("Errore fatale nel Report %s", report_id)
        rpt.error_message = str(exc)
        rpt.save(update_fields=['error_message'])
        has_error = True

    rpt.status = 'error' if has_error else 'ready'
    rpt.save(update_fields=['status'])
    return {'report_id': report_id, 'status': rpt.status}


def _update_collection_files(uri: str, db_name: str, collection_name: str, new_files: list) -> None:
    """Merge new_files into the Milvus collection's ``files`` property.

    Args:
        uri: Milvus HTTP URI.
        db_name: Target Milvus database name.
        collection_name: Target collection.
        new_files: Absolute paths of files being indexed in this task.
    """
    try:
        from pymilvus import Collection, connections, db as milvus_db

        host = uri.split('://')[1].split(':')[0]
        port = int(uri.split(':')[-1])
        connections.connect(host=host, port=port)
        milvus_db.using_database(db_name)

        coll = Collection(collection_name)
        props = coll.describe().get('properties', {})
        existing = json.loads(props.get('files', '[]'))

        merged = list({*existing, *new_files})
        coll.set_properties({'files': json.dumps(merged)})
    except Exception:
        logger.warning(
            "Impossibile aggiornare la proprietà 'files' sulla collection %s",
            collection_name,
            exc_info=True,
        )
