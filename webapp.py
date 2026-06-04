#! /usr/bin/env python3
# Application web FastAPI — consultation en lecture seule de la bibliothèque.
# Lancement : uvicorn webapp:app   (ou : python webapp.py)
# Hôte/port/chemin base configurables par variables d'environnement.
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
import database


@asynccontextmanager
async def lifespan(app: FastAPI):
    # N'initialise que si ce n'est pas déjà fait (les tests pré-initialisent ':memory:').
    if not database.is_initialized():
        database.init_db(os.environ.get("LIBRARY_DB", database.DEFAULT_PATH))
    yield


app = FastAPI(title="Bibliothèque", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("LIBRARY_HOST", "127.0.0.1")
    port = int(os.environ.get("LIBRARY_PORT", "8000"))
    uvicorn.run("webapp:app", host=host, port=port)
