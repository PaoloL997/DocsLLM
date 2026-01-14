import os
import csv
import yaml
import pandas as pd
import math
from datetime import datetime
from django.conf import settings
from django.shortcuts import render
from django.http import JsonResponse


def index(request):
    """Render the main page."""
    return render(request, 'index.html')


def get_greeting(request):
    """Return a placeholder for the default greeting state."""
    return JsonResponse({
        'greeting': 'Accedi al tuo account'
    })


def send_message(request):
    """Handle message submission."""
    if request.method == 'POST':
        import json
        data = json.loads(request.body)
        message = data.get('message', '')
        model = data.get('model', 'Sonnet 4.5')
        
        # Placeholder: In a real app, you would process the message here
        return JsonResponse({
            'success': True,
            'message': 'Message received',
            'model': model
        })
    
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
        
        # Create collection (this will create the database if it doesn't exist)
        db_manager.create_collection(commessa, collection_name)
        
        return JsonResponse({
            'success': True,
            'message': f'Collection {collection_name} created successfully',
            'commessa': commessa,
            'collection_name': collection_name
        })
        
    except Exception as e:
        print(f"Error creating collection: {e}")
        return JsonResponse({'error': str(e)}, status=500)


def test_excel(request):
    """Test Excel file access - debugging endpoint."""
    try:
        config_path = os.path.join(settings.BASE_DIR, 'config.yaml')
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
        
        excel_path = config.get('path')
        
        result = {
            'config_path': config_path,
            'config_exists': os.path.exists(config_path),
            'excel_path': excel_path,
            'excel_exists': os.path.exists(excel_path) if excel_path else False,
        }
        
        if excel_path and os.path.exists(excel_path):
            try:
                import pandas as pd
                df = pd.read_excel(excel_path)
                result.update({
                    'pandas_success': True,
                    'rows': len(df),
                    'columns': list(df.columns[:10]),  # Prime 10 colonne
                    'first_5_rows': df.head().to_dict('records')  # Prime 5 righe per vedere la struttura
                })
            except Exception as e:
                result.update({
                    'pandas_success': False,
                    'pandas_error': str(e)
                })
        else:
            result['message'] = 'File Excel non trovato o non accessibile'
            
        return JsonResponse(result)
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

