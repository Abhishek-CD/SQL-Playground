import os
import sqlite3
from pathlib import Path
from django.conf import settings

def get_practice_db_path() -> Path:
    """Return the absolute path to the practice SQLite database."""
    if hasattr(settings, 'PRACTICE_DB_PATH'):
        return Path(settings.PRACTICE_DB_PATH)
    return Path(settings.BASE_DIR) / 'practice.sqlite3'


def get_db_connection():
    """
    Open and return a new SQLite connection to the practice database.
    Configured with foreign keys enabled, text_factory, and row factory.
    """
    db_path = get_practice_db_path()
    # Ensure parent directory exists
    db_path.parent.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(str(db_path), timeout=10.0)
    conn.execute("PRAGMA foreign_keys = ON;")
    # Return row as standard list/tuple or dict when needed
    return conn


def reset_practice_database():
    """
    Completely reset the practice database by dropping all user objects
    or safely removing the file and reinitializing an empty SQLite database.
    """
    db_path = get_practice_db_path()
    try:
        if db_path.exists():
            # First attempt to close any locks and drop tables
            with sqlite3.connect(str(db_path)) as conn:
                cursor = conn.cursor()
                # Disable foreign keys temporarily during drop
                cursor.execute("PRAGMA foreign_keys = OFF;")
                
                # Fetch all views
                cursor.execute("SELECT name FROM sqlite_master WHERE type = 'view' AND name NOT LIKE 'sqlite_%';")
                views = [row[0] for row in cursor.fetchall()]
                for view in views:
                    cursor.execute(f'DROP VIEW IF EXISTS "{view}";')
                    
                # Fetch all tables
                cursor.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';")
                tables = [row[0] for row in cursor.fetchall()]
                for table in tables:
                    cursor.execute(f'DROP TABLE IF EXISTS "{table}";')
                
                # Fetch all triggers
                cursor.execute("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name NOT LIKE 'sqlite_%';")
                triggers = [row[0] for row in cursor.fetchall()]
                for trigger in triggers:
                    cursor.execute(f'DROP TRIGGER IF EXISTS "{trigger}";')

                conn.commit()
                cursor.execute("VACUUM;")
        else:
            # Create the file
            with sqlite3.connect(str(db_path)) as conn:
                conn.execute("PRAGMA foreign_keys = ON;")
        return True, "Database has been reset to a clean, empty state."
    except Exception as e:
        # If dropping failed due to locks, attempt file unlinking
        try:
            if db_path.exists():
                os.remove(str(db_path))
            with sqlite3.connect(str(db_path)) as conn:
                conn.execute("PRAGMA foreign_keys = ON;")
            return True, "Database has been reset successfully."
        except Exception as ex:
            return False, f"Failed to reset database: {str(ex)}"
