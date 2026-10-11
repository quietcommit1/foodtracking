"""Build a small searchable catalog from public-domain USDA SR28 ASCII files.
Usage: python3 scripts/build-usda-catalog.py /path/to/SR28
No API key or database upload. Source hashes are recorded for reproducibility.
"""
import sys, pathlib, hashlib, json, math
root=pathlib.Path(sys.argv[1]); out=pathlib.Path(__file__).resolve().parents[1]/'src/data/usda-sr28.json'
nutrients={'208':0,'203':1,'205':2,'204':3,'291':4}
rows={}
for line in (root/'FOOD_DES.txt').read_text(encoding='latin1').splitlines():
 fields=[x.strip('~') for x in line.split('^')]
 if fields[0] in rows: raise ValueError('Duplicate food ID')
 rows[fields[0]]=[fields[0],fields[2],None,None,None,None,None]
for line in (root/'NUT_DATA.txt').read_text(encoding='latin1').splitlines():
 fields=[x.strip('~') for x in line.split('^')]
 if fields[1] in nutrients and fields[0] in rows:
  value=float(fields[2])
  if not math.isfinite(value) or value<0: raise ValueError('Invalid nutrient')
  rows[fields[0]][2+nutrients[fields[1]]]=value
out.write_text(json.dumps(list(rows.values()),ensure_ascii=False,separators=(',',':'))+'\n')
meta={'source':'USDA National Nutrient Database for Standard Reference, Release 28 (2015, revised 2016)', 'license':'US federal government food-composition data, public domain', 'official_url':'https://fdc.nal.usda.gov/download-datasets', 'mirror':'https://github.com/alyssaq/usda-sqlite', 'mirror_commit':'1e457b599af101ce463a195867574eba16c81acb', 'food_count':len(rows), 'basis':'per 100 g edible portion, as described in food name', 'columns':['NDB ID','Description','kcal (208)','protein g (203)','carbohydrate by difference g (205)','total lipid g (204)','dietary fibre g (291)'], 'source_sha256':{name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in ['FOOD_DES.txt','NUT_DATA.txt']}}
(out.parent/'usda-sr28.meta.json').write_text(json.dumps(meta,indent=2)+'\n')
print(f'{len(rows)} foods, {out.stat().st_size} bytes; missing nutrients kept null.')
