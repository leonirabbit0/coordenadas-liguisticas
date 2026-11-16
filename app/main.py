import hashlib
import random
import secrets
import string
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from .db import criar_tabelas, get_session
from .models import (
    Participante,
    ParticipanteCreate,
    ParticipanteCriado,
    ParticipantePublico,
    ParticipanteUpdate,
    agora,
)
from .perguntas import PERGUNTAS, calcular_posicao


@asynccontextmanager
async def lifespan(app: FastAPI):
    criar_tabelas()
    yield


app = FastAPI(title="Mapa do grupo", lifespan=lifespan)

SessionDep = Annotated[Session, Depends(get_session)]

ALFABETO_TAG = string.ascii_uppercase + string.digits


def gerar_tag() -> str:
    return "".join(secrets.choice(ALFABETO_TAG) for _ in range(4))


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def usuario_existe(session: Session, apelido: str, tag: str) -> bool:
    return session.exec(
        select(Participante).where(
            Participante.apelido_lower == apelido.lower(),
            Participante.tag == tag,
        )
    ).first() is not None


@app.get("/saude")
def saude():
    return {"ok": True}


@app.get("/perguntas")
def listar_perguntas():
    # o front só precisa do id e do texto; eixo e sentido ficam no servidor
    publicas = [{"id": p["id"], "texto": p["texto"]} for p in PERGUNTAS]
    random.shuffle(publicas)  # ordem diferente a cada carregamento
    return publicas


@app.post("/participantes", response_model=ParticipanteCriado, status_code=201)
def criar_participante(dados: ParticipanteCreate, session: SessionDep):
    tag = dados.tag

    if tag is None:
        for _ in range(10):
            candidata = gerar_tag()
            if not usuario_existe(session, dados.apelido, candidata):
                tag = candidata
                break
        else:
            raise HTTPException(status_code=503, detail="Tente novamente")
    elif usuario_existe(session, dados.apelido, tag):
        raise HTTPException(status_code=409, detail="Essa combinação já está em uso")

    x, y = calcular_posicao({r.pergunta: r.valor for r in dados.respostas})
    token = secrets.token_urlsafe(32)

    participante = Participante(
        apelido=dados.apelido,
        apelido_lower=dados.apelido.lower(),
        tag=tag,
        x=x,
        y=y,
        cor=dados.cor,
        token_hash=hash_token(token),
    )
    session.add(participante)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="Essa combinação já está em uso")
    session.refresh(participante)

    return ParticipanteCriado(**participante.model_dump(), token=token)


@app.put("/participantes/{participante_id}", response_model=ParticipantePublico)
def atualizar_participante(
    participante_id: int,
    dados: ParticipanteUpdate,
    session: SessionDep,
    x_token: Annotated[str, Header()],
):
    participante = session.get(Participante, participante_id)

    # mesma resposta para "não existe" e "token errado", para não revelar nada
    if participante is None or not secrets.compare_digest(
        participante.token_hash, hash_token(x_token)
    ):
        raise HTTPException(status_code=403, detail="Token inválido")

    x, y = calcular_posicao({r.pergunta: r.valor for r in dados.respostas})
    participante.x = x
    participante.y = y
    participante.cor = dados.cor
    participante.atualizado_em = agora()

    session.add(participante)
    session.commit()
    session.refresh(participante)
    return participante


@app.get("/participantes", response_model=list[ParticipantePublico])
def listar_participantes(session: SessionDep):
    return session.exec(select(Participante)).all()


# precisa ficar por último, depois de todas as rotas
app.mount("/", StaticFiles(directory="static", html=True), name="static")