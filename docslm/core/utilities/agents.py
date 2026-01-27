import os
import json
from django.conf import settings
from django.http import JsonResponse

# In-memory agent store (per session). TODO: replace with Redis.
AGENT_INSTANCES = {}


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
        from graphrag.store import Store
        import yaml

        config_path = os.path.join(settings.BASE_DIR, 'config.yaml')
        if not os.path.exists(config_path):
            return JsonResponse({'error': 'Configuration file not found'}, status=500)

        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)

        db_name = f"comm_{commessa}"
        store = Store(
            uri=config.get('uri'),
            database=db_name,
            collection=collection_name,
            k=config.get('k', 4),
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