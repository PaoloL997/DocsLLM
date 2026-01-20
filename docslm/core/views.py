import os
import csv
import yaml
import pandas as pd
import math
from datetime import datetime
from django.conf import settings
from django.shortcuts import render
from django.http import JsonResponse

# Global dictionary to store agent instances by session key
AGENT_INSTANCES = {}


def index(request):
    """Render the main page."""
    return render(request, 'index.html')


def get_greeting(request):
    """Return a placeholder for the default greeting state."""
    return JsonResponse({
        'greeting': 'Accedi al tuo account'
    })


def send_message(request):
    """Handle message submission and send to Agent."""
    if request.method == 'POST':
        import json
        data = json.loads(request.body)
        message = data.get('message', '')
        
        # Check if there's an active agent in session
        active_agent = request.session.get('active_agent')
        
        if not active_agent:
            return JsonResponse({
                'error': 'Nessun agent attivo. Seleziona un notebook prima di inviare un messaggio.'
            }, status=400)
        
        # Get agent instance from memory
        session_key = request.session.session_key
        agent = AGENT_INSTANCES.get(session_key)
        
        if not agent:
            return JsonResponse({
                'error': 'Agent non trovato in memoria. Riseleziona il notebook.'
            }, status=400)
        
        try:
            # Invoke agent with user message
            print(f"\n{'='*80}")
            print(f"USER QUERY: {message}")
            print(f"Commessa: {active_agent['commessa']}, Collection: {active_agent['collection']}, Mode: {active_agent.get('mode', 'Unknown')}, Model: {active_agent.get('model', 'Unknown')}, Thinking Level: {active_agent.get('draw_thinking_level', 'Unknown')}")
            print(f"{'='*80}")
            
            response = agent.invoke(message)
            
            print(f"\nAGENT RESPONSE:")
            print(response)
            print(f"{'='*80}\n")
            
            # Extract only the text response from the agent result
            response_text = response.get('response', '') if isinstance(response, dict) else str(response)
            
            return JsonResponse({
                'success': True,
                'message': 'Message processed by agent',
                'response': response_text
            })
            
        except Exception as e:
            print(f"Error invoking agent: {e}")
            import traceback
            traceback.print_exc()
            return JsonResponse({
                'error': f'Errore durante l\'invocazione dell\'agent: {str(e)}'
            }, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)


