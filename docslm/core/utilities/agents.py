import os
import json
import yaml
from django.conf import settings
from django.http import JsonResponse

# In-memory agent store (per session). TODO: replace with Redis.
AGENT_INSTANCES = {}

# In-memory report cache (token -> {file_buffer, filename, timestamp})
REPORT_CACHE = {}


def _idx_to_letters(i: int) -> str:
    result = ''
    n = i + 1
    while n > 0:
        n, rem = divmod(n - 1, 26)
        result = chr(65 + rem) + result
    return result


def send_message(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
        message = data.get('message', '')
        username = request.session.get('username')

        active_agent = request.session.get('active_agent')
        if not active_agent:
            return JsonResponse({'error': 'Nessun agent attivo. Seleziona un notebook prima di inviare un messaggio.'}, status=400)

        session_key = request.session.session_key
        agent = AGENT_INSTANCES.get(session_key)
        if not agent:
            return JsonResponse({'error': 'Agent non trovato in memoria. Riseleziona il notebook.'}, status=400)

        final_state = agent.invoke(message, user_id=username)
        context = final_state.get("context", [])
        response = final_state.get("response", "")

        response_text = response.get('response', '') if isinstance(response, dict) else str(response)
        has_context = bool(context) and isinstance(context, (list, tuple)) and len(context) > 0

        context_buttons = []
        if has_context:
            try:
                for idx, doc in enumerate(context):
                    meta = {}
                    if isinstance(doc, dict):
                        meta = doc.get('metadata', {}) if isinstance(doc.get('metadata', {}), dict) else {}
                    else:
                        meta = getattr(doc, 'metadata', {}) or {}

                    doc_type = meta.get('type') or meta.get('doc_type') or (meta.get('mimetype') or '').split('/')[0] or 'text'
                    name = meta.get('name') or meta.get('source') or meta.get('filename') or 'unknown'
                    page_start = meta.get('page_start')
                    page_end = meta.get('page_end')
                    label = _idx_to_letters(idx)

                    context_buttons.append({
                        'label': label,
                        'name': name,
                        'type': doc_type,
                        'page_start': page_start,
                        'page_end': page_end,
                        'index': idx,
                        'metadata': meta
                    })
            except Exception as e:
                print(f"Error building context buttons: {e}")
                context_buttons = []

        return JsonResponse({
            'success': True,
            'message': 'Message processed by agent',
            'response': response_text,
            'has_context': has_context,
            'context_buttons': context_buttons
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': f"Errore durante l'invocazione dell'agent: {str(e)}"}, status=500)


def generate_report(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        if 'file' not in request.FILES:
            return JsonResponse({'error': 'File Excel richiesto'}, status=400)
        
        excel_file = request.FILES['file']
        commessa = request.POST.get('commessa', '').strip()
        collection = request.POST.get('collection', '').strip()
        
        if not commessa or not collection:
            return JsonResponse({'error': 'Commessa e collection richiesti'}, status=400)
        
        session_key = request.session.session_key
        agent = AGENT_INSTANCES.get(session_key)
        
        if not agent:
            return JsonResponse({'error': 'Agent non trovato'}, status=400)
        
        # Get user_id from session
        user_id = request.session.get('username', None)
        
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp_file:
            for chunk in excel_file.chunks():
                tmp_file.write(chunk)
            tmp_file_path = tmp_file.name
        
        result = agent.report(tmp_file_path, user_id=user_id)
        
        os.remove(tmp_file_path)
        
        # Store the report in cache with a token
        import uuid
        import time
        token = str(uuid.uuid4())
        REPORT_CACHE[token] = {
            'file_buffer': result['file_buffer'],
            'filename': result['filename'],
            'timestamp': time.time(),
            'session_key': session_key
        }
        
        return JsonResponse({
            'success': True,
            'message': f'Report elaborato con successo',
            'commessa': commessa,
            'collection': collection,
            'filename': result.get('filename'),
            'download_token': token,
            'query_count': result.get('query_count')
        })
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)


def download_report(request):
    """Serve a report file from cache using token"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        token = request.GET.get('token', '')
        filename = request.GET.get('filename', '')
        
        if not token or token not in REPORT_CACHE:
            return JsonResponse({'error': 'Report not found or expired'}, status=404)
        
        report_data = REPORT_CACHE[token]
        
        # Optional: verify session security
        session_key = request.session.session_key
        if report_data.get('session_key') != session_key:
            return JsonResponse({'error': 'Unauthorized'}, status=403)
        
        # Get file buffer and reset position
        file_buffer = report_data['file_buffer']
        file_buffer.seek(0)
        
        # Stream the file
        from django.http import FileResponse
        response = FileResponse(
            file_buffer,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="{report_data["filename"]}"'
        
        # Clean up cache entry after download
        del REPORT_CACHE[token]
        
        return response
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)


def initialize_agent(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
        commessa = data.get('commessa', '').strip()
        collection_name = data.get('collection_name', '').strip()
        mode = data.get('mode', 'veloce').strip().lower()

        if not commessa or not collection_name:
            return JsonResponse({'error': 'Commessa and collection name are required'}, status=400)

        # local import to avoid heavy imports at module load
        import sys
        sys.path.append(os.path.join(settings.BASE_DIR, 'docslm'))
        from services.agent import Agent
        from graphrag.store.store import Store
        import yaml

        config_path = os.path.join(settings.BASE_DIR, 'config.yaml')
        if not os.path.exists(config_path):
            return JsonResponse({'error': 'Configuration file not found'}, status=500)

        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)

        db_name = f"comm_{commessa}"
        
        # Get k value based on mode
        default_k = 4
        if mode in ['veloce', 'ragionamento']:
            from services.agent import Agent as AgentClass
            mode_config = AgentClass.MODES.get(mode, {})
            k_value = mode_config.get('k', default_k)
        else:
            k_value = default_k
        
        print(f"[AGENT INIT] Initializing agent with K={k_value}, commessa={commessa}, collection={collection_name}, mode={mode}")
        
        store = Store(
            uri=config.get('uri'),
            database=db_name,
            collection=collection_name,
            k=k_value,
            embedding_model=config.get('embedding_model')
        )

        agent = Agent(store=store, mode=mode, rerank=True)

        session_key = request.session.session_key
        if not session_key:
            request.session.create()
            session_key = request.session.session_key

        AGENT_INSTANCES[session_key] = agent

        request.session['active_agent'] = {
            'commessa': commessa,
            'collection': collection_name,
            'mode': mode,
            'model': getattr(agent, 'model', None),
            'draw_thinking_level': getattr(agent, 'draw_thinking_level', None)
        }
        request.session.modified = True
        
        return JsonResponse({
            'success': True,
            'message': 'Agent initialized successfully',
            'commessa': commessa,
            'collection': collection_name,
            'mode': mode,
            'model': getattr(agent, 'model', None),
            'draw_thinking_level': getattr(agent, 'draw_thinking_level', None)
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)