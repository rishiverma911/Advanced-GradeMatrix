const $ = (id) => document.getElementById(id);
let matrixData = [];
let seriesData = [];
const apiMode = location.protocol !== 'file:';
const colors = ['#2864ef', '#09a67a', '#ed8b18'];

const randomNormal = (mean = 0, deviation = 1) => {
  const u = 1 - Math.random();
  const v = Math.random();
  return mean + deviation * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const mean = (values) => values.reduce((total, value) => total + value, 0) / values.length;
const std = (values) => {
  const average = mean(values);
  return Math.sqrt(values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1));
};
const table = (matrix) => `<table class="matrix-table"><tbody>${matrix.map((row) => `<tr>${row.map((value) => `<td>${value.toFixed(4)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

const presets = {
  weather: [[.7, .2, .1], [.3, .4, .3], [.2, .3, .5]],
  traffic: [[.65, .25, .1], [.2, .55, .25], [.1, .3, .6]],
  economic: [[.8, .15, .05], [.2, .6, .2], [.1, .25, .65]],
};

function transitionInputs(matrix = presets.weather) {
  $('transitionGrid').innerHTML = matrix.flatMap((row, rowIndex) => row.map((value, columnIndex) =>
    `<input class="transition" data-r="${rowIndex}" data-c="${columnIndex}" type="number" step=".01" min="0" max="1" value="${value}">`
  )).join('');
}

function drawCanvas(canvas, datasets, options = {}) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;

  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const padding = { left: 48, right: 10, top: 12, bottom: 38 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = datasets.flatMap((dataset) => dataset.values).filter(Number.isFinite);
  if (!values.length) return;
  let low = options.min ?? Math.min(...values);
  let high = options.max ?? Math.max(...values);
  if (high === low) high = low + 1;

  const x = (index) => padding.left + index * plotWidth / Math.max(1, options.length - 1);
  const y = (value) => padding.top + (high - value) * plotHeight / (high - low);
  ctx.font = '10px DM Mono, monospace';
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#e3eaf3';
  ctx.fillStyle = '#596779';
  for (let index = 0; index < 5; index += 1) {
    const lineY = padding.top + index * plotHeight / 4;
    const value = high - index * (high - low) / 4;
    ctx.beginPath(); ctx.moveTo(padding.left, lineY); ctx.lineTo(width - padding.right, lineY); ctx.stroke();
    ctx.fillText(value.toFixed(high - low < 2 ? 2 : 0), 3, lineY + 3);
  }
  ctx.strokeStyle = '#8c99a9';
  ctx.beginPath(); ctx.moveTo(padding.left, padding.top); ctx.lineTo(padding.left, height - padding.bottom); ctx.lineTo(width - padding.right, height - padding.bottom); ctx.stroke();

  datasets.forEach((dataset) => {
    ctx.strokeStyle = dataset.color;
    ctx.fillStyle = dataset.color;
    ctx.lineWidth = dataset.width || 1.5;
    ctx.setLineDash(dataset.dash || []);
    if (!dataset.scatter) {
      let drawing = false;
      ctx.beginPath();
      dataset.values.forEach((value, index) => {
        if (!Number.isFinite(value)) { drawing = false; return; }
        if (drawing) ctx.lineTo(x(index), y(value)); else { ctx.moveTo(x(index), y(value)); drawing = true; }
      });
      ctx.stroke();
    }
    ctx.setLineDash([]);
    if (dataset.points) dataset.values.forEach((value, index) => {
      if (!Number.isFinite(value)) return;
      ctx.beginPath(); ctx.arc(x(index), y(value), 2, 0, 2 * Math.PI); ctx.fill();
    });
  });

  datasets.forEach((dataset, index) => {
    const legendX = padding.left + index * 120;
    ctx.fillStyle = dataset.color; ctx.fillRect(legendX, height - 15, 8, 3);
    ctx.fillStyle = '#53647a'; ctx.fillText(dataset.name, legendX + 12, height - 11);
  });
}

async function request(path, body) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.detail || 'The calculation request failed.');
  }
  return response.json();
}

function busy(id, active, label) {
  const button = $(id);
  button.disabled = active;
  button.textContent = active ? 'CALCULATING...' : label;
}

function browserCovariance() {
  const rows = +$('rows').value, columns = +$('columns').value, average = +$('matrixMean').value, deviation = +$('matrixStd').value;
  matrixData = Array.from({ length: rows }, () => Array.from({ length: columns }, () => randomNormal(average, deviation)));
  const averages = matrixData.map(mean);
  const covariance = matrixData.map((row, rowIndex) => matrixData.map((other, otherIndex) => row.reduce((total, value, index) => total + (value - averages[rowIndex]) * (other[index] - averages[otherIndex]), 0) / (columns - 1)));
  const correlation = covariance.map((row, rowIndex) => row.map((value, columnIndex) => value / Math.sqrt(covariance[rowIndex][rowIndex] * covariance[columnIndex][columnIndex])));
  $('manualCovariance').innerHTML = table(covariance);
  $('builtinCovariance').innerHTML = table(covariance);
  $('correlation').innerHTML = table(correlation);
}

async function covariance() {
  if (!apiMode) return browserCovariance();
  busy('covarianceBtn', true, 'GENERATE & CALCULATE');
  try {
    const result = await request('/api/covariance', { rows: +$('rows').value, columns: +$('columns').value, mean: +$('matrixMean').value, std: +$('matrixStd').value });
    matrixData = result.matrix;
    $('manualCovariance').innerHTML = table(result.covariance_manual);
    $('builtinCovariance').innerHTML = table(result.covariance_numpy);
    $('correlation').innerHTML = table(result.correlation);
  } catch (error) { alert(error.message); } finally { busy('covarianceBtn', false, 'GENERATE & CALCULATE'); }
}

function readTransitionMatrix() {
  const inputs = [...document.querySelectorAll('.transition')];
  return Array.from({ length: 3 }, (_, row) => Array.from({ length: 3 }, (_, column) => +inputs[row * 3 + column].value));
}

function renderMarkov(probabilities, states, steadyState) {
  drawCanvas($('markovChart'), [0, 1, 2].map((state) => ({ name: `STATE ${state}`, color: colors[state], values: probabilities.map((row) => row[state]) })), { length: probabilities.length, min: 0, max: 1 });
  $('steadyState').innerHTML = steadyState.map((value, state) => `<p><b>STATE ${state}:</b><span>${(value * 100).toFixed(2)}%</span></p>`).join('');
  $('stateSequence').textContent = states.slice(0, 50).join(' → ');
}

function browserMarkov() {
  const transition = readTransitionMatrix();
  const steps = +$('steps').value;
  const start = Math.min(2, Math.max(0, +$('startingState').value));
  let distribution = [0, 0, 0];
  distribution[start] = 1;
  const probabilities = [distribution.slice()];
  let state = start;
  const states = [state];
  for (let step = 1; step < steps; step += 1) {
    distribution = distribution.map((_, to) => distribution.reduce((total, probability, from) => total + probability * transition[from][to], 0));
    probabilities.push(distribution.slice());
    let cumulative = 0;
    const random = Math.random();
    state = transition[state].findIndex((probability) => (cumulative += probability) >= random);
    states.push(state);
  }
  renderMarkov(probabilities, states, distribution);
}

async function markov() {
  const transition_matrix = readTransitionMatrix();
  if (transition_matrix.some((row) => Math.abs(row.reduce((total, value) => total + value, 0) - 1) > .01)) { alert('Each transition-matrix row must total 1.'); return; }
  if (!apiMode) return browserMarkov();
  busy('markovBtn', true, 'SIMULATE MARKOV CHAIN');
  try {
    const body = { transition_matrix, start_state: Math.min(2, Math.max(0, +$('startingState').value)), steps: +$('steps').value };
    const [simulation, equilibrium] = await Promise.all([request('/api/markov/simulate', body), request('/api/markov/steady-state', body)]);
    renderMarkov(simulation.probabilities, simulation.states, equilibrium.steady_state);
  } catch (error) { alert(error.message); } finally { busy('markovBtn', false, 'SIMULATE MARKOV CHAIN'); }
}

function renderSeries(values, rolling, expanding, outliers) {
  const normal = values.map((value, index) => outliers[index] ? NaN : value);
  const outside = values.map((value, index) => outliers[index] ? value : NaN);
  drawCanvas($('outlierChart'), [{ name: 'NORMAL', color: '#12b887', values: normal, points: true, scatter: true }, { name: 'OUTLIER', color: '#f15858', values: outside, points: true, scatter: true }], { length: values.length });
  const upper = rolling.map((value, index) => Number.isFinite(value) && Number.isFinite(expanding[index]) ? value + expanding[index] : NaN);
  const lower = rolling.map((value, index) => Number.isFinite(value) && Number.isFinite(expanding[index]) ? value - expanding[index] : NaN);
  drawCanvas($('seriesChart'), [{ name: 'RAW DATA', color: '#a7c9ff', values, width: 1 }, { name: '+1 STD', color: '#78a9ff', values: upper, dash: [3, 3], width: 1 }, { name: '-1 STD', color: '#78a9ff', values: lower, dash: [3, 3], width: 1 }, { name: 'ROLLING MEAN', color: '#174eb4', values: rolling, width: 2 }], { length: values.length });
}

function renderStatistics(statistics) {
  $('statistics').innerHTML = statistics.map(([label, value]) => `<div class="stat"><span>${label}</span><strong>${Number(value).toFixed(2)}</strong></div>`).join('');
}

function browserSeries() {
  const days = +$('days').value, average = +$('seriesMean').value, deviation = +$('seriesStd').value;
  const rollingWindow = Math.max(2, +$('rollingWindow').value), expandingWindow = Math.max(2, +$('expandingWindow').value);
  const values = Array.from({ length: days }, () => randomNormal(average, deviation));
  seriesData = values.map((value, index) => ({ date: new Date(2026, 0, index + 1).toISOString().slice(0, 10), value }));
  const rolling = values.map((_, index) => index < rollingWindow - 1 ? NaN : mean(values.slice(index - rollingWindow + 1, index + 1)));
  const expanding = values.map((_, index) => index < expandingWindow - 1 ? NaN : std(values.slice(0, index + 1)));
  const dataMean = mean(values), dataStd = std(values), outliers = values.map((value) => Math.abs(value - dataMean) > 2 * dataStd);
  renderSeries(values, rolling, expanding, outliers);
  const sorted = [...values].sort((a, b) => a - b), quantile = (fraction) => sorted[Math.floor(fraction * (days - 1))];
  renderStatistics([['Mean', dataMean], ['Std', dataStd], ['Min', Math.min(...values)], ['Max', Math.max(...values)], ['Q25', quantile(.25)], ['Q50', quantile(.5)], ['Q75', quantile(.75)], ['NaN Count Before', rolling.filter(Number.isNaN).length + expanding.filter(Number.isNaN).length], ['NaN Count After', 0]]);
}

async function series() {
  if (!apiMode) return browserSeries();
  busy('seriesBtn', true, 'GENERATE & ANALYZE');
  try {
    const result = await request('/api/timeseries/analyze', { days: +$('days').value, mean: +$('seriesMean').value, std: +$('seriesStd').value, rolling_window: +$('rollingWindow').value, expanding_window: +$('expandingWindow').value });
    seriesData = result.dates.map((date, index) => ({ date, value: result.values[index] }));
    renderSeries(result.values, result.rolling_mean, result.expanding_std, result.outliers);
    const stats = result.statistics;
    renderStatistics([['Mean', stats.mean], ['Std', stats.std], ['Min', stats.min], ['Max', stats.max], ['Q25', stats.q25], ['Q50', stats.q50], ['Q75', stats.q75], ['NaN Count Before', stats.nan_count_before], ['NaN Count After', stats.nan_count_after]]);
  } catch (error) { alert(error.message); } finally { busy('seriesBtn', false, 'GENERATE & ANALYZE'); }
}

function download(type) {
  if (!seriesData.length) return;
  const content = type === 'json' ? JSON.stringify(seriesData, null, 2) : `date,value\n${seriesData.map((item) => `${item.date},${item.value}`).join('\n')}`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type: type === 'json' ? 'application/json' : 'text/csv' }));
  link.download = type === 'json' ? 'time-series.json' : 'time-series.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

document.querySelectorAll('.tab').forEach((button) => button.onclick = () => {
  document.querySelectorAll('.tab, .panel').forEach((element) => element.classList.remove('active'));
  button.classList.add('active');
  $(button.dataset.tab).classList.add('active');
  if (button.dataset.tab === 'series') requestAnimationFrame(series);
});
document.querySelectorAll('.preset').forEach((button) => button.onclick = () => transitionInputs(presets[button.dataset.preset]));
$('covarianceBtn').onclick = covariance;
$('markovBtn').onclick = markov;
$('seriesBtn').onclick = series;
$('steps').oninput = (event) => { $('stepsLabel').textContent = event.target.value; };
$('jsonBtn').onclick = () => download('json');
$('csvBtn').onclick = () => download('csv');
$('apiStatus').textContent = apiMode ? '· API CONNECTED' : '· BROWSER MODE';

transitionInputs();
covariance();
markov();
