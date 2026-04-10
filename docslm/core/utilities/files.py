import os
import io
import re
import json
import base64
import mimetypes
import logging
import threading
import yaml
from django.conf import settings
from django.http import JsonResponse
from duckling.service import CloudService

logger = logging.getLogger(__name__)

from services.store import ManageDB
from graphrag.store.store import Store

MAX_PREVIEW_BYTES = 10 * 1024 * 1024  # 10 MB


def _load_config() -> dict:
    """Load and return the application YAML config.

    Returns:
        Parsed config dictionary.

    Raises:
        FileNotFoundError: If config.yaml does not exist.
    """
    config_path = os.path.join(settings.BASE_DIR, 'config.yaml')
    if not os.path.exists(config_path):
        raise FileNotFoundError('Configuration file not found')
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def _connect_milvus(uri: str) -> None:
    """Open a Milvus connection from a tcp:// URI.

    Args:
        uri: Milvus URI such as ``http://localhost:19530``.
    """
    from pymilvus import connections
    host = uri.split('://')[1].split(':')[0]
    port = int(uri.split(':')[-1])
    connections.connect(host=host, port=port)


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
        from pypdf import PdfReader, PdfWriter  # type: ignore
    except Exception:
        try:
            from PyPDF2 import PdfReader, PdfWriter  # type: ignore
        except Exception:
            PdfReader = None
            PdfWriter = None

    try:
        data = json.loads(request.body)
        path = (data.get('path') or '').strip()
        file_type = (data.get('type') or '').strip().lower()  # Add type from request
        if not path:
            return JsonResponse({'error': 'Path mancante'}, status=400)

        # Normalize to absolute path if relative is provided
        if not os.path.isabs(path):
            candidate = os.path.join(settings.BASE_DIR, path)
            if os.path.exists(candidate):
                path = candidate

        print(f"[check_path] requested path={path} type={file_type}")

        exists = os.path.exists(path)
        resp = {'exists': exists, 'path': path}
        if not exists:
            print(f"[check_path] path does not exist")
            return JsonResponse(resp)

        if os.path.isdir(path):
            try:
                items = []
                for name in sorted(os.listdir(path)):
                    full = os.path.join(path, name)
                    items.append({'name': name, 'is_dir': os.path.isdir(full)})
                resp.update({'is_dir': True, 'listing': items})
                print(f"[check_path] directory listing count={len(items)}")
                return JsonResponse(resp)
            except Exception as e:
                print(f"[check_path] directory error: {e}")
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
            print(f"[check_path] file too large size={resp['size']}")
            return JsonResponse(resp)

        mimetypes.init()
        mime, _ = mimetypes.guess_type(path)
        resp['mimetype'] = mime
        print(f"[check_path] file mime={mime} size={resp['size']}")

        # If file is under MEDIA_ROOT, expose an HTTP URL for browsers on other hosts
        media_root_abs = os.path.abspath(settings.MEDIA_ROOT)
        path_abs = os.path.abspath(path)
        if media_root_abs and path_abs.startswith(media_root_abs):
            rel_media = os.path.relpath(path_abs, media_root_abs).replace(os.sep, '/')
            resp['url'] = request.build_absolute_uri(settings.MEDIA_URL + rel_media)
            print(f"[check_path] media url={resp['url']}")

        # Images
        if mime and mime.startswith('image/'):
            try:
                with open(path, 'rb') as fh:
                    b = fh.read()
                resp['data_uri'] = f"data:{mime};base64," + base64.b64encode(b).decode('ascii')
                print(f"[check_path] image preview bytes={len(b)}")
                return JsonResponse(resp)
            except Exception as e:
                print(f"[check_path] image error: {e}")
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
            
            # If only page_start is provided, default page_end to page_start (show single page)
            if page_start is not None and page_end is None:
                page_end = page_start
            
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
                    print(f"[check_path] pdf extracted pages={ps}-{pe} bytes={len(out_bytes)}")
                    return JsonResponse(resp)
                except Exception as e:
                    print(f"[check_path] pdf extract error: {e}")
                    # Fall through to full PDF as fallback
            # default: return full PDF
            try:
                with open(path, 'rb') as fh:
                    b = fh.read()
                resp['pdf_data_uri'] = "data:application/pdf;base64," + base64.b64encode(b).decode('ascii')
                print(f"[check_path] pdf full bytes={len(b)}")
                return JsonResponse(resp)
            except Exception as e:
                print(f"[check_path] pdf read error: {e}")
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
                print(f"[check_path] text latin-1 error: {e}")
                resp.update({'error': f'Impossibile decodificare il file: {e}'})
                return JsonResponse(resp, status=500)
        except Exception as e:
            print(f"[check_path] text error: {e}")
            resp.update({'error': str(e)})
            return JsonResponse(resp, status=500)

        resp['preview'] = content
        print(f"[check_path] text preview length={len(content)}")
        return JsonResponse(resp)

    except Exception as e:
        print(f"[check_path] unexpected error: {e}")
        return JsonResponse({'error': str(e)}, status=500)


