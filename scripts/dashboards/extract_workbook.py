"""Extract values from the Lab Results worksheet; never execute workbook content."""
import datetime
import hashlib
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def extract(path):
    with zipfile.ZipFile(path) as archive:
        strings = [''.join(node.itertext()) for node in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('s:si', NS)]
        rows = []
        for row in ET.fromstring(archive.read('xl/worksheets/sheet1.xml')).findall('s:sheetData/s:row', NS):
            cells = {}
            for cell in row:
                value = cell.find('s:v', NS)
                text = value.text if value is not None else ''
                if cell.get('t') == 's':
                    text = strings[int(text)]
                elif cell.get('t') == 'inlineStr':
                    text = ''.join(cell.find('s:is', NS).itertext())
                cells[re.sub(r'\d', '', cell.get('r'))] = text
            if any(cells.values()):
                rows.append((int(row.get('r')), cells))
        headers = rows[0][1]
        samples = []
        for column, text in headers.items():
            if column in ('A', 'B'):
                continue
            parts = text.split('\n')
            date = datetime.datetime.strptime(parts[0], '%m/%d/%Y').date().isoformat()
            samples.append({'id': column, 'date': date, 'lab': parts[1].strip('()') if len(parts) > 1 else 'Not specified'})
        tests, panel = [], None
        for rownum, cells in rows[2:]:
            name = cells.get('A', '')
            if not name:
                continue
            reference = cells.get('B', '')
            if not reference and not any(cells.get(sample['id']) for sample in samples):
                panel = name
                continue
            match = re.match(r'^(?:(<|>|≤|≥)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?))(?:\s+(.*))?$', reference)
            limits = None
            units = '%' if name.endswith('(%)') else ''
            if match:
                comparator, bound, low, high, units = match.groups()
                limits = {'op': comparator, 'bound': float(bound)} if comparator else {'min': float(low), 'max': float(high)}
                units = units or ''
            results = {}
            for sample in samples:
                raw = cells.get(sample['id'], '')
                if not raw:
                    continue
                match_value = re.fullmatch(r'([<>≤≥]?)\s*(-?\d+(?:\.\d+)?)', raw)
                if not match_value:
                    raise ValueError('Unsupported value at '+sample['id']+str(rownum))
                qualifier, number = match_value.groups()
                value = float(number)
                display = qualifier + format(value, '.12g')
                results[sample['id']] = {'value': value, 'qualifier': qualifier, 'display': display, 'cell': sample['id']+str(rownum)}
            tests.append({'id': 'test-'+str(rownum), 'name': name, 'panel': panel, 'reference': reference, 'limits': limits, 'units': units, 'sourceRow': rownum, 'results': results})
    return {'person': 'Rick Yost', 'sourceFile': Path(path).name, 'sheet': 'Lab Results', 'sha256': hashlib.sha256(Path(path).read_bytes()).hexdigest(), 'samples': samples, 'tests': tests}

if __name__ == '__main__':
    data = extract(sys.argv[1])
    destination = Path(__file__).resolve().parents[2] / 'dashboards' / 'data.js'
    destination.write_text('window.LAB_DATA = '+json.dumps(data, ensure_ascii=False, separators=(',', ':'))+';\n')
    print(json.dumps({'markers': len(data['tests']), 'samples': len(data['samples']), 'measurements': sum(len(t['results']) for t in data['tests']), 'panels': list(dict.fromkeys(t['panel'] for t in data['tests']))}))
