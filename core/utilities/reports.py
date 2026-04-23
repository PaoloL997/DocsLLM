"""Report views: async creation via Celery, listing, status, delete."""
import io
import json
import logging

import pandas as pd
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

logger = logging.getLogger(__name__)


def create_report(request):
    """Create a Report and dispatch the Celery task.

    POST multipart/form-data with:
      - ``commessa``, ``collection``, ``report_name``, ``mode``
      - ``file``: xlsx with a ``query`` (or ``queries``) column.

    Returns:
        JSON with the created report info (202 Accepted) or an error.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    commessa = (request.POST.get('commessa') or '').strip()
    collection = (request.POST.get('collection') or '').strip()
    report_name = (request.POST.get('report_name') or '').strip()
    mode = (request.POST.get('mode') or 'veloce').strip().lower()

    if not commessa or not collection or not report_name:
        return JsonResponse({'error': 'commessa, collection e report_name sono obbligatori'}, status=400)

    if mode not in ('veloce', 'ragionamento'):
        return JsonResponse({'error': "mode deve essere 'veloce' o 'ragionamento'"}, status=400)

    if 'file' not in request.FILES:
        return JsonResponse({'error': 'File Excel richiesto'}, status=400)

    try:
        df = pd.read_excel(io.BytesIO(request.FILES['file'].read()))
    except Exception as exc:
        return JsonResponse({'error': f'Impossibile leggere il file Excel: {exc}'}, status=400)

    col = None
    for candidate in ('query', 'queries', 'Query', 'Queries', 'domanda', 'Domanda'):
        if candidate in df.columns:
            col = candidate
            break
    if col is None:
        return JsonResponse({'error': "Il file Excel deve contenere una colonna 'query'"}, status=400)

    queries = [str(q).strip() for q in df[col].tolist() if pd.notna(q) and str(q).strip()]
    if not queries:
        return JsonResponse({'error': 'Nessuna query trovata nel file'}, status=400)

    from core.models import Report, ReportItem
    from services.process import generate_report_task

    try:
        with transaction.atomic():
            rpt = Report.objects.create(
                commessa=commessa,
                collection_name=collection,
                report_name=report_name,
                mode=mode,
                total_queries=len(queries),
                created_by=request.user if request.user.is_authenticated else None,
            )
            ReportItem.objects.bulk_create([
                ReportItem(report=rpt, order=i, query=q)
                for i, q in enumerate(queries)
            ])
    except IntegrityError:
        return JsonResponse(
            {'error': f"Esiste già un report con nome '{report_name}' per questa collection."},
            status=409,
        )

    try:
        result = generate_report_task.delay(rpt.id)
        rpt.task_id = result.id
        rpt.save(update_fields=['task_id'])
    except Exception:
        logger.exception("Impossibile dispatchare generate_report_task per report %s", rpt.id)
        rpt.status = 'error'
        rpt.error_message = 'Impossibile avviare il task Celery'
        rpt.save(update_fields=['status', 'error_message'])
        return JsonResponse({'error': 'Impossibile avviare il task in background'}, status=500)

    return JsonResponse({
        'success': True,
        'report': _serialize_report(rpt),
    }, status=202)


def list_reports(request):
    """GET params: commessa, collection — list reports for that pair.

    Returns:
        JSON with ``reports`` (list) including items of ``ready`` reports.
    """
    commessa = (request.GET.get('commessa') or '').strip()
    collection = (request.GET.get('collection') or '').strip()
    if not commessa or not collection:
        return JsonResponse({'error': 'commessa e collection sono obbligatori'}, status=400)

    from core.models import Report

    reports = (
        Report.objects
        .filter(commessa=commessa, collection_name=collection)
        .order_by('-created_at')
    )
    return JsonResponse({
        'reports': [_serialize_report(r) for r in reports],
    })


def report_status(request):
    """GET param: id — return the current progress/status of a Report.

    Pass ``items=1`` to include Q/A items in the response.
    """
    rid = request.GET.get('id')
    if not rid:
        return JsonResponse({'error': 'id richiesto'}, status=400)

    from core.models import Report

    include_items = request.GET.get('items') == '1'
    try:
        rpt = Report.objects.prefetch_related('items').get(id=rid) if include_items else Report.objects.get(id=rid)
    except Report.DoesNotExist:
        return JsonResponse({'status': 'none'})

    return JsonResponse(_serialize_report(rpt, include_items=include_items))


def active_report_tasks(request):
    """Return all Report tasks still pending or processing."""
    from core.models import Report

    reports = Report.objects.filter(status__in=['pending', 'processing'])
    return JsonResponse({
        'tasks': [_serialize_report(r) for r in reports],
    })


@require_http_methods(['DELETE', 'POST'])
def delete_report(request):
    """Delete a report. Accepts DELETE or POST with ``id``."""
    rid = None
    if request.method == 'DELETE':
        rid = request.GET.get('id')
    else:
        try:
            data = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            data = {}
        rid = data.get('id') or request.POST.get('id')

    if not rid:
        return JsonResponse({'error': 'id richiesto'}, status=400)

    from core.models import Report

    deleted, _ = Report.objects.filter(id=rid).delete()
    if not deleted:
        return JsonResponse({'error': 'Report non trovato'}, status=404)
    return JsonResponse({'success': True})


def export_report(request):
    """Export a ready Report as an .xlsx file.

    Args:
        request: GET with ``id`` query param.

    Returns:
        An xlsx file download response.
    """
    rid = request.GET.get('id')
    if not rid:
        return JsonResponse({'error': 'id richiesto'}, status=400)

    from core.models import Report

    try:
        rpt = Report.objects.prefetch_related('items').get(id=rid)
    except Report.DoesNotExist:
        return JsonResponse({'error': 'Report non trovato'}, status=404)

    from django.http import HttpResponse

    def _fmt_refs(refs: list) -> str:
        if not refs:
            return ''
        parts = []
        for r in refs:
            name = r.get('name', 'unknown')
            p_start = r.get('page_start')
            p_end = r.get('page_end')
            if p_start is not None and p_end is not None and p_start != p_end:
                parts.append(f"{name} · pp. {p_start}-{p_end}")
            elif p_start is not None:
                parts.append(f"{name} · p. {p_start}")
            else:
                parts.append(name)
        return '\n'.join(parts)

    rows = [
        {
            '#': item.order + 1,
            'Domanda': item.query,
            'Risposta': item.response,
            'Fonti': _fmt_refs(item.references or []),
        }
        for item in rpt.items.all()
    ]
    df = pd.DataFrame(rows, columns=['#', 'Domanda', 'Risposta', 'Fonti'])

    buf = io.BytesIO()
    df.to_excel(buf, index=False)
    buf.seek(0)

    safe_name = rpt.report_name.replace('"', '_')
    response = HttpResponse(
        buf.read(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    response['Content-Disposition'] = f'attachment; filename="{safe_name}.xlsx"'
    return response


def _serialize_report(rpt, include_items: bool = False) -> dict:
    """Serialize a Report for JSON output.

    Args:
        rpt: Report instance.
        include_items: If True, embed all ReportItem rows.
    """
    data = {
        'id': rpt.id,
        'commessa': rpt.commessa,
        'collection_name': rpt.collection_name,
        'report_name': rpt.report_name,
        'mode': rpt.mode,
        'status': rpt.status,
        'task_id': rpt.task_id,
        'total_queries': rpt.total_queries,
        'done_queries': rpt.done_queries,
        'error_message': rpt.error_message,
        'created_at': rpt.created_at.isoformat(),
    }
    if include_items:
        data['items'] = [
            {
                'id': it.id,
                'order': it.order,
                'query': it.query,
                'response': it.response,
                'references': it.references or [],
            }
            for it in rpt.items.all()
        ]
    return data


@require_http_methods(['DELETE', 'POST'])
def delete_report_item(request):
    """Delete a single ReportItem by id.

    Args:
        request: DELETE with ``id`` as query param, or POST with JSON ``id``.

    Returns:
        JSON success or error.
    """
    item_id = None
    if request.method == 'DELETE':
        item_id = request.GET.get('id')
    else:
        try:
            data = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            data = {}
        item_id = data.get('id') or request.POST.get('id')

    if not item_id:
        return JsonResponse({'error': 'id richiesto'}, status=400)

    from core.models import ReportItem

    deleted, _ = ReportItem.objects.filter(id=item_id).delete()
    if not deleted:
        return JsonResponse({'error': 'Item non trovato'}, status=404)
    return JsonResponse({'success': True})


@require_http_methods(['PATCH', 'POST'])
def update_report_item(request):
    """Update the query and/or response of a ReportItem.

    Args:
        request: PATCH/POST with JSON body containing ``id``, and optionally
            ``query`` and ``response``.

    Returns:
        JSON with the updated item fields.
    """
    try:
        data = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'JSON non valido'}, status=400)

    item_id = data.get('id')
    if not item_id:
        return JsonResponse({'error': 'id richiesto'}, status=400)

    from core.models import ReportItem

    try:
        item = ReportItem.objects.get(id=item_id)
    except ReportItem.DoesNotExist:
        return JsonResponse({'error': 'Item non trovato'}, status=404)

    update_fields = []
    if 'query' in data:
        item.query = str(data['query']).strip()
        update_fields.append('query')
    if 'response' in data:
        item.response = str(data['response']).strip()
        update_fields.append('response')

    if update_fields:
        item.save(update_fields=update_fields)

    return JsonResponse({
        'success': True,
        'item': {
            'id': item.id,
            'order': item.order,
            'query': item.query,
            'response': item.response,
        },
    })
