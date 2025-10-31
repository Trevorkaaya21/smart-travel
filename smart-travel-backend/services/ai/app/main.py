from fastapi import FastAPI

app = FastAPI(title="Smart Travel AI", version="0.1.0")

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/v1/echo")
def echo(q: str):
    return {"echo": q}