def list_job_files(request):
    """GET params: commessa (required), subpath (optional)."""
    commessa = request.GET.get('commessa', '').strip()
    subpath = request.GET.get('subpath', '').strip()
    if not commessa:
        return JsonResponse({'error': 'Commessa richiesta'}, status=400)

    if not subpath:
        def _warmup():
            logger.info('list_job_files: chiamata a CloudService().warmup()')
            result = CloudService().warmup()
            logger.info('list_job_files: CloudService().warmup() -> %s', result)
        threading.Thread(target=_warmup, daemon=True).start()

    try:
        cfg = _load_config()
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
        config = _load_config()
        db_manager = ManageDB(os.path.join(settings.BASE_DIR, 'config.yaml'))
        try:
            collections = db_manager.list_collections(commessa)
        except Exception as exc:
            if 'database not found' in str(exc).lower():
                db_manager.create_database(commessa)
                collections = db_manager.list_collections(commessa)
            else:
                raise

        formatted = [{
            'name': c,
            'displayName': c.replace('_', ' ').title(),
            'commessa': commessa,
        } for c in collections]

        return JsonResponse({'collections': formatted, 'commessa': commessa})
    except FileNotFoundError as exc:
        return JsonResponse({'error': str(exc)}, status=500)
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


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

        parts = [p for p in collection_name.split() if p]
        collection_name = '_'.join(parts)
        if not collection_name:
            return JsonResponse({'error': 'Collection name is invalid'}, status=400)

        if not re.match(r'^[a-zA-Z0-9_]+$', collection_name):
            return JsonResponse(
                {'error': 'Il nome della collection può contenere solo lettere, numeri e underscore.'},
                status=400,
            )

        config = _load_config()
        selected_files = data.get('files', []) if isinstance(data, dict) else []
        full_paths = []
        if selected_files:
            jobs_base = config.get('jobs', '')
            for rel_path in selected_files:
                full_paths.append(os.path.join(jobs_base, commessa, rel_path))

        db_manager = ManageDB(os.path.join(settings.BASE_DIR, 'config.yaml'))
        db_manager.create_collection(commessa, collection_name, files=full_paths)

        return JsonResponse({
            'success': True,
            'message': f'Collection {collection_name} created successfully',
            'commessa': commessa,
            'collection_name': collection_name,
            'selected_files': full_paths,
        })
    except FileNotFoundError as exc:
        return JsonResponse({'error': str(exc)}, status=500)
    except Exception as exc:
        import traceback
        traceback.print_exc()
        error_msg = str(exc)
        if 'Invalid collection name' in error_msg:
            error_msg = 'Il nome della collection contiene caratteri non consentiti. Usa solo lettere, numeri e underscore.'
        return JsonResponse({'error': error_msg}, status=500)


def list_collection_files(request):
    """List files metadata stored on a collection (uses pymilvus custom properties)."""
    commessa = request.GET.get('commessa', '').strip()
    collection_name = request.GET.get('collection', '').strip()
    if not commessa or not collection_name:
        return JsonResponse({'error': 'Commessa and collection name are required'}, status=400)

    try:
        from pymilvus import Collection, db
        config = _load_config()
        uri = config.get('uri')
        if not uri:
            return JsonResponse({'error': 'URI not configured'}, status=500)

        _connect_milvus(uri)
        db.using_database(f"comm_{commessa}")

        collection_obj = Collection(collection_name)
        props = collection_obj.describe().get('properties', {})
        files_data = []
        if 'files' in props:
            try:
                files_data = json.loads(props['files'])
            except Exception:
                files_data = []

        return JsonResponse({
            'files': files_data,
            'commessa': commessa,
            'collection': collection_name,
        })
    except FileNotFoundError as exc:
        return JsonResponse({'error': str(exc)}, status=500)
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


def delete_collection_file(request):
    """POST JSON: { commessa, collection, filename } — remove a file from a collection."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
        commessa = data.get('commessa', '').strip()
        collection_name = data.get('collection', '').strip()
        filename = data.get('filename', '').strip()

        if not commessa or not collection_name or not filename:
            return JsonResponse({'error': 'Commessa, collection, and filename are required'}, status=400)

        from pymilvus import Collection, db as milvus_db
        config = _load_config()
        uri = config.get('uri')
        if not uri:
            return JsonResponse({'error': 'URI not configured'}, status=500)

        _connect_milvus(uri)
        db_name = f"comm_{commessa}"
        milvus_db.using_database(db_name)

        collection_obj = Collection(collection_name)
        props = collection_obj.describe().get('properties', {})
        files_data = []
        if 'files' in props:
            try:
                files_data = json.loads(props['files'])
            except Exception:
                files_data = []

        files_data = [f for f in files_data if not f.endswith(filename)]
        collection_obj.set_properties({'files': json.dumps(files_data)})

        namespace = os.path.splitext(os.path.basename(filename))[0]
        try:
            store = Store(
                uri=uri,
                database=db_name,
                collection=collection_name,
                k=config.get('k', 4),
                embedding_model=config.get('embedding_model'),
            )
            store.delete(namespace)
            print(f"Deleted documents with namespace: {namespace}")
        except Exception as exc:
            print(f"Warning: Could not delete from store: {exc}")

        return JsonResponse({
            'success': True,
            'message': f'File {filename} deleted successfully',
            'commessa': commessa,
            'collection': collection_name,
            'remaining_files': files_data,
        })
    except FileNotFoundError as exc:
        return JsonResponse({'error': str(exc)}, status=500)
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


def delete_collection(request):
    """POST JSON: { commessa, collection } — drop an entire collection."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
        commessa = data.get('commessa', '').strip()
        collection_name = data.get('collection', '').strip()
        if not commessa or not collection_name:
            return JsonResponse({'error': 'Commessa and collection are required'}, status=400)

        from pymilvus import Collection, db as milvus_db
        config = _load_config()
        uri = config.get('uri')
        if not uri:
            return JsonResponse({'error': 'URI not configured'}, status=500)

        _connect_milvus(uri)
        milvus_db.using_database(f"comm_{commessa}")
        Collection(collection_name).drop()

        return JsonResponse({
            'success': True,
            'message': f'Collection {collection_name} deleted successfully',
            'commessa': commessa,
            'collection': collection_name,
        })
    except FileNotFoundError as exc:
        return JsonResponse({'error': str(exc)}, status=500)
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)