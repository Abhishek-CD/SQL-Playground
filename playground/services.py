import re
import time
import sqlite3
from typing import Dict, Any, List, Optional
from .database import get_db_connection, reset_practice_database


def split_sql_statements(sql: str) -> List[str]:
    """
    Split SQL string into individual statements respecting quotes and comments.
    """
    statements = []
    current = []
    in_single_quote = False
    in_double_quote = False
    in_line_comment = False
    in_block_comment = False
    i = 0
    length = len(sql)

    while i < length:
        char = sql[i]
        next_char = sql[i + 1] if i + 1 < length else ''

        # Handle comments
        if not in_single_quote and not in_double_quote:
            if not in_block_comment and char == '-' and next_char == '-':
                in_line_comment = True
                i += 2
                continue
            elif in_line_comment and char == '\n':
                in_line_comment = False
                current.append(char)
                i += 1
                continue
            elif in_line_comment:
                i += 1
                continue

            if not in_line_comment and char == '/' and next_char == '*':
                in_block_comment = True
                i += 2
                continue
            elif in_block_comment and char == '*' and next_char == '/':
                in_block_comment = False
                i += 2
                continue
            elif in_block_comment:
                i += 1
                continue

        # Handle quotes
        if not in_line_comment and not in_block_comment:
            if char == "'" and not in_double_quote:
                in_single_quote = not in_single_quote
            elif char == '"' and not in_single_quote:
                in_double_quote = not in_double_quote

        # Handle statement separator
        if char == ';' and not in_single_quote and not in_double_quote and not in_line_comment and not in_block_comment:
            stmt = ''.join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
        else:
            current.append(char)

        i += 1

    last_stmt = ''.join(current).strip()
    if last_stmt:
        statements.append(last_stmt)

    return statements


def detect_statement_type(statement: str) -> str:
    """Identify the primary SQL verb/command."""
    cleaned = re.sub(r'--.*$', '', statement, flags=re.MULTILINE)
    cleaned = re.sub(r'/\*.*?\*/', '', cleaned, flags=re.DOTALL).strip()
    first_word = cleaned.split()[0].upper() if cleaned.split() else "UNKNOWN"
    
    if first_word.startswith("("):
        first_word = first_word.lstrip("(")

    if first_word in ("SELECT", "WITH", "VALUES", "PRAGMA", "EXPLAIN"):
        return "SELECT"
    elif first_word == "INSERT":
        return "INSERT"
    elif first_word == "UPDATE":
        return "UPDATE"
    elif first_word == "DELETE":
        return "DELETE"
    elif first_word == "CREATE":
        return "CREATE"
    elif first_word == "ALTER":
        return "ALTER"
    elif first_word == "DROP":
        return "DROP"
    return first_word


def format_sql_query(sql: str) -> str:
    """Format SQL query with readable indentation and capitalized keywords."""
    try:
        import sqlparse
        formatted = sqlparse.format(
            sql,
            reindent=True,
            keyword_case='upper',
            identifier_case='lower',
            indent_width=4,
            use_space_around_operators=True,
            strip_comments=False
        )
        return formatted
    except Exception:
        # Fallback simple formatter
        keywords = [
            'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'INSERT INTO', 'VALUES',
            'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE', 'DROP TABLE',
            'ALTER TABLE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET',
            'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN',
            'ON', 'UNION', 'UNION ALL', 'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES'
        ]
        formatted = sql
        for kw in keywords:
            pattern = re.compile(r'\b' + re.escape(kw) + r'\b', re.IGNORECASE)
            formatted = pattern.sub(kw, formatted)
        return formatted


