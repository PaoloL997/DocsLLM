import os
import math
from datetime import datetime
from django.conf import settings
from django.http import JsonResponse
import yaml


def _normalize_value(val):
    if val is None:
        return "Non specificato"
    if isinstance(val, float) and math.isnan(val):
        return "Non specificato"
    if isinstance(val, str) and val.strip().lower() in ["", "nan"]:
        return "Non specificato"
    return str(val)


def _format_date_and_status(val):
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return "Non Definito", "Non Definito"
    try:
        import pandas as pd
        date_obj = pd.to_datetime(val, format='%d.%m.%Y')
        formatted_date = date_obj.strftime("%d/%m/%Y")
        status = "Conclusa" if date_obj < datetime.now() else "In Corso"
        return formatted_date, status
    except Exception:
        return "Non Definito", "Non Definito"


def search_commesse(request):
    """Search for commesse by reading the configured Excel file.

    Returns an explicit error JSON (no mock fallback) when the source
    cannot be reached or parsed.
    """
    query = request.GET.get('q', '').strip()
    if not query:
        return JsonResponse({'results': []})

    # Load config
    try:
        config_path = os.path.join(settings.BASE_DIR, 'config.yaml')
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f) or {}
    except FileNotFoundError:
        return JsonResponse(
            {'error': f"config.yaml non trovato in {settings.BASE_DIR}"},
            status=500,
        )
    except Exception as e:
        return JsonResponse({'error': f"Errore lettura config.yaml: {e}"}, status=500)

    excel_path = config.get('path')
    if not excel_path:
        return JsonResponse(
            {'error': "Parametro 'path' non configurato in config.yaml"},
            status=500,
        )

    if not os.path.exists(excel_path):
        return JsonResponse(
            {
                'error': (
                    f"Impossibile accedere al file elenco commesse: '{excel_path}'. "
                    "Verifica che il percorso di rete sia montato/accessibile "
                    "e che il path in config.yaml sia corretto."
                )
            },
            status=503,
        )

    try:
        import pandas as pd
        df = pd.read_excel(excel_path, header=0, skiprows=0)
    except Exception as e:
        return JsonResponse(
            {'error': f"Errore lettura Excel '{excel_path}': {e}"},
            status=500,
        )

    try:
        if 'Unnamed: 0' in df.columns:
            headers = df.iloc[0].to_dict()
            df = df.iloc[1:].reset_index(drop=True)
            column_mapping = {
                col: str(header).strip()
                for col, header in headers.items()
                if pd.notna(header) and str(header).strip()
            }
            df = df.rename(columns=column_mapping)

        results = []
        normalized_search = query.replace(" ", "").lower()
        for _, row in df.iterrows():
            job_code = str(row.get("Commessa", "")).replace(" ", "").lower()
            if normalized_search in job_code:
                formatted_end_date, status = _format_date_and_status(row.get("Consegna"))
                results.append({
                    'code': _normalize_value(row.get("Commessa")),
                    'typeof': _normalize_value(row.get("Tipo \nComm.")),
                    'start_date': _normalize_value(row.get("Data Apertura Commessa")),
                    'company': _normalize_value(row.get("Ragione Sociale Acquisizione contratto")),
                    'customer': _normalize_value(row.get("Cliente")),
                    'goal': _normalize_value(row.get("Scopo della fornitura")),
                    'order_number': _normalize_value(row.get("N° ordine")),
                    'project_manager': _normalize_value(row.get("PM")),
                    'end_date': formatted_end_date,
                    'status': status,
                    'site': _normalize_value(row.get("Stabilimento")),
                    'output': _normalize_value(row.get("Resa")),
                })
        return JsonResponse({'results': results})
    except Exception as e:
        return JsonResponse(
            {'error': f"Errore parsing elenco commesse: {e}"},
            status=500,
        )