def user_login(request):
    """Login using CSV file for simplicity."""
    if request.method == 'POST':
        import json
        data = json.loads(request.body)
        username = data.get('username', '').strip().lower()
        
        csv_path = os.path.join(settings.BASE_DIR, 'users.csv')
        
        try:
            with open(csv_path, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row['username'].lower() == username:
                        return JsonResponse({
                            'success': True,
                            'name': row['display_name'],
                            'role': row['role'],
                            'initial': row['display_name'][0].upper()
                        })
                
            return JsonResponse({
                'success': False,
                'error': 'Utente non trovato'
            }, status=404)
            
        except FileNotFoundError:
            return JsonResponse({
                'success': False,
                'error': 'Database utenti non configurato'
            }, status=500)
            
    return JsonResponse({'success': False, 'error': 'Metodo non consentito'}, status=405)


def search_commesse(request):
    """Search for commesse with fallback to test data."""
    query = request.GET.get('q', '').strip()
    if not query:
        return JsonResponse({'results': []})

    try:
        # Try to use real Excel data
        config_path = os.path.join(settings.BASE_DIR, 'config.yaml')
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
        
        excel_path = config.get('path')
        if excel_path and os.path.exists(excel_path):
            import pandas as pd
            df = pd.read_excel(excel_path, header=0, skiprows=0)
            
            # Mappa i nomi delle colonne dalla prima riga se necessario
            if 'Unnamed: 0' in df.columns:
                # Le intestazioni sono nella prima riga dei dati
                headers = df.iloc[0].to_dict()
                df = df.iloc[1:].reset_index(drop=True)  # Rimuovi la prima riga
                
                # Rinomina le colonne usando la prima riga come intestazioni
                column_mapping = {}
                for col, header in headers.items():
                    if pd.notna(header) and str(header).strip():
                        column_mapping[col] = str(header).strip()
                
                df = df.rename(columns=column_mapping)
            
            results = []
            normalized_search = query.replace(" ", "").lower()

            def normalize_value(val):
                if val is None or (isinstance(val, float) and math.isnan(val)) or (isinstance(val, str) and val.strip().lower() in ["", "nan"]):
                    return "Non specificato"
                return str(val)

            def format_date_and_status(val):
                if val is None or (isinstance(val, float) and pd.isna(val)):
                    return "Non Definito", "Non Definito"
                try:
                    date_obj = pd.to_datetime(val)
                    formatted_date = date_obj.strftime("%d/%m/%Y")
                    status = "Conclusa" if date_obj < datetime.now() else "In Corso"
                    return formatted_date, status
                except:
                    return "Non Definito", "Non Definito"

            for _, row in df.iterrows():
                job_code = str(row.get("Commessa", "")).replace(" ", "").lower()
                if normalized_search in job_code:
                    formatted_end_date, status = format_date_and_status(row.get("Consegna"))
                    
                    results.append({
                        'code': normalize_value(row.get("Commessa")),
                        'typeof': normalize_value(row.get("Tipo \nComm.")),
                        'start_date': normalize_value(row.get("Data Apertura Commessa")),
                        'company': normalize_value(row.get("Ragione Sociale Acquisizione contratto")),
                        'customer': normalize_value(row.get("Cliente")),
                        'goal': normalize_value(row.get("Scopo della fornitura")),
                        'order_number': normalize_value(row.get("N° ordine")),
                        'project_manager': normalize_value(row.get("PM")),
                        'end_date': formatted_end_date,
                        'status': status,
                        'site': normalize_value(row.get("Stabilimento")),
                        'output': normalize_value(row.get("Resa"))
                    })

            return JsonResponse({'results': results})

    except (ImportError, FileNotFoundError, Exception):
        # Fallback to test data
        pass
    
    # Test data fallback
    mock_results = []
    if query.lower() in ['test', '123', '001'] or any(char.isdigit() for char in query):
        mock_results = [{
            'code': f'{query}',
            'typeof': 'Fornitura Standard',
            'start_date': '01/01/2024',
            'company': 'Azienda di Prova',
            'customer': 'Cliente di Test',
            'goal': f'Scopo della fornitura per commessa {query}',
            'order_number': f'ORD-{query}',
            'project_manager': 'Paolo Rossi',
            'end_date': '31/12/2024',
            'status': 'In Corso',
            'site': 'Stabilimento Principale',
            'output': 'Completamento al 75%'
        }]

    return JsonResponse({'results': mock_results})


def list_collections(request):
    """List collections for a selected commessa."""
    commessa = request.GET.get('commessa', '').strip()
    if not commessa:
        return JsonResponse({'collections': []})
    
    try:
        import sys
        sys.path.append(os.path.join(settings.BASE_DIR, 'docslm'))
        from services.store import ManageDB
        
        config_path = os.path.join(settings.BASE_DIR, 'config.yaml')
        
        if not os.path.exists(config_path):
            return JsonResponse({'error': 'Configuration file not found'}, status=500)
            
        db_manager = ManageDB(config_path)
        
        # Try to list collections, if database doesn't exist, create it
        try:
            collections = db_manager.list_collections(commessa)
        except Exception as e:
            if 'database not found' in str(e).lower():
                # Create the database and try again
                db_manager.create_database(commessa)
                collections = db_manager.list_collections(commessa)
            else:
                raise e
        
        # Format collections for frontend
        formatted_collections = []
        for collection_name in collections:
            formatted_collections.append({
                'name': collection_name,
                'displayName': collection_name.replace('_', ' ').title(),
                'commessa': commessa
            })
        
        return JsonResponse({
            'collections': formatted_collections,
            'commessa': commessa
        })
        
    except Exception as e:
        print(f"Error listing collections: {e}")
        return JsonResponse({'error': str(e)}, status=500)


def create_collection(request):
    """Create a new collection in the specified commessa database."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        import json
        data = json.loads(request.body)
        commessa = data.get('commessa', '').strip()
        collection_name = data.get('collection_name', '').strip()
        
        if not commessa or not collection_name:
            return JsonResponse({'error': 'Commessa and collection name are required'}, status=400)
        
        # Sanitize collection name (replace spaces with underscores)
        parts = [part for part in collection_name.split() if part]
        collection_name = '_'.join(parts)
        if not collection_name:
            return JsonResponse({'error': 'Collection name is invalid'}, status=400)
        
        import sys
        sys.path.append(os.path.join(settings.BASE_DIR, 'docslm'))
        from services.store import ManageDB
        
        config_path = os.path.join(settings.BASE_DIR, 'config.yaml')
        
        if not os.path.exists(config_path):
            return JsonResponse({'error': 'Configuration file not found'}, status=500)
        
        db_manager = ManageDB(config_path)
        
        # Optional: files selected by user (relative paths)
        selected_files = data.get('files', []) if isinstance(data, dict) else []
        
        # Convert relative paths to absolute paths
        full_paths = []
        if selected_files:
            with open(config_path, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f)
            jobs_base = config.get('jobs', '')
            for rel_path in selected_files:
                full_path = os.path.join(jobs_base, commessa, rel_path)
                full_paths.append(full_path)
        
        # Create collection (this will create the database if it doesn't exist)
        db_manager.create_collection(commessa, collection_name, files=full_paths)
        return JsonResponse({
            'success': True,
            'message': f'Collection {collection_name} created successfully',
            'commessa': commessa,
            'collection_name': collection_name,
            'selected_files': full_paths
        })
        
    except Exception as e:
        print(f"Error creating collection: {e}")
        return JsonResponse({'error': str(e)}, status=500)


def initialize_agent(request):
    """Initialize agent for selected collection."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        import json
        data = json.loads(request.body)
        commessa = data.get('commessa', '').strip()
        collection_name = data.get('collection_name', '').strip()
        mode = data.get('mode', 'veloce').strip().lower()
        
        if not commessa or not collection_name:
            return JsonResponse({'error': 'Commessa and collection name are required'}, status=400)
        
        import sys
        sys.path.append(os.path.join(settings.BASE_DIR, 'docslm'))
        from services.agent import Agent
        from graphrag.store import Store
        
        config_path = os.path.join(settings.BASE_DIR, 'config.yaml')
        
        if not os.path.exists(config_path):
            return JsonResponse({'error': 'Configuration file not found'}, status=500)
        
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
        
        # Create Store instance
        db_name = f"comm_{commessa}"
        store = Store(
            uri=config.get('uri'),
            database=db_name,
            collection=collection_name,
            k=config.get('k', 4),
            embedding_model=config.get('embedding_model')
        )
        
        # Create agent and store it in global dictionary
        agent = Agent(store=store, mode=mode, rerank=True)
        
        # Store agent instance in memory indexed by session key
        session_key = request.session.session_key
        if not session_key:
            request.session.create()
            session_key = request.session.session_key
        
        AGENT_INSTANCES[session_key] = agent
        
        # Store agent metadata in session for reference
        request.session['active_agent'] = {
            'commessa': commessa,
            'collection': collection_name,
            'mode': mode,
            'model': agent.model,  # Il modello effettivamente utilizzato
            'draw_thinking_level': agent.draw_thinking_level
        }
        request.session.modified = True
        
        print(f"Agent created and stored for session {session_key}")
        print(f"Commessa: {commessa}, Collection: {collection_name}, Mode: {mode}")
        print(f"Actual Model: {agent.model}, Thinking Level: {agent.draw_thinking_level}")
        
        return JsonResponse({
            'success': True,
            'message': 'Agent initialized successfully',
            'commessa': commessa,
            'collection': collection_name,
            'mode': mode,
            'model': agent.model,
            'draw_thinking_level': agent.draw_thinking_level
        })
        
    except Exception as e:
        print(f"Error initializing agent: {e}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)


def list_job_files(request):
    """List files and folders under the configured jobs path for a commessa.
    GET params: commessa (required), subpath (optional, relative inside commessa)
    """
    commessa = request.GET.get('commessa', '').strip()
    subpath = request.GET.get('subpath', '').strip()
    try:
        config_path = os.path.join(settings.BASE_DIR, 'config.yaml')
        if not os.path.exists(config_path):
            return JsonResponse({'error': 'Configuration file not found'}, status=500)

        with open(config_path, 'r', encoding='utf-8') as f:
            cfg = yaml.safe_load(f)

        jobs_base = cfg.get('jobs')
        if not jobs_base:
            return JsonResponse({'error': 'Jobs path not configured'}, status=500)

        # Build target path: jobs_base / commessa / subpath
        target_base = os.path.abspath(jobs_base)
        target = os.path.join(target_base, commessa)
        if subpath:
            # normalize and prevent traversal
            safe_sub = os.path.normpath(subpath).lstrip(os.sep).lstrip('/')
            target = os.path.join(target, safe_sub)

        target = os.path.abspath(target)

        # Security: ensure target is inside jobs_base
        if not target.startswith(target_base):
            return JsonResponse({'error': 'Invalid path'}, status=400)

        if not os.path.exists(target):
            return JsonResponse({'error': 'Path not found', 'path': target}, status=404)

        entries = []
        for name in sorted(os.listdir(target)):
            full = os.path.join(target, name)
            try:
                stat = os.stat(full)
                entries.append({
                    'name': name,
                    'is_dir': os.path.isdir(full),
                    'size': stat.st_size,
                    'mtime': stat.st_mtime
                })
            except Exception:
                # ignore unreadable
                continue

        # parent relative path for breadcrumb
        rel_parent = ''
        rel_target = os.path.relpath(target, os.path.join(target_base, commessa)).replace('\\', '/')
        if rel_target == '.':
            rel_target = ''
        else:
            rel_target = rel_target

        return JsonResponse({
            'base_jobs': target_base,
            'commessa': commessa,
            'subpath': rel_target,
            'entries': entries
        })
    except Exception as e:
        print(f"Error listing job files: {e}")
        return JsonResponse({'error': str(e)}, status=500)


def list_collection_files(request):
    """List files associated with a collection."""
    commessa = request.GET.get('commessa', '').strip()
    collection_name = request.GET.get('collection', '').strip()
    
    if not commessa or not collection_name:
        return JsonResponse({'error': 'Commessa and collection name are required'}, status=400)
    
    try:
        import sys
        sys.path.append(os.path.join(settings.BASE_DIR, 'docslm'))
        from services.store import ManageDB
        
        config_path = os.path.join(settings.BASE_DIR, 'config.yaml')
        
        if not os.path.exists(config_path):
            return JsonResponse({'error': 'Configuration file not found'}, status=500)
        
        # Get collection properties
        from pymilvus import Collection, connections
        
        uri = None
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
        uri = config.get('uri')
        
        if not uri:
            return JsonResponse({'error': 'URI not configured'}, status=500)
        
        # Connect to Milvus
        host = uri.split("://")[1].split(":")[0]
        port = int(uri.split(":")[-1])
        connections.connect(host=host, port=port)
        
        db_name = f"comm_{commessa}"
        from pymilvus import db
        db.using_database(db_name)
        
        collection_obj = Collection(collection_name)
        collection_info = collection_obj.describe()
        custom_properties = collection_info.get("properties", {})
        
        files_data = []
        if "files" in custom_properties:
            import json
            files_data = json.loads(custom_properties["files"])
        
        return JsonResponse({
            'files': files_data,
            'commessa': commessa,
            'collection': collection_name
        })
        
    except Exception as e:
        print(f"Error listing collection files: {e}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)

