from django.shortcuts import render
from django.http import JsonResponse
from datetime import datetime


def index(request):
    """Render the main page."""
    return render(request, 'index.html')


def get_greeting(request):
    """Return a greeting message based on time of day."""
    hour = datetime.now().hour
    
    if 5 <= hour < 12:
        greeting = "Buongiorno"
    elif 12 <= hour < 17:
        greeting = "Buon pomeriggio"
    else:
        greeting = "Buonasera"
    
    return JsonResponse({
        'greeting': greeting,
        'name': 'paolol'
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
