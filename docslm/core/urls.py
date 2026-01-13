from django.urls import path
from . import views

app_name = 'core'

urlpatterns = [
    path('', views.index, name='index'),
    path('api/greeting/', views.get_greeting, name='greeting'),
    path('api/send-message/', views.send_message, name='send_message'),
    path('api/login/', views.user_login, name='login'),
    path('api/search-commesse/', views.search_commesse, name='search_commesse'),
    path('api/test-excel/', views.test_excel, name='test_excel'),
]
