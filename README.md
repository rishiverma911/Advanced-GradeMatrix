# Advanced Math & Python Assignment

Interactive linear algebra, probability, and time-series application with a FastAPI calculation service and a standalone Python solver.

## Run the web application

```powershell
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.server:app --reload
```

Open `http://127.0.0.1:8000`. Interactive API documentation is at `/docs`.

## Run the standalone solution

```powershell
python backend/assignment_solver.py
```

It writes `backend/output/results.json` and `backend/output/timeseries_analysis.png`.
