#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DMP Access II - Python Synchronization Script
This script allows you to synchronize your Dimep access logs and people basic data
directly via Python. It connects to the shared SQLite database 'dmp_acessos.db' 
and handles incremental log retrieval.
"""

import os
import sqlite3
import json
import urllib.request
import urllib.error
from datetime import datetime

# Helper to load .env variables manually to avoid external dependencies
def load_dotenv():
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    key, val = line.split('=', 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key and not os.environ.get(key):
                        os.environ[key] = val

load_dotenv()

DB_PATH = os.path.join(os.path.dirname(__file__), 'dmp_acessos.db')

def get_base_url():
    base = os.environ.get('BASE_URL') or os.environ.get('BASE_URL_API') or ''
    if base:
        base = base.strip().strip('"').strip("'")
    
    lower_base = base.lower()
    if (not base or 
        lower_base == 'base_url_api' or 
        lower_base == 'base_url' or 
        'seu_token_aqui' in lower_base or 
        'your_access_token_here' in lower_base or 
        ('.' not in lower_base and 'localhost' not in lower_base and '127.0.0.1' not in lower_base)):
        base = 'https://dmpaccess.dimep-ams.com.br'
        
    if not base.startswith('http'):
        base = f"https://{base}"
    if base.endswith('/'):
        base = base[:-1]
    
    segment = os.environ.get('URL_SEGMENT') or 'itk'
    return f"{base}/{segment}/api/v1"

def get_token():
    token = os.environ.get('DMP_ACCESS_TOKEN') or os.environ.get('TOKEN') or os.environ.get('DMP_TOKEN') or ''
    if token.upper().startswith('NAK '):
        token = token[4:].strip()
    elif token.upper().startswith('BEARER '):
        token = token[7:].strip()
    return token

def get_pointer_id():
    return os.environ.get('POINTER_CNPJ') or '32757781000150'

def make_request(endpoint, token):
    url = f"{get_base_url()}/{endpoint}"
    print(f"Python pulling: {url}")
    headers = {
        'Authorization': f"Bearer {token}",
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'DMP-Python-Sync/1.0'
    }
    
    req = urllib.request.Request(url, headers=headers, method='GET')
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8') if e else ""
        print(f"HTTP Error {e.code}: {e.reason} | {body}")
        raise e
    except Exception as e:
        print(f"Connection Error: {e}")
        raise e

def map_access_type(val):
    if val == 0 or str(val) == '0' or str(val).lower() == 'entrada':
        return 'Entrada'
    if val == 1 or str(val) == '1' or str(val).lower() == 'saída' or str(val).lower() == 'saida':
        return 'Saída'
    return 'Acesso'

def map_access_status(val, text_fallback=''):
    if val == 10 or 'liberado' in str(text_fallback).lower() or 'permitido' in str(text_fallback).lower():
        return 'Permitido'
    if val == 11 or 'perfil' in str(text_fallback).lower():
        return 'Negado (Sem Perfil)'
    if val == 12 or 'cadastrado' in str(text_fallback).lower():
        return 'Negado (Não Cadastrado)'
    if val == 14 or 'bloqueado' in str(text_fallback).lower():
        return 'Negado (Bloqueado)'
    if val == 15 or 'horario' in str(text_fallback).lower():
        return 'Negado (Fora Horário)'
    if text_fallback:
        return text_fallback
    if val is not None and val != 10:
        return f"Negado (Código {val})"
    return 'Permitido'

def run_sync():
    print("=== INICIANDO SINCRONIZAÇÃO VIA PYTHON ===")
    token = get_token()
    if not token or token == 'SEU_TOKEN_AQUI' or token == 'your_access_token_here':
        print("Erro: DMP_ACCESS_TOKEN não está configurado ou é inválido em .env")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get current pointer
    cursor.execute("SELECT ultimo_ponteiro FROM controle_sincronizacao LIMIT 1")
    row = cursor.fetchone()
    current_pointer = row[0] if row else 0
    print(f"Último ponteiro registrado: {current_pointer}")

    # Step 1: Sync people basic data first (to enrich profiles)
    try:
        print("Sincronizando pessoas (BasicData)...")
        people_data = make_request("Person/BasicData", token)
        
        people_list = []
        if isinstance(people_data, list):
            people_list = people_data
        elif isinstance(people_data, dict):
            if 'Data' in people_data and isinstance(people_data['Data'], list):
                people_list = people_data['Data']
            elif 'Response' in people_data and isinstance(people_data['Response'], list):
                people_list = people_data['Response']
            elif 'Id' in people_data or 'RegistrationNumber' in people_data:
                people_list = [people_data]

        if people_list:
            inserted_people = 0
            for p in people_list:
                reg = p.get('RegistrationNumber') or p.get('Id')
                if not reg:
                    continue
                name = p.get('Name') or 'Pessoa Sem Nome'
                email = p.get('Email')
                org = p.get('OrganizationalStructure')
                org_str = str(org) if org is not None else None
                extra = json.dumps({'cpf': p.get('Cpf'), 'rg': p.get('RG')}) if p.get('Cpf') else None
                payload = json.dumps(p)

                cursor.execute("""
                    INSERT INTO pessoas (matricula, nome, email, estrutura_organizacional, campos_extras, payload_bruto)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(matricula) DO UPDATE SET
                        nome = excluded.nome,
                        email = excluded.email,
                        estrutura_organizacional = excluded.estrutura_organizacional,
                        payload_bruto = excluded.payload_bruto
                """, (str(reg), name, email, org_str, extra, payload))
                inserted_people += 1
            print(f"Sucesso: {inserted_people} pessoas sincronizadas.")
    except Exception as e:
        print(f"Aviso: Não foi possível carregar o BasicData de pessoas ({e})")

    # Step 2: Sync Access Logs incrementally
    try:
        cursor.execute("UPDATE controle_sincronizacao SET status = 'syncing', logs = 'Iniciando via Python...'")
        conn.commit()
        
        logs_endpoint = f"AccessLog/Pointer/{current_pointer if current_pointer > 0 else get_pointer_id()}"
        records = make_request(logs_endpoint, token)

        if not records or not isinstance(records, list):
            print("Nenhum novo registro recebido da API.")
            cursor.execute("UPDATE controle_sincronizacao SET status = 'idle', logs = 'Concluído via Python. Nenhum novo registro.'")
            conn.commit()
            return

        print(f"Recebidos {len(records)} registros para processar.")
        synced_count = 0
        new_pointer = current_pointer

        for log in records:
            log_id = log.get('Id')
            if not log_id:
                continue

            reg_num = log.get('PersonRegistrationNumber')
            person_name = log.get('PersonName')

            # Fetch name from local SQLite fallback if missing
            if reg_num and not person_name:
                cursor.execute("SELECT nome FROM pessoas WHERE matricula = ?", (str(reg_num),))
                p_row = cursor.fetchone()
                if p_row:
                    person_name = p_row[0]

            tipo_mapped = map_access_type(log.get('AccessType'))
            status_mapped = map_access_status(log.get('AccessValidationStatus'), log.get('AccessValidationStatus'))
            
            eq_num = log.get('EquipmentNumber')
            fn_num = log.get('FunctionNumber')
            eq_str = str(eq_num) if eq_num is not None else None
            fn_str = str(fn_num) if fn_num is not None else None

            cursor.execute("""
                INSERT OR IGNORE INTO registros_acesso (
                    id_acesso, matricula, nome, data_hora, tipo_acesso, 
                    status_validacao, equipamento, funcao_codigo, campo_adicional_01, cpf, documento, payload_bruto
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                log_id,
                str(reg_num) if reg_num else None,
                person_name or 'Desconhecido',
                log.get('AccessDateTime'),
                tipo_mapped,
                status_mapped,
                eq_str,
                fn_str,
                log.get('Additionalfield01'),
                log.get('CpfUser'),
                log.get('DocumentNumber'),
                json.dumps(log)
            ))

            if log_id > new_pointer:
                new_pointer = log_id
            synced_count += 1

        # Save new pointer and execution time
        cursor.execute("""
            UPDATE controle_sincronizacao 
            SET ultimo_ponteiro = ?, status = 'idle', data_ultima_execucao = CURRENT_TIMESTAMP, 
                logs = ?
        """, (new_pointer, f"Concluído via Python. {synced_count} novos registros adicionados."))
        conn.commit()
        print(f"Sucesso: Sincronização concluída com sucesso! {synced_count} acessos inseridos. Novo Ponteiro: #{new_pointer}")

    except Exception as e:
        error_msg = f"Erro na sincronização Python: {str(e)}"
        print(error_msg)
        cursor.execute("UPDATE controle_sincronizacao SET status = 'error', logs = ?", (error_msg,))
        conn.commit()
    finally:
        conn.close()

if __name__ == '__main__':
    run_sync()
