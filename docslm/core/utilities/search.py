import os
import math
from datetime import datetime
from django.conf import settings
from django.http import JsonResponse
import yaml


def search_commesse(request):
    """Search for commesse with Excel fallback and mock data."""
    query = request.GET.get('q', '').strip()
    if not query:
        return JsonResponse({'results': []})

    def normalize_value(val):
        if val is None:
            return "Non specificato"
        if isinstance(val, float) and math.isnan(val):
            return "Non specificato"
        if isinstance(val, str) and val.strip().lower() in ["", "nan"]:
            return "Non specificato"
        return str(val)

    def format_date_and_status(val):
        if val is None or (isinstance(val, float) and math.isnan(val)):
            return "Non Definito", "Non Definito"
        try:
            import pandas as pd
            date_obj = pd.to_datetime(val)
            formatted_date = date_obj.strftime("%d/%m/%Y")
            status = "Conclusa" if date_obj < datetime.now() else "In Corso"
            return formatted_date, status
        except Exception:
            return "Non Definito", "Non Definito"

    try:
        config_path = os.path.join(settings.BASE_DIR, 'config.yaml')
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)

        excel_path = config.get('path')
        if excel_path and os.path.exists(excel_path):
            try:
                import pandas as pd
                df = pd.read_excel(excel_path, header=0, skiprows=0)

                # handle Excel files where headers are in first data row
                if 'Unnamed: 0' in df.columns:
                    headers = df.iloc[0].to_dict()
                    df = df.iloc[1:].reset_index(drop=True)
                    column_mapping = {}
                    for col, header in headers.items():
                        if pd.notna(header) and str(header).strip():
                            column_mapping[col] = str(header).strip()
                    df = df.rename(columns=column_mapping)

                results = []
                normalized_search = query.replace(" ", "").lower()
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
            except Exception:
                # fall through to mock fallback on pandas/read errors
                pass
    except Exception:
        # any config/read error -> fallback to mock
        pass

    # Mock fallback
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