#!/usr/bin/env python3
"""
MongoDB Atlas Backup Script
Exports all collections to JSON files for backup purposes
Run daily via cron or manually
"""
import os
import json
from datetime import datetime
from pymongo import MongoClient
from pathlib import Path

# Configuration
ATLAS_URI = os.environ.get('MONGO_URL', 'mongodb+srv://leaderlix_admin:Leaderlix2025Atlas@cluster0.epfhsrk.mongodb.net/?retryWrites=true&w=majority')
DB_NAME = os.environ.get('DB_NAME', 'leaderlix')
BACKUP_DIR = Path(__file__).parent.parent / 'backups'
MAX_BACKUPS = 7  # Keep last 7 days

def create_backup():
    """Create a backup of all collections"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = BACKUP_DIR / f'backup_{timestamp}'
    backup_path.mkdir(parents=True, exist_ok=True)
    
    print(f"🔄 Conectando a MongoDB Atlas...")
    client = MongoClient(ATLAS_URI)
    db = client[DB_NAME]
    
    collections = db.list_collection_names()
    print(f"📦 Respaldando {len(collections)} colecciones...")
    
    backup_info = {
        'timestamp': timestamp,
        'database': DB_NAME,
        'collections': {}
    }
    
    for col_name in collections:
        docs = list(db[col_name].find({}))
        
        # Convert ObjectId to string for JSON serialization
        for doc in docs:
            if '_id' in doc:
                doc['_id'] = str(doc['_id'])
        
        # Save to JSON file
        file_path = backup_path / f'{col_name}.json'
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(docs, f, ensure_ascii=False, default=str, indent=2)
        
        backup_info['collections'][col_name] = len(docs)
        print(f"  ✅ {col_name}: {len(docs)} documentos")
    
    # Save backup info
    with open(backup_path / 'backup_info.json', 'w') as f:
        json.dump(backup_info, f, indent=2)
    
    client.close()
    
    # Cleanup old backups
    cleanup_old_backups()
    
    print(f"\n✅ Backup completado: {backup_path}")
    return str(backup_path)

def cleanup_old_backups():
    """Remove backups older than MAX_BACKUPS days"""
    backups = sorted(BACKUP_DIR.glob('backup_*'), reverse=True)
    
    if len(backups) > MAX_BACKUPS:
        for old_backup in backups[MAX_BACKUPS:]:
            import shutil
            shutil.rmtree(old_backup)
            print(f"  🗑️ Eliminado backup antiguo: {old_backup.name}")

def list_backups():
    """List all available backups"""
    backups = sorted(BACKUP_DIR.glob('backup_*'), reverse=True)
    print(f"\n📋 Backups disponibles ({len(backups)}):")
    for backup in backups:
        info_file = backup / 'backup_info.json'
        if info_file.exists():
            with open(info_file) as f:
                info = json.load(f)
                total_docs = sum(info['collections'].values())
                print(f"  - {backup.name}: {len(info['collections'])} colecciones, {total_docs} documentos")
        else:
            print(f"  - {backup.name}")

def restore_backup(backup_name: str):
    """Restore a specific backup"""
    backup_path = BACKUP_DIR / backup_name
    if not backup_path.exists():
        print(f"❌ Backup no encontrado: {backup_name}")
        return False
    
    print(f"⚠️ Restaurando backup: {backup_name}")
    print("   Esto SOBRESCRIBIRÁ los datos actuales.")
    confirm = input("   ¿Continuar? (escribir 'SI' para confirmar): ")
    
    if confirm != 'SI':
        print("   Cancelado.")
        return False
    
    client = MongoClient(ATLAS_URI)
    db = client[DB_NAME]
    
    for json_file in backup_path.glob('*.json'):
        if json_file.name == 'backup_info.json':
            continue
        
        col_name = json_file.stem
        with open(json_file, 'r', encoding='utf-8') as f:
            docs = json.load(f)
        
        if docs:
            # Remove _id to let MongoDB generate new ones
            for doc in docs:
                doc.pop('_id', None)
            
            db[col_name].delete_many({})
            db[col_name].insert_many(docs)
            print(f"  ✅ {col_name}: {len(docs)} documentos restaurados")
    
    client.close()
    print(f"\n✅ Restauración completada")
    return True

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == 'list':
            list_backups()
        elif command == 'restore' and len(sys.argv) > 2:
            restore_backup(sys.argv[2])
        else:
            print("Uso: python backup.py [list|restore <backup_name>]")
    else:
        create_backup()
