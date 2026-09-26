import json
from django.shortcuts import render
from django.http import JsonResponse, HttpRequest, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .services import SQLExecutor, format_sql_query


def index(request: HttpRequest) -> HttpResponse:
    """Render the main single-page SQL Playground application."""
    return render(request, 'playground.html')


@csrf_exempt
@require_http_methods(["POST"])
def execute_sql_view(request: HttpRequest) -> JsonResponse:
    """
    API endpoint: Execute user-provided SQL query against SQLite practice database.
    Accepts JSON payload: {"query": "SELECT * FROM employees;"}
    """
    try:
        if request.content_type == 'application/json':
            data = json.loads(request.body.decode('utf-8'))
        else:
            data = request.POST

        query = data.get('query', '')
        result = SQLExecutor.execute_query(query)
        return JsonResponse(result, status=200)
    except json.JSONDecodeError:
        return JsonResponse({
            "success": False,
            "error": "Invalid JSON payload in request."
        }, status=400)
    except Exception as e:
        return JsonResponse({
            "success": False,
            "error": f"Internal server error: {str(e)}"
        }, status=500)


@require_http_methods(["GET"])
def get_database_structure_view(request: HttpRequest) -> JsonResponse:
    """
    API endpoint: Return current tables, columns, constraints, foreign keys, and preview data.
    """
    try:
        structure = SQLExecutor.get_database_structure()
        return JsonResponse({"success": True, **structure}, status=200)
    except Exception as e:
        return JsonResponse({
            "success": False,
            "error": f"Failed to inspect database: {str(e)}"
        }, status=500)


@require_http_methods(["GET"])
def get_table_data_view(request: HttpRequest, table_name: str) -> JsonResponse:
    """
    API endpoint: Return rows and columns for a specific table.
    """
    try:
        limit = int(request.GET.get('limit', 100))
        offset = int(request.GET.get('offset', 0))
        result = SQLExecutor.get_table_data(table_name, limit=limit, offset=offset)
        status_code = 200 if result.get("success") else 404
        return JsonResponse(result, status=status_code)
    except Exception as e:
        return JsonResponse({
            "success": False,
            "error": f"Failed to retrieve table data: {str(e)}"
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def reset_database_view(request: HttpRequest) -> JsonResponse:
    """
    API endpoint: Reset the practice database to clean empty state.
    """
    try:
        result = SQLExecutor.reset_database()
        return JsonResponse(result, status=200 if result.get("success") else 500)
    except Exception as e:
        return JsonResponse({
            "success": False,
            "error": f"Failed to reset database: {str(e)}"
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def format_sql_view(request: HttpRequest) -> JsonResponse:
    """
    API endpoint: Format SQL string.
    """
    try:
        if request.content_type == 'application/json':
            data = json.loads(request.body.decode('utf-8'))
        else:
            data = request.POST

        query = data.get('query', '')
        formatted = format_sql_query(query)
        return JsonResponse({
            "success": True,
            "formatted_query": formatted
        }, status=200)
    except Exception as e:
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=500)
