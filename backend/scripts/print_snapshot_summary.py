import json

with open('backend/scripts/live_supabase_schema_snapshot.json') as f:
    data = json.load(f)

td = data['table_details']

for t in ['reports', 'audit_logs', 'users', 'oauth_accounts', 'user_identities', 'detections', 'vehicles', 'plates']:
    print(f"\n=================== TABLE: {t} ===================")
    info = td.get(t, {})
    cols = info.get('columns', [])
    print("Columns:")
    for c in cols:
        print(f"  - {c['column_name']} ({c['data_type']}) nullable={c['is_nullable']}, default={c['column_default']}")
    print("Primary Key:", info.get('primary_key'))
    print("Foreign Keys:")
    for fk in info.get('foreign_keys', []):
        print(f"  - {fk['constraint_name']}: {fk['column_name']} -> {fk['foreign_table_name']}.{fk['foreign_column_name']} (ON DELETE {fk['delete_rule']})")
    print("Unique Constraints:")
    for uq in info.get('unique_constraints', []):
        print(f"  - {uq['constraint_name']}: {uq['column_name']}")
    print("Indexes:")
    for idx in info.get('indexes', []):
        print(f"  - {idx['indexname']}: {idx['indexdef']}")

