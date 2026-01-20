from django.urls import path
from . import views

app_name = 'core'

urlpatterns = [
    path('', views.index, name='index'),
    path('api/greeting/', views.get_greeting, name='greeting'),
    path('api/send-message/', views.send_message, name='send_message'),
    path('api/login/', views.user_login, name='login'),
    path('api/search-commesse/', views.search_commesse, name='search_commesse'),
    path('api/list-collections/', views.list_collections, name='list_collections'),
    path('api/list-job-files/', views.list_job_files, name='list_job_files'),
    path('api/list-collection-files/', views.list_collection_files, name='list_collection_files'),
    path('api/create-collection/', views.create_collection, name='create_collection'),
    path('api/initialize-agent/', views.initialize_agent, name='initialize_agent'),
]
