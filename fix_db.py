import sqlite3

conn = sqlite3.connect('symbi.db')
cur = conn.cursor()

# Check if code_context column exists
cur.execute("PRAGMA table_info(hints)")
columns = [row[1] for row in cur.fetchall()]

if 'code_context' not in columns:
    cur.execute("ALTER TABLE hints ADD COLUMN code_context TEXT")
    print("Added code_context column to hints table.")
else:
    print("code_context column already exists.")

conn.commit()
conn.close()      