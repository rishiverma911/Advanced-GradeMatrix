"""FastAPI service for the Advanced Math & Python Assignment application."""
from pathlib import Path
from typing import Annotated

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, model_validator
from scipy.linalg import eig

ROOT = Path(__file__).resolve().parent.parent
app = FastAPI(title="Advanced Math & Python Assignment API", version="1.0.0")


class CovarianceRequest(BaseModel):
    rows: int = Field(3, ge=2, le=30)
    columns: int = Field(100, ge=2, le=10_000)
    mean: float = 0
    std: float = Field(1, gt=0)


class MarkovRequest(BaseModel):
    transition_matrix: list[list[float]]
    start_state: int = Field(0, ge=0, le=2)
    steps: int = Field(50, ge=5, le=1_000)

    @model_validator(mode="after")
    def valid_matrix(self):
        matrix = np.array(self.transition_matrix, dtype=float)
        if matrix.shape != (3, 3) or np.any(matrix < 0) or not np.allclose(matrix.sum(axis=1), 1):
            raise ValueError("transition_matrix must be a non-negative 3×3 matrix whose rows sum to 1")
        return self


class TimeSeriesRequest(BaseModel):
    days: int = Field(365, ge=30, le=10_000)
    mean: float = 50
    std: float = Field(10, gt=0)
    rolling_window: int = Field(7, ge=2, le=365)
    expanding_window: int = Field(30, ge=2, le=365)


def as_list(values):
    return [None if pd.isna(v) else float(v) for v in values]


@app.post("/api/covariance")
def covariance(body: CovarianceRequest):
    matrix = np.random.normal(body.mean, body.std, (body.rows, body.columns))
    centered = matrix - matrix.mean(axis=1, keepdims=True)
    manual = (centered @ centered.T) / (body.columns - 1)
    return {"matrix": matrix.tolist(), "covariance_manual": manual.tolist(),
            "covariance_numpy": np.cov(matrix).tolist(), "correlation": np.corrcoef(matrix).tolist()}


@app.post("/api/markov/simulate")
def simulate_markov(body: MarkovRequest):
    transition = np.array(body.transition_matrix, dtype=float)
    state, states = body.start_state, [body.start_state]
    probability = np.eye(3)[state]
    evolution = [probability.tolist()]
    for _ in range(body.steps - 1):
        state = int(np.random.choice(3, p=transition[state]))
        states.append(state)
        probability = probability @ transition
        evolution.append(probability.tolist())
    return {"states": states, "probabilities": evolution}


@app.post("/api/markov/steady-state")
def steady_state(body: MarkovRequest):
    transition = np.array(body.transition_matrix, dtype=float)
    values, vectors = eig(transition.T)
    vector = np.real(vectors[:, np.argmin(np.abs(values - 1))])
    vector = vector / vector.sum()
    return {"steady_state": vector.tolist()}


@app.post("/api/timeseries/analyze")
def analyze_time_series(body: TimeSeriesRequest):
    if body.rolling_window > body.days or body.expanding_window > body.days:
        raise HTTPException(422, "Windows cannot exceed the number of days")
    index = pd.date_range("2026-01-01", periods=body.days, freq="D")
    frame = pd.DataFrame({"value": np.random.normal(body.mean, body.std, body.days)}, index=index)
    frame["rolling_mean"] = frame.value.rolling(body.rolling_window).mean()
    frame["expanding_std"] = frame.value.expanding(body.expanding_window).std()
    average, deviation = frame.value.mean(), frame.value.std()
    outliers = (frame.value.sub(average).abs() > 2 * deviation)
    return {"dates": frame.index.strftime("%Y-%m-%d").tolist(), "values": as_list(frame.value),
            "rolling_mean": as_list(frame.rolling_mean), "expanding_std": as_list(frame.expanding_std),
            "outliers": outliers.tolist(), "statistics": {"mean": float(average), "std": float(deviation),
            "min": float(frame.value.min()), "max": float(frame.value.max()), "q25": float(frame.value.quantile(.25)),
            "q50": float(frame.value.quantile(.5)), "q75": float(frame.value.quantile(.75)),
            "nan_count_before": 0, "nan_count_after": int(frame.rolling_mean.isna().sum() + frame.expanding_std.isna().sum())}}


app.mount("/static", StaticFiles(directory=ROOT), name="static")


@app.get("/styles.css", include_in_schema=False)
def styles():
    return FileResponse(ROOT / "styles.css", media_type="text/css")


@app.get("/app.js", include_in_schema=False)
def javascript():
    return FileResponse(ROOT / "app.js", media_type="application/javascript")

@app.get("/", include_in_schema=False)
def homepage():
    return FileResponse(ROOT / "index.html")
