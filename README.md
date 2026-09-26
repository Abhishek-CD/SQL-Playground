# 🚀 SQL Playground — Interactive SQLite Web Application

A modern, fast, and fully functional **SQL Playground** built with **Python, Django, Vanilla JavaScript, and SQLite**.

The application allows users to write and execute real SQL queries against an isolated SQLite practice database and visually inspect the resulting database schema, tables, and data in real-time without page reloads.

---

## 🌟 Key Features

* **⚡ Real SQLite Engine**: Executes genuine SQLite SQL queries (DDL, DML, TCL, Aggregations, Joins, CTEs, Window functions). No simulated or faked mock data.
* **🔄 Live Database Explorer**: Automatically introspects the SQLite database after every query to display updated tables, columns, data types, primary keys (`PK`), foreign keys (`FK`), unique constraints, row counts, and live data records.
* **📊 Dual Panel Architecture**:
  * **Left Side**: Code editor with line numbers, syntax helpers, Tab indentation, `Ctrl + Enter` shortcut, SQL formatter, and tabular Query Result panel with execution timings.
  * **Right Side**: Live SQLite database structure, schema viewer, data previews, search filter, and foreign key relationship map.
* **🛡️ Isolated Practice Database**: All playground queries run against a dedicated `practice.sqlite3` database isolated from Django's internal system database.
* **⚡ AJAX Execution**: Smooth, non-reloading Fetch API requests with responsive state management and actionable error banners.
* **⟲ Database Reset**: 1-click database reset with modal confirmation to start fresh anytime.
* **🕒 Query History**: Stores recent queries locally in `localStorage` for one-click reuse.

---

## 📁 Project Structure

```text
sql_playground/
│
├── manage.py                   # Django management script
├── requirements.txt            # Python dependencies (Django, sqlparse)
├── README.md                   # Project documentation
│
├── config/                     # Django project configuration
│   ├── __init__.py
│   ├── settings.py             # Settings (practice database path, templates, static)
│   ├── urls.py                 # Root URL configuration
│   ├── wsgi.py
│   └── asgi.py
│
├── playground/                 # Playground application
│   ├── __init__.py
│   ├── apps.py
│   ├── database.py             # Practice SQLite connection & reset handlers
│   ├── services.py             # SQLExecutor & Schema Introspection engine
│   ├── urls.py                 # API routes (/api/execute/, /api/database/, etc.)
│   └── views.py                # Single-page view and JSON endpoints
│
├── templates/                  # Frontend HTML Templates
│   ├── base.html               # Base layout with fonts & meta
│   └── playground.html         # Main two-panel SQL playground interface
│
└── static/                     # Frontend Assets
    ├── css/
    │   └── style.css           # Modern dark developer tool design system
    └── js/
        └── playground.js       # Pure Vanilla JS AJAX controller & UI renderer
```

---

## 🛠️ Installation & Setup

### 1. Prerequisites
- Python 3.8+
- pip

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Initialize Django Migrations (for internal Django auth/sessions)
```bash
python manage.py migrate
```

### 4. Start the Development Server
```bash
python manage.py runserver
```

### 5. Access the SQL Playground
Open your browser and navigate to:
```text
http://127.0.0.1:8000/
```

---

## 🧪 End-to-End Verification Test Workflow

Test the complete sequence in the playground:

1. **Create Table**:
   ```sql
   CREATE TABLE departments (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT NOT NULL
   );
   ```
   *Expected Result*: `departments` table appears immediately in the Live Database panel.

2. **Create Child Table with Foreign Key**:
   ```sql
   CREATE TABLE employees (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT NOT NULL,
       salary INTEGER,
       department_id INTEGER,
       FOREIGN KEY (department_id) REFERENCES departments(id)
   );
   ```
   *Expected Result*: `employees` table appears with `FK → departments.id` badge and relationship chip.

3. **Insert Data**:
   ```sql
   INSERT INTO departments (name) VALUES ('Engineering');
   INSERT INTO employees (name, salary, department_id) VALUES ('Abhishek', 75000, 1);
   ```
   *Expected Result*: Tables immediately display row counts and updated records.

4. **Select Query**:
   ```sql
   SELECT e.name, e.salary, d.name AS department
   FROM employees e
   JOIN departments d ON e.department_id = d.id;
   ```
   *Expected Result*: Query Result panel displays tabular rows and execution duration in milliseconds.

5. **Update and Delete**:
   ```sql
   UPDATE employees SET salary = 85000 WHERE name = 'Abhishek';
   DELETE FROM employees WHERE id = 1;
   ```
   *Expected Result*: Live database values and row counts update instantly.

6. **Reset Database**:
   Click **Reset Database** in top header to clear all tables and restore clean state.

---

## 📡 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/` or `/playground/` | `GET` | Renders the SQL Playground UI |
| `/api/execute/` | `POST` | Executes SQL statement(s) against SQLite and returns rows/metadata |
| `/api/database/` | `GET` | Returns full database schema, tables, columns, constraints, and data |
| `/api/table/<name>/` | `GET` | Returns paginated rows for a specific table |
| `/api/reset/` | `POST` | Clears and resets the practice database |
| `/api/format/` | `POST` | Formats and beautifies SQL queries |
