from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import func
from sqlmodel import Session, select

from .db import criar_tabelas, get_session
from .models import Participante, ParticipanteCreate, ParticipantePublico

import secrets
import string

from sqlalchemy.exc import IntegrityError

from fastapi.staticfiles import StaticFiles





@asynccontextmanager
async def lifespan(app: FastAPI):
    criar_tabelas()
    yield


app = FastAPI(title="Mapa político", lifespan=lifespan)

SessionDep = Annotated[Session, Depends(get_session)]

@app.get("/saude")
def saude():
    return {"ok": True}


ALFABETO_TAG = string.ascii_uppercase + string.digits


def gerar_tag() -> str:
    return "".join(secrets.choice(ALFABETO_TAG) for _ in range(4))


def usuario_existe(session: Session, apelido: str, tag: str) -> bool:
    return session.exec(
        select(Participante).where(
            Participante.apelido_lower == apelido.lower(),
            Participante.tag == tag,
        )
    ).first() is not None


@app.post("/participantes", response_model=ParticipantePublico, status_code=201)
def criar_participante(dados: ParticipanteCreate, session: SessionDep):
    tag = dados.tag

    if tag is None:
        # sorteia até achar uma tag livre para esse apelido
        for _ in range(10):
            candidata = gerar_tag()
            if not usuario_existe(session, dados.apelido, candidata):
                tag = candidata
                break
        else:
            raise HTTPException(status_code=503, detail="Tente novamente")
    elif usuario_existe(session, dados.apelido, tag):
        raise HTTPException(status_code=409, detail="Essa combinação já está em uso")

    participante = Participante(
        apelido=dados.apelido,
        apelido_lower=dados.apelido.lower(),
        tag=tag,
        x=dados.x,
        y=dados.y,
        metodo=dados.metodo,
    )
    session.add(participante)
    try:
        session.commit()
    except IntegrityError:
        # duas requisições simultâneas com a mesma combinação
        session.rollback()
        raise HTTPException(status_code=409, detail="Essa combinação já está em uso")
    session.refresh(participante)
    return participante

@app.get("/participantes", response_model=list[ParticipantePublico])
def listar_participantes(session: SessionDep):
    return session.exec(select(Participante)).all()




app.mount("/", StaticFiles(directory="static", html=True), name="static")