"""Run every assignment calculation and save a JSON report plus a PNG visualization."""
import json
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy.linalg import eig

OUT = Path(__file__).parent / "output"

def main():
    rng = np.random.default_rng(42)
    matrix = rng.normal(0, 1, (3, 100)); centered = matrix - matrix.mean(axis=1, keepdims=True)
    manual_cov = centered @ centered.T / 99; numpy_cov = np.cov(matrix)
    transition = np.array([[.7,.2,.1],[.3,.4,.3],[.2,.3,.5]])
    state, states = 0, [0]
    for _ in range(49): state = rng.choice(3, p=transition[state]); states.append(int(state))
    values, vectors = eig(transition.T); steady = np.real(vectors[:, np.argmin(abs(values-1))]); steady /= steady.sum()
    dates = pd.date_range("2026-01-01", periods=365, freq="D")
    frame = pd.DataFrame({"value":rng.normal(50,10,365)}, index=dates)
    frame["rolling_mean"] = frame.value.rolling(7).mean(); frame["expanding_std"] = frame.value.expanding(30).std()
    average, deviation = frame.value.mean(), frame.value.std(); outlier = abs(frame.value-average) > 2*deviation
    fig, axes = plt.subplots(1,2,figsize=(15,5)); axes[0].scatter(frame.index[~outlier],frame.value[~outlier],s=9,c="#10b981",label="Normal"); axes[0].scatter(frame.index[outlier],frame.value[outlier],s=14,c="#ef4444",label="Outlier"); axes[0].legend(); axes[0].set_title("Outlier detection (±2σ)")
    axes[1].plot(frame.index,frame.value,alpha=.4,label="Raw"); axes[1].plot(frame.index,frame.rolling_mean,color="#1e40af",label="7-day mean"); axes[1].fill_between(frame.index,frame.rolling_mean-frame.expanding_std,frame.rolling_mean+frame.expanding_std,alpha=.18,label="Expanding std"); axes[1].legend(); axes[1].set_title("Rolling mean and expanding standard deviation")
    fig.tight_layout(); OUT.mkdir(exist_ok=True); fig.savefig(OUT / "timeseries_analysis.png",dpi=160)
    report = {"covariance_manual":manual_cov.tolist(),"covariance_numpy":numpy_cov.tolist(),"correlation":np.corrcoef(matrix).tolist(),"markov_states":states,"steady_state":steady.tolist(),"statistics":{"mean":float(average),"std":float(deviation),"outliers":int(outlier.sum())}}
    (OUT / "results.json").write_text(json.dumps(report,indent=2)); print(f"Saved results to {OUT}")
if __name__ == "__main__": main()
