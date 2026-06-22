import sqlite3

def inspect_db():
    conn = sqlite3.connect("dmp_acessos.db")
    cursor = conn.cursor()
    
    print("=== INSPECTING DB TABLES ===")
    
    # 1. Check controle_sincronizacao
    cursor.execute("SELECT * FROM controle_sincronizacao")
    rows = cursor.fetchall()
    print("\ncontrole_sincronizacao:")
    for r in rows:
        print(r)
        
    # 2. Check registros_acesso sample
    cursor.execute("SELECT COUNT(*), MIN(id_acesso), MAX(id_acesso) FROM registros_acesso")
    cnt, min_id, max_id = cursor.fetchone()
    print(f"\nregistros_acesso count: {cnt}, min ID: {min_id}, max ID: {max_id}")
    
    cursor.execute("SELECT * FROM registros_acesso LIMIT 3")
    for r in cursor.fetchall():
        print(r[:7]) # print first 7 columns
        
    # 3. Check pessoas count
    cursor.execute("SELECT COUNT(*) FROM pessoas")
    print(f"\npessoas count: {cursor.fetchone()[0]}")
    
    cursor.execute("SELECT * FROM pessoas LIMIT 3")
    for r in cursor.fetchall():
        print(r[:4]) # print first 4 columns

    conn.close()

if __name__ == "__main__":
    inspect_db()
