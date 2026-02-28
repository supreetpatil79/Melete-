# Operations Runbook

## Start Services

### Local split mode

```bash
npm install
npm run server:dev
npm run dev
```

### Docker mode

```bash
npm run docker:up
```

## Health Verification

```bash
curl http://127.0.0.1:4000/healthz
curl http://127.0.0.1:4000/readyz
curl http://127.0.0.1:4000/metrics
```

## Search Verification

```bash
curl "http://127.0.0.1:4000/search?q=two%20sum&limit=10"
curl "http://127.0.0.1:4000/search/autocomplete?q=mach&limit=6"
```

## Reindex Unified Search

```bash
curl -X POST http://127.0.0.1:4000/search/reindex \
  -H "Content-Type: application/json" \
  -d '{"reason":"manual-sync"}'
```

## Practice Runtime Verification

```bash
curl http://127.0.0.1:4000/api/code/languages
```

Run one execution test:

```bash
curl -X POST http://127.0.0.1:4000/api/code/execute \
  -H "Content-Type: application/json" \
  -d '{
    "languageId": 1,
    "sourceCode": "function solve(rawInput){const data=JSON.parse(rawInput);return data.a+data.b;} const fs=require(\"fs\"); const raw=fs.readFileSync(0,\"utf8\").trim(); process.stdout.write(String(solve(raw)));",
    "testCases": [{"input":"{\"a\":2,\"b\":3}","expectedOutput":"5"}]
  }'
```

## Shutdown

```bash
npm run docker:down
```
