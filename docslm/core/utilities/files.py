import os
import io
import json
import base64
import mimetypes
from django.conf import settings
from django.http import JsonResponse

MAX_PREVIEW_BYTES = 10 * 1024 * 1024  # 10 MB


def check_path(request):
    """POST JSON: { "path": "C:/..." , optional page_start,page_end for PDF }
    Returns existence, listing for dirs, previews for files (images/pdf/text).
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Metodo non consentito'}, status=405)

    # Lazy import for PDF libs
    PdfReader = None
    PdfWriter = None
    try:
        from PyPDF2 import PdfReader, PdfWriter  # type: ignore
    except Exception:
        try:
            from pypdf import PdfReader, PdfWriter  # type: ignore
        except Exception:
            PdfReader = None
            PdfWriter = None

    try:
        data = json.loads(request.body)
        path = (data.get('path') or '').strip()
        file_type = (data.get('type') or '').strip().lower()  # Add type from request
        if not path:
            return JsonResponse({'error': 'Path mancante'}, status=400)

        exists = os.path.exists(path)
        resp = {'exists': exists, 'path': path}
        if not exists:
            return JsonResponse(resp)

        if os.path.isdir(path):
            try:
                items = []
                for name in sorted(os.listdir(path)):
                    full = os.path.join(path, name)
                    items.append({'name': name, 'is_dir': os.path.isdir(full)})
                resp.update({'is_dir': True, 'listing': items})
                return JsonResponse(resp)
            except Exception as e:
                resp.update({'error': str(e)})
                return JsonResponse(resp, status=500)

        # File handling
        resp['is_file'] = True
        try:
            resp['size'] = os.path.getsize(path)
        except Exception:
            resp['size'] = None

        if resp.get('size') and resp['size'] > MAX_PREVIEW_BYTES:
            resp['error'] = 'File troppo grande per anteprima'
            return JsonResponse(resp)

        mimetypes.init()
        mime, _ = mimetypes.guess_type(path)
        resp['mimetype'] = mime

        # Images
        if mime and mime.startswith('image/'):
            try:
                with open(path, 'rb') as fh:
                    b = fh.read()
                resp['data_uri'] = f"data:{mime};base64," + base64.b64encode(b).decode('ascii')
                return JsonResponse(resp)
            except Exception as e:
                resp.update({'error': str(e)})
                return JsonResponse(resp, status=500)

        # PDF handling (full or extracted pages)
        if (mime and mime == 'application/pdf') or path.lower().endswith('.pdf'):
            page_start = data.get('page_start')
            page_end = data.get('page_end')
            
            # For 'draw' type files, always show only the first page
            if file_type == 'draw':
                page_start = 1
                page_end = 1
            
            # try extract pages if requested and library available
            if page_start is not None and page_end is not None and PdfReader and PdfWriter:
                try:
                    ps = int(page_start)
                    pe = int(page_end)
                    if ps < 1:
                        ps = 1
                    if pe < ps:
                        pe = ps
                    reader = PdfReader(path)
                    num_pages = len(reader.pages)
                    ps = min(ps, num_pages)
                    pe = min(pe, num_pages)
                    writer = PdfWriter()
                    for p in range(ps - 1, pe):
                        try:
                            writer.add_page(reader.pages[p])
                        except Exception:
                            pass
                    out = io.BytesIO()
                    writer.write(out)
                    out_bytes = out.getvalue()
                    if len(out_bytes) > MAX_PREVIEW_BYTES:
                        resp['error'] = 'Anteprima estratta troppo grande'
                        return JsonResponse(resp)
                    resp['pdf_data_uri'] = "data:application/pdf;base64," + base64.b64encode(out_bytes).decode('ascii')
                    resp['extracted_pages'] = {'page_start': ps, 'page_end': pe}
                    return JsonResponse(resp)
                except Exception as e:
                    resp.update({'error': 'Impossibile estrarre pagine: ' + str(e)})
                    return JsonResponse(resp, status=500)
            # default: return full PDF
            try:
                with open(path, 'rb') as fh:
                    b = fh.read()
                resp['pdf_data_uri'] = "data:application/pdf;base64," + base64.b64encode(b).decode('ascii')
                return JsonResponse(resp)
            except Exception as e:
                resp.update({'error': str(e)})
                return JsonResponse(resp, status=500)

        # Other files: try text decode
        try:
            with open(path, 'r', encoding='utf-8') as fh:
                content = fh.read()
        except UnicodeDecodeError:
            try:
                with open(path, 'r', encoding='latin-1') as fh:
                    content = fh.read()
            except Exception as e:
                resp.update({'error': f'Impossibile decodificare il file: {e}'})
                return JsonResponse(resp, status=500)
        except Exception as e:
            resp.update({'error': str(e)})
            return JsonResponse(resp, status=500)

        resp['preview'] = content
        return JsonResponse(resp)

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def list_job_files(request):
    """GET params: commessa (required), subpath (optional)."""
    commessa = request.GET.get('commessa', '').strip()
    subpath = request.GET.get('subpath', '').strip()
    if not commessa:
        return JsonResponse({'error': 'Commessa richiesta'}, status=400)

    try:
        import yaml
        config_path = os.path.join(settings.BASE_DIR, 'config.yaml')
        if not os.path.exists(config_path):
            return JsonResponse({'error': 'Configuration file not found'}, status=500)
        with open(config_path, 'r', encoding='utf-8') as f:
            cfg = yaml.safe_load(f)
        jobs_base = cfg.get('jobs')
        if not jobs_base:
            return JsonResponse({'error': 'Jobs path not configured'}, status=500)

        target_base = os.path.abspath(jobs_base)
        target = os.path.join(target_base, commessa)
        if subpath:
            safe_sub = os.path.normpath(subpath).lstrip(os.sep).lstrip('/')
            target = os.path.join(target, safe_sub)
        target = os.path.abspath(target)

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
                continue

        rel_target = os.path.relpath(target, os.path.join(target_base, commessa)).replace('\\', '/')
        if rel_target == '.':
            rel_target = ''

        return JsonResponse({
            'base_jobs': target_base,
            'commessa': commessa,
            'subpath': rel_target,
            'entries': entries
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def list_collections(request):
    """List collections for a selected commessa using services.store.ManageDB"""
    commessa = request.GET.get('commessa', '').strip()
    if not commessa:
        return JsonResponse({'collections': []})

    try:
        import sys
        import yaml
        sys.path.append(os.path.join(settings.BASE_DIR, 'docslm'))
        from services.store import ManageDB

        config_path = os.path.join(settings.BASE_DIR, 'config.yaml')
        if not os.path.exists(config_path):
            return JsonResponse({'error': 'Configuration file not found'}, status=500)

        db_manager = ManageDB(config_path)
        try:
            collections = db_manager.list_collections(commessa)
        except Exception as e:
            if 'database not found' in str(e).lower():
                db_manager.create_database(commessa)
                collections = db_manager.list_collections(commessa)
            else:
                raise

        formatted = [{
            'name': c,
            'displayName': c.replace('_', ' ').title(),
            'commessa': commessa
        } for c in collections]

        return JsonResponse({'collections': formatted, 'commessa': commessa})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def create_collection(request):
    """POST JSON: { commessa, collection_name, files?: [relative paths] }"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
        commessa = data.get('commessa', '').strip()
        collection_name = data.get('collection_name', '').strip()
        if not commessa or not collection_name:
            return JsonResponse({'error': 'Commessa and collection name are required'}, status=400)

        parts = [part for part in collection_name.split() if part]
        collection_name = '_'.join(parts)
        if not collection_name:
            return JsonResponse({'error': 'Collection name is invalid'}, status=400)

        import sys
        import yaml
        sys.path.append(os.path.join(settings.BASE_DIR, 'docslm'))
        from services.store import ManageDB

        config_path = os.path.join(settings.BASE_DIR, 'config.yaml')
        if not os.path.exists(config_path):
            return JsonResponse({'error': 'Configuration file not found'}, status=500)

        selected_files = data.get('files', []) if isinstance(data, dict) else []
        full_paths = []
        if selected_files:
            with open(config_path, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f)
            jobs_base = config.get('jobs', '')
            for rel_path in selected_files:
                full_paths.append(os.path.join(jobs_base, commessa, rel_path))

        db_manager = ManageDB(config_path)
        db_manager.create_collection(commessa, collection_name, files=full_paths)

        return JsonResponse({
            'success': True,
            'message': f'Collection {collection_name} created successfully',
            'commessa': commessa,
            'collection_name': collection_name,
            'selected_files': full_paths
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def list_collection_files(request):
    """List files metadata stored on a collection (uses pymilvus custom properties)."""
    commessa = request.GET.get('commessa', '').strip()
    collection_name = request.GET.get('collection', '').strip()
    if not commessa or not collection_name:
        return JsonResponse({'error': 'Commessa and collection name are required'}, status=400)

    try:
        import yaml
        from pymilvus import Collection, connections
        config_path = os.path.join(settings.BASE_DIR, 'config.yaml')
        if not os.path.exists(config_path):
            return JsonResponse({'error': 'Configuration file not found'}, status=500)

        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
        uri = config.get('uri')
        if not uri:
            return JsonResponse({'error': 'URI not configured'}, status=500)

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
            try:
                files_data = json.loads(custom_properties["files"])
            except Exception:
                files_data = []

        return JsonResponse({
            'files': files_data,
            'commessa': commessa,
            'collection': collection_name
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def delete_collection_file(request):
    """DELETE a file from a collection.
    POST JSON: { commessa, collection, filename }
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
        commessa = data.get('commessa', '').strip()
        collection_name = data.get('collection', '').strip()
        filename = data.get('filename', '').strip()

        if not commessa or not collection_name or not filename:
            return JsonResponse({'error': 'Commessa, collection, and filename are required'}, status=400)

        import yaml
        from pymilvus import Collection, connections
        
        config_path = os.path.join(settings.BASE_DIR, 'config.yaml')
        if not os.path.exists(config_path):
            return JsonResponse({'error': 'Configuration file not found'}, status=500)

        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
        
        uri = config.get('uri')
        if not uri:
            return JsonResponse({'error': 'URI not configured'}, status=500)

        # Connect to Milvus
        host = uri.split("://")[1].split(":")[0]
        port = int(uri.split(":")[-1])
        connections.connect(host=host, port=port)

        # Use the correct database name
        db_name = f"comm_{commessa}"
        from pymilvus import db as milvus_db
        milvus_db.using_database(db_name)

        # Get the collection
        collection_obj = Collection(collection_name)
        collection_info = collection_obj.describe()
        custom_properties = collection_info.get("properties", {})

        # Get current files list
        files_data = []
        if "files" in custom_properties:
            try:
                files_data = json.loads(custom_properties["files"])
            except Exception:
                files_data = []

        # Remove the file from the list
        files_data = [f for f in files_data if not f.endswith(filename)]

        # Update the properties
        collection_obj.set_properties({"files": json.dumps(files_data)})

        # Extract namespace from filename (only the filename without path and extension)
        filename_only = os.path.basename(filename)
        namespace = os.path.splitext(filename_only)[0]
        
        # Delete documents with this namespace from the store
        try:
            import sys
            sys.path.append(os.path.join(settings.BASE_DIR, 'docslm'))
            from services.store import Store
            
            store = Store(
                uri=uri,
                database=db_name,
                collection=collection_name,
                k=config.get("k", 4),
                embedding_model=config.get("embedding_model"),
            )
            
            # Delete documents with matching namespace
            store.delete(namespace)
            print(f"Deleted documents with namespace: {namespace}")
        except Exception as e:
            print(f"Warning: Could not delete from store: {e}")
            # Continue anyway - properties were updated

        return JsonResponse({
            'success': True,
            'message': f'File {filename} deleted successfully',
            'commessa': commessa,
            'collection': collection_name,
            'remaining_files': files_data
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)