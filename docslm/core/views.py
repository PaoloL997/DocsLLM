import os
import csv
from django.conf import settings
from django.shortcuts import render
from django.http import JsonResponse
from datetime import datetime


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
