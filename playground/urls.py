from django.urls import path
from . import views

app_name = 'playground'

urlpatterns = [
    path('', views.index, name='index'),
    path('playground/', views.index, name='playground'),
    path('api/execute/', views.execute_sql_view, name='api_execute'),
    path('api/database/', views.get_database_structure_view, name='api_database'),
    path('api/table/<str:table_name>/', views.get_table_data_view, name='api_table_data'),
    path('api/reset/', views.reset_database_view, name='api_reset'),
    path('api/format/', views.format_sql_view, name='api_format'),
]
