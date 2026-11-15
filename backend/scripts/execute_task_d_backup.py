"""
VisionPlate AI — Phase 07E.10
Task D: Mandatory Logical Backup Script
Executes pg_dump via postgres:17-alpine against live Supabase PostgreSQL.
Stores custom-format dump (.dump), verifies with pg_restore --list,
computes SHA-256 checksum and file size.
"""

import os
import sys
import subprocess
import hashlib
from urllib.parse import urlparse
from datetime import datetime, timezone

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
project_root = os.path.abspath(os.path.join(backend_dir, ".."))
sys.path.insert(0, backend_dir)

from app.core.config import settings

def main():
    print("=== Task D: Mandatory Logical Backup Execution ===")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    print(f"Backup Timestamp (UTC): {timestamp}")
    
    # 1. Parse database connection parameters
    raw_url = settings.get_database_url()
    parsed = urlparse(raw_url)
    
    host = parsed.hostname
    port = str(parsed.port or 6543)
    user = parsed.username
    password = parsed.password
    dbname = parsed.path.lstrip('/')
    
    print(f"Target Host: {host}:{port}")
    print(f"Target Database: {dbname}")
    print(f"Target User: {user}")
    
    # 2. Setup backup directories (outside git tracking)
    backup_dir_local = os.path.join(project_root, "postgres-data", "backups")
    os.makedirs(backup_dir_local, exist_ok=True)
    
    dump_filename = f"visionplate_pre_0004_backup_{timestamp}.dump"
    dump_path_local = os.path.join(backup_dir_local, dump_filename)
    
    ca_cert_path = os.path.join(backend_dir, "prod-ca-2021.crt")
    assert os.path.isfile(ca_cert_path), "Root CA certificate prod-ca-2021.crt not found"
    
    # Target tables to dump
    tables = [
        "users", "oauth_accounts", "user_identities",
        "detections", "vehicles", "plates", "files",
        "reports", "audit_logs"
    ]
    
    table_args = []
    for t in tables:
        table_args.extend(["-t", f"public.{t}"])
        
    print(f"Dumping {len(tables)} tables to: {dump_path_local}")
    
    # 3. Execute pg_dump using Docker postgres:17-alpine
    # Mount local backup directory to /backups and ca cert to /root/.postgresql/root.crt
    pg_url = raw_url.replace("postgresql+asyncpg://", "postgresql://")
    docker_cmd = [
        "docker", "run", "--rm",
        "-e", "PGSSLMODE=require",
        "-v", f"{backup_dir_local}:/backups",
        "-v", f"{ca_cert_path}:/root/.postgresql/root.crt:ro",
        "postgres:17-alpine",
        "pg_dump",
        pg_url,
        "-F", "c",
        "-f", f"/backups/{dump_filename}",
    ] + table_args
    
    print("Running pg_dump in postgres:17-alpine container...")
    proc = subprocess.run(docker_cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print(f"[ERROR] pg_dump failed with return code {proc.returncode}")
        print("STDERR:", proc.stderr)
        sys.exit(1)
        
    print("pg_dump completed successfully.")
    
    # 4. Verify dump file exists and is non-empty
    if not os.path.isfile(dump_path_local):
        print(f"[ERROR] Dump file {dump_path_local} does not exist!")
        sys.exit(1)
        
    file_size = os.path.getsize(dump_path_local)
    print(f"Dump File Size: {file_size} bytes")
    if file_size == 0:
        print("[ERROR] Dump file is empty!")
        sys.exit(1)
        
    # 5. Compute SHA-256 Checksum
    with open(dump_path_local, "rb") as f:
        sha256 = hashlib.sha256(f.read()).hexdigest()
    print(f"Dump SHA-256 Checksum: {sha256}")
    
    # 6. Verify with pg_restore --list
    restore_cmd = [
        "docker", "run", "--rm",
        "-v", f"{backup_dir_local}:/backups",
        "postgres:17-alpine",
        "pg_restore", "--list", f"/backups/{dump_filename}"
    ]
    print("Verifying dump archive with pg_restore --list...")
    r_proc = subprocess.run(restore_cmd, capture_output=True, text=True)
    if r_proc.returncode != 0:
        print(f"[ERROR] pg_restore --list failed: {r_proc.stderr}")
        sys.exit(1)
        
    print("pg_restore --list verified successfully! Archive catalog preview:")
    catalog_lines = r_proc.stdout.strip().split("\n")
    for l in catalog_lines[:20]:
        print(f"  {l}")
    print(f"  ... ({len(catalog_lines)} catalog entries total)")
    
    # 7. Mirror to brain artifact directory as an extra persistent host copy
    brain_backup_dir = r"C:\Users\omkar\.gemini\antigravity\brain\81565ea5-33ea-422a-8979-795440a8085a\backups"
    os.makedirs(brain_backup_dir, exist_ok=True)
    brain_dump_path = os.path.join(brain_backup_dir, dump_filename)
    with open(dump_path_local, "rb") as src, open(brain_dump_path, "wb") as dst:
        dst.write(src.read())
    print(f"Mirrored backup to artifact directory: {brain_dump_path}")
    
    # 8. Record metadata to json
    meta = {
        "timestamp_utc": timestamp,
        "filename": dump_filename,
        "local_path": dump_path_local,
        "brain_path": brain_dump_path,
        "file_size_bytes": file_size,
        "sha256": sha256,
        "tables_included": tables,
        "pg_restore_catalog_count": len(catalog_lines),
        "status": "VERIFIED"
    }
    meta_path = os.path.join(backup_dir_local, f"backup_meta_{timestamp}.json")
    with open(meta_path, "w") as f:
        import json
        json.dump(meta, f, indent=2)
    print(f"Backup metadata recorded to: {meta_path}")
    print("TASK D BACKUP COMPLETE AND CERTIFIED.")

if __name__ == "__main__":
    main()
