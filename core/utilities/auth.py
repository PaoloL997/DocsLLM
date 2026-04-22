import json

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_POST

from core.models import UserProfile


@login_required
def index(request):
    """Render the main chat page."""
    return render(request, 'index.html')


@login_required
def ricerca(request):
    """Render the search page."""
    return render(request, 'ricerca.html')


@login_required
def cronologia(request):
    """Render the history page."""
    return render(request, 'cronologia.html')


@ensure_csrf_cookie
def login_view(request):
    """Handle login page rendering and form submission.

    GET: render login/register page.
    POST JSON: { username, password, action } — authenticate or register.
    """
    if request.user.is_authenticated:
        return redirect('core:index')

    if request.method == 'POST':
        data = json.loads(request.body)
        action = data.get('action', 'login')

        if action == 'register':
            return _handle_register(request, data)
        return _handle_login(request, data)

    return render(request, 'login.html')


@require_POST
def logout_view(request):
    """Log the user out and return JSON confirmation."""
    logout(request)
    return JsonResponse({'success': True})


def _handle_login(request, data: dict) -> JsonResponse:
    """Authenticate user credentials.

    Args:
        request: Django HTTP request.
        data: Parsed JSON body with 'username' and 'password'.

    Returns:
        JsonResponse with success or error.
    """
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return JsonResponse({'error': 'Username e password sono obbligatori'}, status=400)

    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({'error': 'Credenziali non valide'}, status=401)

    login(request, user)
    return JsonResponse({'success': True, 'redirect': '/'})


def _handle_register(request, data: dict) -> JsonResponse:
    """Create a new user account with profile.

    Args:
        request: Django HTTP request.
        data: Parsed JSON body with 'username', 'email', 'password', 'job_title'.

    Returns:
        JsonResponse with success or error.
    """
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    job_title = data.get('job_title', '').strip()

    if not username or not password:
        return JsonResponse({'error': 'Username e password sono obbligatori'}, status=400)

    if User.objects.filter(username=username).exists():
        return JsonResponse({'error': 'Username già in uso'}, status=409)

    if email and User.objects.filter(email=email).exists():
        return JsonResponse({'error': 'Email già in uso'}, status=409)

    user = User.objects.create_user(username=username, email=email, password=password)
    UserProfile.objects.create(user=user, job_title=job_title)

    login(request, user)
    return JsonResponse({'success': True, 'redirect': '/'})