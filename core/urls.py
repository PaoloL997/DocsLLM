from django.urls import path
from . import views

app_name = 'core'

urlpatterns = [
    path('', views.index, name='index'),
    path('ricerca/', views.ricerca, name='ricerca'),
    path('cronologia/', views.cronologia, name='cronologia'),
    path('report/', views.report, name='report'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('api/send-message/', views.send_message, name='send_message'),
    path('api/search-commesse/', views.search_commesse, name='search_commesse'),
    path('api/list-collections/', views.list_collections, name='list_collections'),
    path('api/list-job-files/', views.list_job_files, name='list_job_files'),
    path('api/list-collection-files/', views.list_collection_files, name='list_collection_files'),
    path('api/delete-collection-file/', views.delete_collection_file, name='delete_collection_file'),
    path('api/delete-collection/', views.delete_collection, name='delete_collection'),
    path('api/create-collection/', views.create_collection, name='create_collection'),
    path('api/collection-task-status/', views.collection_task_status, name='collection_task_status'),
    path('api/collection-tasks/active/', views.active_collection_tasks, name='active_collection_tasks'),
    path('api/collection-tasks/cancel/', views.cancel_collection_task, name='cancel_collection_task'),
    path('api/initialize-agent/', views.initialize_agent, name='initialize_agent'),
    path('api/check-path/', views.check_path, name='check_path'),
    path('api/initialize-search-store/', views.initialize_search_store, name='initialize_search_store'),
    path('api/search-documents/', views.search_documents, name='search_documents'),
    path('api/cronologia/<str:commessa>/', views.get_cronologia, name='get_cronologia'),
    path('api/reports/create/', views.create_report, name='create_report'),
    path('api/reports/list/', views.list_reports, name='list_reports'),
    path('api/reports/status/', views.report_status, name='report_status'),
    path('api/reports/active/', views.active_report_tasks, name='active_report_tasks'),
    path('api/reports/delete/', views.delete_report, name='delete_report'),
    path('api/reports/cancel/', views.cancel_report, name='cancel_report'),
    path('api/reports/item/delete/', views.delete_report_item, name='delete_report_item'),
    path('api/reports/item/update/', views.update_report_item, name='update_report_item'),
    path('api/reports/export/', views.export_report, name='export_report'),
]
