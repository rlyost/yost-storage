"""Preserve the TitanLog workout backup as data; never execute embedded strings."""
from pathlib import Path
import datetime
import hashlib
import json
import math
import sys


def extract(path):
    source = Path(path)
    backup = json.loads(source.read_text(encoding='utf-8-sig'))
    if not isinstance(backup, dict) or backup.get('formatVersion') != 2:
        raise ValueError('Expected a TitanLog formatVersion 2 backup')
    for key in ('workouts', 'exercises', 'personalRecords', 'bodyMeasurements', 'routines', 'templates'):
        if not isinstance(backup.get(key), list):
            raise ValueError('Missing backup collection: '+key)
    if not isinstance(backup.get('preferences'), dict):
        raise ValueError('Missing backup preferences')
    datetime.datetime.fromisoformat(backup['exportedAt'].replace('Z', '+00:00'))
    exercise_ids = {item['id'].upper() for item in backup['exercises']}
    if len(exercise_ids) != len(backup['exercises']):
        raise ValueError('Duplicate exercise IDs')
    ids = set()
    for workout in backup['workouts']:
        if workout['id'] in ids:
            raise ValueError('Duplicate workout ID')
        ids.add(workout['id'])
        datetime.datetime.fromisoformat(workout['startedAt'].replace('Z', '+00:00'))
        for key in ('totalVolumeKg', 'totalDurationSeconds'):
            if not isinstance(workout.get(key), (int, float)) or not math.isfinite(workout[key]) or workout[key] < 0:
                raise ValueError('Invalid recorded workout total: '+key)
        for entry in workout['exercises']:
            if entry['exerciseId'].upper() not in exercise_ids:
                raise ValueError('Workout exercise is missing from the catalog')
            if not isinstance(entry.get('sets'), list):
                raise ValueError('Missing exercise sets')
    return {'sourceFile': source.name, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'backup': backup}


if __name__ == '__main__':
    data = extract(sys.argv[1])
    destination = Path(__file__).resolve().parents[2] / 'dashboards' / 'titanlog-data.js'
    destination.write_text('window.TITANLOG_DATA = '+json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False)+';\n')
    print(json.dumps({'workouts': len(data['backup']['workouts']), 'exercises': len(data['backup']['exercises']), 'records': len(data['backup']['personalRecords'])}))