class SQLExecutor:
    """Service to execute queries safely on the practice SQLite database and introspect results."""

    @classmethod
    def execute_query(cls, sql_text: str) -> Dict[str, Any]:
        """
        Execute one or multiple SQL statements against SQLite database.
        Returns execution result dictionary with rows, columns, timing, and errors.
        """
        if not sql_text or not sql_text.strip():
            return {
                "success": False,
                "error": "Query cannot be empty. Please enter a valid SQL statement.",
                "type": "EMPTY"
            }

        statements = split_sql_statements(sql_text.strip())
        if not statements:
            return {
                "success": False,
                "error": "No executable SQL statements found.",
                "type": "EMPTY"
            }

        start_time = time.perf_counter()
        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            last_statement_type = "UNKNOWN"
            total_affected_rows = 0
            columns = []
            rows = []
            returned_data = False
            executed_count = 0
            last_stmt = ""

            for stmt in statements:
                stmt_clean = stmt.strip()
                if not stmt_clean:
                    continue

                stmt_type = detect_statement_type(stmt_clean)
                last_statement_type = stmt_type
                last_stmt = stmt_clean

                cursor.execute(stmt_clean)
                executed_count += 1

                if cursor.rowcount and cursor.rowcount > 0:
                    total_affected_rows += cursor.rowcount

                # If the statement produces a result set
                if cursor.description:
                    columns = [col[0] for col in cursor.description]
                    raw_rows = cursor.fetchall()
                    # Convert to JSON-serializable structures
                    rows = []
                    for row in raw_rows:
                        cleaned_row = []
                        for val in row:
                            if isinstance(val, bytes):
                                try:
                                    cleaned_row.append(val.decode('utf-8'))
                                except UnicodeDecodeError:
                                    cleaned_row.append(f"<BLOB {len(val)} bytes>")
                            else:
                                cleaned_row.append(val)
                        rows.append(cleaned_row)
                    returned_data = True

            conn.commit()
            execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

            # Generate helpful success message
            message = cls._generate_success_message(
                last_statement_type,
                last_stmt,
                total_affected_rows,
                len(rows) if returned_data else 0,
                executed_count
            )

            # Introspect updated database structure immediately
            db_structure = cls.get_database_structure(conn)

            return {
                "success": True,
                "type": last_statement_type,
                "is_select": returned_data,
                "columns": columns,
                "rows": rows,
                "row_count": len(rows) if returned_data else total_affected_rows,
                "affected_rows": total_affected_rows,
                "execution_time_ms": execution_time_ms,
                "executed_statements": executed_count,
                "message": message,
                "db_structure": db_structure
            }

        except sqlite3.Error as e:
            if conn:
                try:
                    conn.rollback()
                except Exception:
                    pass
            execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
            error_msg = str(e)
            return {
                "success": False,
                "error": error_msg,
                "type": "ERROR",
                "execution_time_ms": execution_time_ms
            }
        except Exception as e:
            if conn:
                try:
                    conn.rollback()
                except Exception:
                    pass
            execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "success": False,
                "error": f"Execution failed: {str(e)}",
                "type": "ERROR",
                "execution_time_ms": execution_time_ms
            }
        finally:
            if conn:
                conn.close()

    @classmethod
    def _generate_success_message(cls, stmt_type: str, stmt: str, affected_rows: int, row_count: int, total_stmts: int) -> str:
        """Create informative user feedback message."""
        if total_stmts > 1:
            multi_note = f" ({total_stmts} statements executed)"
        else:
            multi_note = ""

        if stmt_type == "SELECT":
            return f"✓ {row_count} {'row' if row_count == 1 else 'rows'} returned{multi_note}"
        elif stmt_type == "INSERT":
            count = affected_rows if affected_rows > 0 else (1 if total_stmts == 1 else total_stmts)
            return f"✓ {count} {'row' if count == 1 else 'rows'} inserted{multi_note}"
        elif stmt_type == "UPDATE":
            return f"✓ {affected_rows} {'row' if affected_rows == 1 else 'rows'} updated{multi_note}"
        elif stmt_type == "DELETE":
            return f"✓ {affected_rows} {'row' if affected_rows == 1 else 'rows'} deleted{multi_note}"
        elif stmt_type == "CREATE":
            match = re.search(r'CREATE\s+(TABLE|VIEW|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([a-zA-Z0-9_]+)["`]?', stmt, re.IGNORECASE)
            if match:
                obj_type, name = match.groups()
                return f"✓ {obj_type.capitalize()} \"{name}\" created successfully{multi_note}"
            return f"✓ Object created successfully{multi_note}"
        elif stmt_type == "DROP":
            match = re.search(r'DROP\s+(TABLE|VIEW|INDEX)\s+(?:IF\s+EXISTS\s+)?["`]?([a-zA-Z0-9_]+)["`]?', stmt, re.IGNORECASE)
            if match:
                obj_type, name = match.groups()
                return f"✓ {obj_type.capitalize()} \"{name}\" dropped successfully{multi_note}"
            return f"✓ Object dropped successfully{multi_note}"
        elif stmt_type == "ALTER":
            return f"✓ Table altered successfully{multi_note}"
        else:
            return f"✓ Query executed successfully{multi_note}"

    @classmethod
    def get_database_structure(cls, external_conn: Optional[sqlite3.Connection] = None) -> Dict[str, Any]:
        """
        Inspect the SQLite practice database and return all metadata:
        tables, views, columns, data types, primary keys, foreign keys, unique constraints, and rows.
        """
        close_conn = False
        conn = external_conn
        if conn is None:
            conn = get_db_connection()
            close_conn = True

        try:
            cursor = conn.cursor()

            # 1. Fetch all tables and views (excluding internal sqlite tables)
            cursor.execute("""
                SELECT type, name, sql 
                FROM sqlite_master 
                WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
                ORDER BY type DESC, name ASC;
            """)
            items = cursor.fetchall()

            tables_data = []
            relationships = []

            for item_type, table_name, table_sql in items:
                # 2. Get column information using PRAGMA table_info
                cursor.execute(f'PRAGMA table_info("{table_name}");')
                col_info_rows = cursor.fetchall()
                # cid, name, type, notnull, dflt_value, pk

                # 3. Get Foreign Keys using PRAGMA foreign_key_list
                cursor.execute(f'PRAGMA foreign_key_list("{table_name}");')
                fk_rows = cursor.fetchall()
                # id, seq, table, from, to, on_update, on_delete
                fk_map = {}
                for fk in fk_rows:
                    from_col = fk[3]
                    to_table = fk[2]
                    to_col = fk[4]
                    fk_info = {
                        "to_table": to_table,
                        "to_column": to_col,
                        "on_update": fk[5],
                        "on_delete": fk[6]
                    }
                    fk_map[from_col] = fk_info
                    relationships.append({
                        "from_table": table_name,
                        "from_column": from_col,
                        "to_table": to_table,
                        "to_column": to_col
                    })

                # 4. Get Unique indexes
                cursor.execute(f'PRAGMA index_list("{table_name}");')
                index_rows = cursor.fetchall()
                unique_cols = set()
                for idx in index_rows:
                    idx_name = idx[1]
                    is_unique = bool(idx[2])
                    if is_unique:
                        cursor.execute(f'PRAGMA index_info("{idx_name}");')
                        idx_cols = cursor.fetchall()
                        for ic in idx_cols:
                            unique_cols.add(ic[2])

                columns = []
                for col in col_info_rows:
                    cid, cname, ctype, notnull, dflt_value, pk = col
                    ctype_display = ctype.upper() if ctype else "ANY"
                    col_dict = {
                        "cid": cid,
                        "name": cname,
                        "type": ctype_display,
                        "not_null": bool(notnull),
                        "default_value": dflt_value,
                        "primary_key": bool(pk),
                        "pk_order": pk if pk > 0 else 0,
                        "is_unique": (cname in unique_cols) or (bool(pk) and ctype_display == "INTEGER"),
                        "foreign_key": fk_map.get(cname, None)
                    }
                    columns.append(col_dict)

                # 5. Get row count
                total_rows = 0
                rows_preview = []
                if item_type == 'table' or item_type == 'view':
                    try:
                        cursor.execute(f'SELECT COUNT(*) FROM "{table_name}";')
                        total_rows = cursor.fetchone()[0]

                        # Fetch preview data (up to 100 rows)
                        cursor.execute(f'SELECT * FROM "{table_name}" LIMIT 100;')
                        raw_data = cursor.fetchall()
                        for row in raw_data:
                            cleaned_r = []
                            for val in row:
                                if isinstance(val, bytes):
                                    try:
                                        cleaned_r.append(val.decode('utf-8'))
                                    except UnicodeDecodeError:
                                        cleaned_r.append(f"<BLOB {len(val)}B>")
                                else:
                                    cleaned_r.append(val)
                            rows_preview.append(cleaned_r)
                    except Exception:
                        pass

                tables_data.append({
                    "name": table_name,
                    "type": item_type,
                    "sql": table_sql or "",
                    "columns": columns,
                    "column_names": [c["name"] for c in columns],
                    "total_rows": total_rows,
                    "rows_preview": rows_preview,
                    "has_foreign_keys": bool(fk_map),
                    "has_primary_key": any(c["primary_key"] for c in columns)
                })

            return {
                "tables": tables_data,
                "total_tables": len([t for t in tables_data if t["type"] == 'table']),
                "total_views": len([t for t in tables_data if t["type"] == 'view']),
                "relationships": relationships
            }

        except Exception as e:
            return {
                "tables": [],
                "total_tables": 0,
                "total_views": 0,
                "relationships": [],
                "error": str(e)
            }
        finally:
            if close_conn and conn:
                conn.close()

    @classmethod
    def get_table_data(cls, table_name: str, limit: int = 100, offset: int = 0) -> Dict[str, Any]:
        """Fetch rows and columns for a specific table."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            # Verify table exists in sqlite_master
            cursor.execute("SELECT name, type FROM sqlite_master WHERE name = ? AND type IN ('table', 'view');", (table_name,))
            found = cursor.fetchone()
            if not found:
                conn.close()
                return {"success": False, "error": f"Table '{table_name}' does not exist."}

            # Fetch columns
            cursor.execute(f'PRAGMA table_info("{table_name}");')
            cols_info = cursor.fetchall()
            columns = [c[1] for c in cols_info]

            # Fetch total count
            cursor.execute(f'SELECT COUNT(*) FROM "{table_name}";')
            total_count = cursor.fetchone()[0]

            # Fetch rows
            cursor.execute(f'SELECT * FROM "{table_name}" LIMIT ? OFFSET ?;', (limit, offset))
            raw_rows = cursor.fetchall()
            rows = []
            for row in raw_rows:
                cleaned_row = []
                for val in row:
                    if isinstance(val, bytes):
                        try:
                            cleaned_row.append(val.decode('utf-8'))
                        except UnicodeDecodeError:
                            cleaned_row.append(f"<BLOB {len(val)}B>")
                    else:
                        cleaned_row.append(val)
                rows.append(cleaned_row)

            conn.close()
            return {
                "success": True,
                "table_name": table_name,
                "columns": columns,
                "rows": rows,
                "total_rows": total_count,
                "limit": limit,
                "offset": offset
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    @classmethod
    def reset_database(cls) -> Dict[str, Any]:
        """Reset the practice database."""
        success, message = reset_practice_database()
        if success:
            structure = cls.get_database_structure()
            return {
                "success": True,
                "message": message,
                "db_structure": structure
            }
        else:
            return {
                "success": False,
                "error": message
            }
