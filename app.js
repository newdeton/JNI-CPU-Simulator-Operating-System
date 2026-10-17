
(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  const COLORS = [
    '#d9e5ff', '#d9f5e9', '#ffe8d4', '#f0e0ff', '#ffdfeb',
    '#e5edbd', '#d7f1f6', '#ffe6a8', '#e3e6ef', '#dce2ff'
  ];

  const DEFAULT_PROCESSES = [
    { id: 'P1', arrival: 0, burst: 5, priority: 2 },
    { id: 'P2', arrival: 1, burst: 3, priority: 1 },
    { id: 'P3', arrival: 2, burst: 8, priority: 3 }
  ];

  const TIME_UNIT_WIDTH = 58;
  const EPSILON = 1e-9;

  let processes = DEFAULT_PROCESSES.map(p => ({ ...p }));
  let timeline = [];
  let stepIndex = 0;
  let timer = null;
  let isRunning = false;
  let colorById = {};
  let activeResult = null;
  let activePolicy = null;
  let executionPanel = null;
  let autoPanel = null;
  let autoButton = null;

  const cloneProcesses = () => processes.map(p => ({ ...p }));

  const fmt = value =>
    Number.isFinite(value)
      ? Number(value.toFixed(2)).toString()
      : '—';

  const average = (rows, key) =>
    rows.length
      ? rows.reduce((sum, row) => sum + row[key], 0) / rows.length
      : 0;

  const escapeHtml = value =>
    String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);

  function colorFor(id) {
    if (!colorById[id]) {
      colorById[id] =
        COLORS[Object.keys(colorById).length % COLORS.length];
    }
    return colorById[id];
  }

  function setStatus(label, className = '') {
    $('statusBadge').textContent = label;
    $('statusBadge').className = `status-badge ${className}`;
  }

  function selectedAlgorithm() {
    return $('algorithmSelect').value;
  }

  function selectedMode() {
    return $('modeSelect').value;
  }

  function selectedQuantum() {
    const value = Number($('quantumInput').value);
    return Number.isInteger(value) && value >= 1 ? value : 2;
  }

  // --------------------------------------------------
  // OPTIONAL UI: EXECUTION SUMMARY AND AUTO SELECTOR
  // --------------------------------------------------

  function ensureExtraUI() {
    if (!executionPanel) {
      executionPanel = document.createElement('section');
      executionPanel.className = 'panel execution-summary-panel';
      executionPanel.style.cssText =
        'margin-top:20px;padding:20px;border-radius:12px;background:var(--panel,#fff);';

      executionPanel.innerHTML = `
        <h2>Execution Summary</h2>
        <p class="muted">
          Process-by-process explanation from arrival to completion.
        </p>
        <div id="executionSummaryContent">
          Run a simulation to generate the execution report.
        </div>
      `;

      const metricsTable = $('metricsRows')?.closest('table');
      const anchor = metricsTable?.closest('.panel') ||
        metricsTable?.parentElement ||
        $('ganttChart')?.parentElement;

      if (anchor?.parentElement) {
        anchor.insertAdjacentElement('afterend', executionPanel);
      } else {
        document.body.appendChild(executionPanel);
      }
    }

    if (!autoButton) {
      autoButton = document.createElement('button');
      autoButton.type = 'button';
      autoButton.id = 'autoSelectBtn';
      autoButton.className = 'primary-btn';
      autoButton.textContent = 'Auto-select & Run';
      autoButton.style.cssText = 'margin-top:10px;';

      const algorithmSelect = $('algorithmSelect');
      algorithmSelect?.insertAdjacentElement('afterend', autoButton);

      autoButton.addEventListener('click', autoSelectAndRun);
    }

    if (!autoPanel) {
      autoPanel = document.createElement('section');
      autoPanel.id = 'autoSelectionReport';
      autoPanel.className = 'panel';
      autoPanel.style.cssText =
        'margin-top:16px;padding:16px;border-radius:12px;background:var(--panel,#fff);';
      autoPanel.hidden = true;

      const anchor = autoButton?.parentElement;
      if (anchor) {
        anchor.insertAdjacentElement('afterend', autoPanel);
      } else {
        document.body.appendChild(autoPanel);
      }
    }
  }

  // --------------------------------------------------
  // PROCESS TABLE
  // --------------------------------------------------

  function renderProcesses() {
    const body = $('processRows');

    if (!processes.length) {
      body.innerHTML = `
        <tr>
          <td colspan="5" class="table-empty">
            No processes yet. Add one above.
          </td>
        </tr>`;
    } else {
      const sorted = [...processes].sort(
        (a, b) => a.arrival - b.arrival || a.id.localeCompare(b.id)
      );

      body.innerHTML = sorted.map(p => `
        <tr>
          <td>
            <span class="process-tag">
              <i class="dot" style="background:${colorFor(p.id)}"></i>
              ${escapeHtml(p.id)}
            </span>
          </td>
          <td>${p.arrival}</td>
          <td>${p.burst}</td>
          <td>${p.priority}</td>
          <td>
            <button class="delete-btn"
              data-delete="${escapeHtml(p.id)}"
              title="Remove ${escapeHtml(p.id)}"
              aria-label="Remove ${escapeHtml(p.id)}"
              type="button">×</button>
          </td>
        </tr>
      `).join('');
    }

    $('processCount').textContent =
      `${processes.length} process${processes.length === 1 ? '' : 'es'}`;
  }

  // --------------------------------------------------
  // SCHEDULING ENGINE
  //
  // Integer AT and BT are required.
  // Priority number: lower number means higher priority.
  // --------------------------------------------------

  function normalizeSegments(segments) {
    const normalized = [];

    for (const segment of segments) {
      if (segment.end <= segment.start) continue;

      const last = normalized[normalized.length - 1];

      if (last && last.id === segment.id &&
          last.end === segment.start) {
        last.end = segment.end;
      } else {
        normalized.push({ ...segment });
      }
    }

    return normalized;
  }

  function simulate(algorithm, mode, quantum, input = cloneProcesses()) {
    if (!input.length) {
      return {
        algorithm, mode, segments: [], metrics: [],
        events: [], time: 0, busyTime: 0, utilization: 0
      };
    }

    const seen = new Set();

    for (const p of input) {
      if (!p.id || seen.has(p.id)) {
        throw new Error('Process IDs must be non-empty and unique.');
      }
      seen.add(p.id);

      if (!Number.isInteger(p.arrival) || p.arrival < 0 ||
          !Number.isInteger(p.burst) || p.burst < 1 ||
          !Number.isInteger(p.priority) || p.priority < 0) {
        throw new Error(
          `Invalid process values for ${p.id}. Check AT, BT and priority.`
        );
      }
    }

    const ps = input.map((p, index) => ({
      ...p,
      index,
      remaining: p.burst,
      firstStart: null,
      completion: null,
      intervals: []
    }));

    const segments = [];
    const events = [];
    const ready = [];

    let time = 0;
    let finished = 0;
    let running = null;
    let quantumUsed = 0;

    const preemptive = mode === 'preemptive';
    const effectiveAlgorithm =
      algorithm === 'SJF' && preemptive ? 'SRTF' :
      algorithm === 'SRTF' && !preemptive ? 'SJF' :
      algorithm === 'PRIORITY' && preemptive ? 'PPRIORITY' :
      algorithm === 'PPRIORITY' && !preemptive ? 'PRIORITY' :
      algorithm;

    function record(type, process, at, reason) {
      events.push({
        type,
        id: process?.id || null,
        time: at,
        reason
      });
    }

    function append(id, start, end) {
      if (end > start) segments.push({ id, start, end });
    }

    function addArrivals(at) {
      const arrived = ps
        .filter(p => p.arrival === at && p.remaining > 0 &&
          p.completion === null && p !== running &&
          !ready.includes(p))
        .sort((a, b) => a.arrival - b.arrival || a.index - b.index);

      for (const p of arrived) {
        ready.push(p);
        record('arrival', p, at, `${p.id} arrived and entered the ready queue.`);
      }
    }

    function compareProcesses(a, b) {
      if (effectiveAlgorithm === 'SJF' ||
          effectiveAlgorithm === 'SRTF') {
        return a.remaining - b.remaining ||
          a.arrival - b.arrival || a.index - b.index;
      }

      if (effectiveAlgorithm === 'PRIORITY' ||
          effectiveAlgorithm === 'PPRIORITY') {
        return a.priority - b.priority ||
          a.arrival - b.arrival || a.index - b.index;
      }

      return a.arrival - b.arrival || a.index - b.index;
    }

    function chooseNext() {
      if (!ready.length) return null;

      if (effectiveAlgorithm === 'RR') {
        return ready.shift();
      }

      ready.sort(compareProcesses);
      return ready.shift();
    }

    function startRunning(p, at, reason) {
      running = p;
      quantumUsed = 0;

      if (p.firstStart === null) {
        p.firstStart = at;
        record('first-start', p, at,
          `${p.id} received the CPU for the first time.`);
      } else {
        record('dispatch', p, at, reason || `${p.id} was dispatched.`);
      }
    }

    // Event-driven at integer boundaries; one tick is one CPU time unit.
    while (finished < ps.length) {
      addArrivals(time);

      if (running && preemptive && effectiveAlgorithm !== 'RR' &&
          ready.length) {
        ready.sort(compareProcesses);
        const candidate = ready[0];

        const strictlyBetter =
          effectiveAlgorithm === 'SRTF'
            ? candidate.remaining < running.remaining
            : effectiveAlgorithm === 'PPRIORITY'
              ? candidate.priority < running.priority
              : false;

        if (strictlyBetter) {
          const old = running;
          record('preemption', old, time,
            `${old.id} was interrupted because ${candidate.id} has ` +
            (effectiveAlgorithm === 'SRTF'
              ? `less remaining CPU time (${candidate.remaining} vs ${old.remaining}).`
              : `higher priority (${candidate.priority} vs ${old.priority}).`));

          ready.push(old);
          running = null;
          startRunning(chooseNext(), time,
            'The scheduler selected the best-ranked ready process.');
        }
      }

      if (!running) {
        if (!ready.length) {
          const nextArrival = ps
            .filter(p => p.remaining > 0 && p.completion === null &&
              p.arrival > time)
            .reduce((min, p) => Math.min(min, p.arrival), Infinity);

          if (!Number.isFinite(nextArrival)) break;

          append('IDLE', time, nextArrival);
          record('idle', null, time,
            `No process was ready; the CPU remained idle until time ${nextArrival}.`);
          time = nextArrival;
          addArrivals(time);
        }

        if (!running) {
          const next = chooseNext();
          if (!next) continue;

          let reason = 'Selected from the ready queue.';

          if (effectiveAlgorithm === 'FCFS') {
            reason = 'FCFS selected the earliest-arriving ready process.';
          } else if (effectiveAlgorithm === 'SJF') {
            reason = 'SJF selected the ready process with the shortest burst.';
          } else if (effectiveAlgorithm === 'SRTF') {
            reason = 'SRTF selected the ready process with the shortest remaining time.';
          } else if (effectiveAlgorithm === 'PRIORITY') {
            reason = 'Priority scheduling selected the lowest priority number.';
          } else if (effectiveAlgorithm === 'PPRIORITY') {
            reason = 'Preemptive Priority selected the highest-priority ready process.';
          } else if (effectiveAlgorithm === 'RR') {
            reason = `Round Robin selected the head of the ready queue (quantum ${quantum}).`;
          }

          startRunning(next, time, reason);
          record('decision', next, time, reason);
        }
      }

      const current = running;
      const start = time;

      current.intervals.push({ start, end: start + 1 });
      current.remaining -= 1;
      time += 1;
      quantumUsed += 1;
      append(current.id, start, time);

      // Completion takes precedence over quantum expiration.
      if (current.remaining === 0) {
        current.completion = time;
        finished++;

        record('completion', current, time,
          `${current.id} completed its burst; remaining time is zero.`);

        running = null;
        quantumUsed = 0;
      }

      // Queue new arrivals before re-queueing a process whose quantum expired.
      addArrivals(time);

      if (running && effectiveAlgorithm === 'RR' && preemptive &&
          quantumUsed >= quantum) {
        const expired = running;

        record('quantum-expired', expired, time,
          `${expired.id}'s time quantum of ${quantum} expired; ` +
          `it returned to the end of the ready queue.`);

        ready.push(expired);
        running = null;
        quantumUsed = 0;
      }
    }

    const metrics = ps.map(p => {
      if (p.completion === null || p.firstStart === null) {
        throw new Error(`Simulation did not complete ${p.id}.`);
      }

      const turnaround = p.completion - p.arrival;
      const waiting = turnaround - p.burst;
      const response = p.firstStart - p.arrival;

      if (waiting < -EPSILON || response < -EPSILON) {
        throw new Error(`Metric validation failed for ${p.id}.`);
      }

      return {
        id: p.id,
        arrival: p.arrival,
        burst: p.burst,
        priority: p.priority,
        firstStart: p.firstStart,
        completion: p.completion,
        turnaround,
        waiting: Math.max(0, waiting),
        response: Math.max(0, response),
        intervals: p.intervals.map(i => ({ ...i }))
      };
    });

    const normalized = normalizeSegments(segments);
    const busyTime = normalized.reduce(
      (sum, s) => sum + (s.id === 'IDLE' ? 0 : s.end - s.start),
      0
    );

    const utilization = time > 0 ? busyTime / time * 100 : 0;

    // Sanity checks: total CPU service equals total burst, and metrics agree.
    const totalBurst = ps.reduce((sum, p) => sum + p.burst, 0);

    if (Math.abs(busyTime - totalBurst) > EPSILON) {
      throw new Error('Validation failed: executed CPU time differs from total burst.');
    }

    for (const p of metrics) {
      if (Math.abs(p.turnaround - (p.completion - p.arrival)) > EPSILON ||
          Math.abs(p.waiting - (p.turnaround - p.burst)) > EPSILON ||
          Math.abs(p.response - (p.firstStart - p.arrival)) > EPSILON) {
        throw new Error(`Metric formula validation failed for ${p.id}.`);
      }
    }

    return {
      algorithm,
      mode,
      effectiveAlgorithm,
      segments: normalized,
      metrics,
      events,
      time,
      busyTime,
      utilization
    };
  }

  // --------------------------------------------------
  // GANTT CHART WITH EVERY INTEGER TIME LABEL
  // --------------------------------------------------

  function renderGantt() {
    const root = $('ganttChart');

    if (!timeline.length) {
      root.innerHTML = `
        <div class="empty-state">
          Run the simulation to build the Gantt chart.
        </div>`;
      return;
    }

    const visible = timeline.slice(0, stepIndex);

    if (!visible.length) {
      root.innerHTML = `
        <div class="empty-state">
          Press Step or Run simulation to begin.
        </div>`;
      return;
    }

    const endTime = visible[visible.length - 1].end;
    const chartWidth = Math.max(TIME_UNIT_WIDTH, endTime * TIME_UNIT_WIDTH);

    const track = document.createElement('div');
    track.className = 'gantt-track';

    // Override flex sizing so every time unit has exactly the same width.
    track.style.cssText = `
      display:block;
      position:relative;
      width:${chartWidth}px;
      min-width:${chartWidth}px;
      height:94px;
      padding:0;
      margin:0;
    `;

    for (const segment of visible) {
      const block = document.createElement('div');
      block.className =
        'gantt-block' + (segment.id === 'IDLE' ? ' idle' : '');

      block.style.cssText = `
        position:absolute;
        left:${segment.start * TIME_UNIT_WIDTH}px;
        top:3px;
        width:${(segment.end - segment.start) * TIME_UNIT_WIDTH}px;
        height:52px;
        min-width:0;
        box-sizing:border-box;
        overflow:visible;
        background:${segment.id === 'IDLE' ? '#eef1f6' : colorFor(segment.id)};
      `;

      block.textContent = segment.id;
      block.title = `${segment.id}: ${segment.start}–${segment.end}`;

      track.appendChild(block);
    }

    // Render all integer ticks from zero to the current visible time.
    for (let t = 0; t <= endTime; t++) {
      const tick = document.createElement('span');
      tick.className = 'gantt-time';
      tick.textContent = String(t);
      tick.style.cssText = `
        position:absolute;
        left:${t * TIME_UNIT_WIDTH}px;
        top:61px;
        bottom:auto;
        transform:translateX(-50%);
        white-space:nowrap;
      `;
      track.appendChild(tick);
    }

    root.replaceChildren(track);
  }

  // --------------------------------------------------
  // METRICS
  // --------------------------------------------------

  
function renderMetrics(result, completedOnly = false) {
  const rows = result.metrics || [];

  // Current visible simulation time.
  const currentTime = Number($('currentTime').textContent) || 0;

  // When playing step-by-step, only include completed processes.
  // For the final results, use every process.
  const completed = rows.filter(p =>
    p.completion !== null &&
    (!completedOnly || p.completion <= currentTime)
  );

  if (!rows.length) {
    $('metricsRows').innerHTML = `
      <tr>
        <td colspan="8" class="table-empty">
          Run a simulation to see process metrics.
        </td>
      </tr>`;
  } else {
    $('metricsRows').innerHTML = rows.map(p => {
      const started = !completedOnly ||
        (p.firstStart !== null && p.firstStart <= currentTime);

      const done = !completedOnly ||
        (p.completion !== null && p.completion <= currentTime);

      return `
        <tr>
          <td>
            <span class="process-tag">
              <i class="dot" style="background:${colorFor(p.id)}"></i>
              ${escapeHtml(p.id)}
            </span>
          </td>
          <td>${fmt(p.arrival)}</td>
          <td>${fmt(p.burst)}</td>
          <td>${started ? fmt(p.firstStart) : '—'}</td>
          <td>${done ? fmt(p.completion) : '—'}</td>
          <td>${done ? fmt(p.turnaround) : '—'}</td>
          <td>${done ? fmt(p.waiting) : '—'}</td>
          <td>${started ? fmt(p.response) : '—'}</td>
        </tr>`;
    }).join('');
  }

  // Calculate averages from completed processes during step-by-step playback.
  $('avgWaiting').textContent = completed.length
    ? fmt(average(completed, 'waiting'))
    : '—';

  $('avgTurnaround').textContent = completed.length
    ? fmt(average(completed, 'turnaround'))
    : '—';

  $('avgResponse').textContent = completed.length
    ? fmt(average(completed, 'response'))
    : '—';

  // Use the visible time during playback and the final completion time
  // when displaying the complete simulation results.
  const metricsTime = completedOnly
    ? currentTime
    : (Number(result.time) || 0);

  // Count CPU busy time from the segments currently displayed.
  const visibleSegments = completedOnly
    ? timeline.slice(0, stepIndex)
    : timeline;

  const busyTime = visibleSegments.reduce((sum, segment) => {
    return sum + (
      segment.id === 'IDLE'
        ? 0
        : Math.max(0, segment.end - segment.start)
    );
  }, 0);

  // CPU utilization = busy time / elapsed simulation time × 100.
  $('cpuUtil').textContent = metricsTime > 0
    ? `${fmt(Math.min(100, busyTime / metricsTime * 100))}%`
    : '—';
}


  // --------------------------------------------------
  // PROCESS-BY-PROCESS EXECUTION EXPLANATION
  // --------------------------------------------------

  function renderExecutionSummary(result) {
    ensureExtraUI();

    const target = $('executionSummaryContent');
    if (!target || !result?.metrics?.length) return;

    const visibleTime = Number($('currentTime').textContent) || 0;
    const finalView = stepIndex >= timeline.length;

    const visibleMetrics = result.metrics.filter(p =>
      finalView || p.completion <= visibleTime
    );

    if (!visibleMetrics.length) {
      target.innerHTML =
        '<p>Process summaries will appear as processes complete.</p>';
      return;
    }

    const html = visibleMetrics.map(p => {
      const waitIntervals = [];
      let cursor = p.arrival;

      for (const interval of p.intervals) {
        if (interval.start > cursor) {
          waitIntervals.push({
            start: cursor,
            end: interval.start
          });
        }
        cursor = interval.end;
      }

      const waitDescription = waitIntervals.length
        ? waitIntervals.map(w => `${w.start}–${w.end}`).join(', ')
        : 'None';

      const executionDescription = p.intervals
        .map(i => `${i.start}–${i.end}`)
        .join(', ');

      const preemptions = result.events.filter(e =>
        e.type === 'preemption' && e.id === p.id &&
        e.time <= visibleTime
      );

      const rrExpirations = result.events.filter(e =>
        e.type === 'quantum-expired' && e.id === p.id &&
        e.time <= visibleTime
      );

      const reasons = [];

      if (result.effectiveAlgorithm === 'FCFS') {
        reasons.push(
          'FCFS: process selection follows arrival order; a running process is not interrupted.'
        );
      } else if (result.effectiveAlgorithm === 'SJF') {
        reasons.push(
          `SJF: ${p.id} was considered using its burst length of ${p.burst} time units when selecting a job.`
        );
      } else if (result.effectiveAlgorithm === 'SRTF') {
        reasons.push(
          'SRTF: the scheduler compares remaining CPU times at arrival boundaries and switches only when a ready process has strictly less remaining time.'
        );
      } else if (result.effectiveAlgorithm === 'PRIORITY') {
        reasons.push(
          `Priority: ${p.id} has priority ${p.priority}; a lower numeric value represents higher priority.`
        );
      } else if (result.effectiveAlgorithm === 'PPRIORITY') {
        reasons.push(
          'Preemptive Priority: the scheduler interrupts a running process only when a ready process has a strictly lower priority number.'
        );
      } else if (result.effectiveAlgorithm === 'RR') {
        reasons.push(
          `Round Robin: processes take turns in the ready queue, with a quantum of ${selectedQuantum()} time units.`
        );
      }

      if (preemptions.length) {
        reasons.push(
          `Preempted ${preemptions.length} time(s): ` +
          preemptions.map(e => e.reason).join(' ')
        );
      } else {
        reasons.push('No priority/SRTF preemption was recorded for this process.');
      }

      if (rrExpirations.length) {
        reasons.push(
          `Its quantum expired ${rrExpirations.length} time(s), so it returned to the end of the ready queue.`
        );
      }

      reasons.push(
        `Turnaround check: CT ${p.completion} − AT ${p.arrival} = ${p.turnaround}.`
      );
      reasons.push(
        `Waiting check: TAT ${p.turnaround} − BT ${p.burst} = ${p.waiting}.`
      );
      reasons.push(
        `Response check: first start ${p.firstStart} − AT ${p.arrival} = ${p.response}.`
      );

      return `
        <article style="padding:14px 0;border-bottom:1px solid var(--line,#e4e9f1)">
          <h3>${escapeHtml(p.id)}: AT ${p.arrival} → CT ${p.completion}</h3>
          <p><strong>Execution intervals:</strong> ${executionDescription}</p>
          <p><strong>Ready/waiting intervals:</strong> ${waitDescription}</p>
          <p>
            <strong>ST:</strong> ${p.firstStart} ·
            <strong>CT:</strong> ${p.completion} ·
            <strong>TAT:</strong> ${p.turnaround} ·
            <strong>WT:</strong> ${p.waiting} ·
            <strong>RT:</strong> ${p.response}
          </p>
          <ul>${reasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
        </article>`;
    }).join('');

    target.innerHTML = `
      <p><strong>Policy:</strong> ${escapeHtml(result.algorithm)} /
        ${escapeHtml(result.mode)}.
        <strong>CPU busy time:</strong> ${fmt(result.busyTime)}.
        <strong>CPU utilization:</strong> ${fmt(result.utilization)}%.
      </p>
      ${html}
    `;
  }

  // --------------------------------------------------
  // STEP-BY-STEP CONTROLS
  // --------------------------------------------------

  function stopTimer() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    isRunning = false;

    if ($('playBtn')) {
      $('playBtn').textContent = 'Resume';
      $('playBtn').disabled = stepIndex >= timeline.length;
    }
  }

  function renderStep() {
    renderGantt();

    const currentTime = stepIndex
      ? timeline[stepIndex - 1].end
      : 0;

    $('currentTime').textContent = String(currentTime);
    $('completionLabel').textContent =
      `${stepIndex} / ${timeline.length} segments`;

    if (stepIndex > 0) {
      const segment = timeline[stepIndex - 1];

      $('stepDescription').textContent =
        segment.id === 'IDLE'
          ? `CPU idle from ${segment.start} to ${segment.end}.`
          : `${segment.id} ran from ${segment.start} to ${segment.end} ` +
            `(${segment.end - segment.start} time units).`;
    } else {
      $('stepDescription').textContent = 'Ready to simulate.';
    }

    if (activeResult) {
      renderMetrics(activeResult, true);
      renderExecutionSummary(activeResult);
    }

    if (stepIndex >= timeline.length && timeline.length > 0) {
      stopTimer();
      setStatus('Terminated', 'Completed');
      $('playBtn').disabled = true;
      $('playBtn').textContent = 'Completed';
    }
  }

  function getInterval() {
    const speed = $('speedSelect').value;
    if (speed === 'slow') return 1100;
    if (speed === 'fast') return 180;
    return 600;
  }

  function advance() {
    if (stepIndex >= timeline.length) {
      stopTimer();
      setStatus('Terminated', 'Completed');
      return;
    }

    stepIndex++;
    renderStep();

    if (stepIndex >= timeline.length) {
      stopTimer();
      setStatus('Terminated', 'Completed');
    }
  }

  function runFullSimulation(algorithm, mode, quantum, auto = false) {
    stopTimer();

    if (!processes.length) {
      alert('Add at least one process first.');
      return false;
    }

    try {
      activeResult = simulate(algorithm, mode, quantum);
    } catch (error) {
      alert(`Simulation error: ${error.message}`);
      console.error(error);
      return false;
    }

    activePolicy = { algorithm, mode, quantum };
    timeline = activeResult.segments;
    stepIndex = 0;

    $('playBtn').disabled = false;
    $('playBtn').textContent = 'Pause';
    setStatus(auto ? 'Auto-selected' : 'Ready');

    renderStep();

    if (!timeline.length) {
      setStatus('No work');
      $('playBtn').disabled = true;
      return true;
    }

    if ($('speedSelect').value === 'fast') {
      setStatus('Running', 'running');
      while (stepIndex < timeline.length) advance();
      return true;
    }

    advance();

    if (stepIndex < timeline.length) {
      timer = setInterval(advance, getInterval());
      isRunning = true;
      $('playBtn').textContent = 'Pause';
      setStatus('Running', 'running');
    }

    return true;
  }

  function startSimulation() {
    runFullSimulation(
      selectedAlgorithm(),
      selectedMode(),
      selectedQuantum()
    );
  }

  function togglePause() {
    if (!timeline.length || stepIndex >= timeline.length) return;

    if (isRunning) {
      stopTimer();
      setStatus('Stopped', 'Suspended');
      $('playBtn').disabled = false;
      return;
    }

    timer = setInterval(advance, getInterval());
    isRunning = true;
    $('playBtn').textContent = 'Pause';
    $('playBtn').disabled = false;
    setStatus('Running', 'running');
  }

  function reset() {
    stopTimer();

    timeline = [];
    stepIndex = 0;
    activeResult = null;
    activePolicy = null;

    setStatus('Ready');

    $('playBtn').disabled = true;
    $('playBtn').textContent = 'Pause';
    $('currentTime').textContent = '0';
    $('completionLabel').textContent = '0 / 0 segments';
    $('stepDescription').textContent = 'Ready to simulate.';

    $('ganttChart').innerHTML = `
      <div class="empty-state">
        Run the simulation to build the Gantt chart.
      </div>`;

    $('metricsRows').innerHTML = `
      <tr><td colspan="8" class="table-empty">
        Run a simulation to see process metrics.
      </td></tr>`;

    ['avgWaiting', 'avgTurnaround', 'avgResponse', 'cpuUtil']
      .forEach(id => $(id).textContent = '—');

    const summary = $('executionSummaryContent');
    if (summary) {
      summary.innerHTML = 'Run a simulation to generate the execution report.';
    }
  }

  // --------------------------------------------------
  // ALGORITHM COMPARISON
  // --------------------------------------------------

  function candidatePolicies() {
    return [
      { key: 'FCFS', label: 'FCFS', mode: 'nonpreemptive' },
      { key: 'SJF', label: 'SJF', mode: 'nonpreemptive' },
      { key: 'SRTF', label: 'SRTF', mode: 'preemptive' },
      { key: 'PRIORITY', label: 'Priority', mode: 'nonpreemptive' },
      { key: 'PPRIORITY', label: 'Preemptive Priority', mode: 'preemptive' },
      { key: 'RR', label: 'Round Robin', mode: 'preemptive' }
    ];
  }

  function evaluatePolicies() {
    return candidatePolicies().map(policy => {
      const result = simulate(
        policy.key, policy.mode, selectedQuantum(), cloneProcesses()
      );

      return {
        ...policy,
        result,
        waiting: average(result.metrics, 'waiting'),
        turnaround: average(result.metrics, 'turnaround'),
        response: average(result.metrics, 'response'),
        utilization: result.utilization
      };
    });
  }

  function compare() {
    if (!processes.length) {
      alert('Add at least one process first.');
      return;
    }

    let results;
    try {
      results = evaluatePolicies();
    } catch (error) {
      alert(`Comparison failed: ${error.message}`);
      return;
    }

    const bestWaiting = Math.min(...results.map(r => r.waiting));

    $('comparisonRows').innerHTML = results.map(r => {
      const isBest = Math.abs(r.waiting - bestWaiting) < EPSILON;
      return `
        <tr class="${isBest ? 'best-row' : ''}">
          <td>${escapeHtml(r.label)}${isBest ? ' ★' : ''}</td>
          <td>${fmt(r.waiting)}</td>
          <td>${fmt(r.turnaround)}</td>
          <td>${fmt(r.response)}</td>
          <td>${fmt(r.utilization)}%</td>
        </tr>`;
    }).join('');

    $('comparisonPanel').classList.remove('hidden');
    $('comparisonPanel').scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    });
  }

  // --------------------------------------------------
  // AUTO SELECT
  //
  // Balanced objective: minimize average WT, TAT and RT.
  // Utilization is reported, not falsely treated as freely
  // improvable when context-switch overhead is not modeled.
  // --------------------------------------------------

  function autoSelectAndRun() {
    if (!processes.length) {
      alert('Add at least one process first.');
      return;
    }

    let results;
    try {
      results = evaluatePolicies();
    } catch (error) {
      alert(`Automatic selection failed: ${error.message}`);
      return;
    }

    // Normalize each metric so unlike units/scales do not dominate.
    const maxWaiting = Math.max(...results.map(r => r.waiting), 1);
    const maxTurnaround = Math.max(...results.map(r => r.turnaround), 1);
    const maxResponse = Math.max(...results.map(r => r.response), 1);

    for (const r of results) {
      r.score =
        (r.waiting / maxWaiting) +
        (r.turnaround / maxTurnaround) +
        (r.response / maxResponse);
    }

    results.sort((a, b) =>
      a.score - b.score ||
      a.waiting - b.waiting ||
      a.turnaround - b.turnaround ||
      a.response - b.response ||
      b.utilization - a.utilization ||
      a.label.localeCompare(b.label)
    );

    const winner = results[0];
    ensureExtraUI();

    autoPanel.hidden = false;
    autoPanel.innerHTML = `
      <h2>Automatic Scheduling Recommendation</h2>
      <p><strong>Selected:</strong> ${escapeHtml(winner.label)}
        (${escapeHtml(winner.mode)})</p>
      <p>
        This policy has the lowest balanced score from the tested
        candidates using normalized average waiting, turnaround and
        response times.
      </p>
      <p>
        <strong>Average waiting:</strong> ${fmt(winner.waiting)} ·
        <strong>Average turnaround:</strong> ${fmt(winner.turnaround)} ·
        <strong>Average response:</strong> ${fmt(winner.response)} ·
        <strong>CPU utilization:</strong> ${fmt(winner.utilization)}%
      </p>
      <p>
        CPU utilization is reported separately: with no context-switch
        overhead modeled, total CPU busy time is determined by the total
        burst time. A different scheduling policy cannot generally reduce
        idle time when no process has arrived.
      </p>
      <h3>All tested policies</h3>
      <table>
        <thead><tr>
          <th>Policy</th><th>Avg WT</th><th>Avg TAT</th>
          <th>Avg RT</th><th>CPU</th><th>Score</th>
        </tr></thead>
        <tbody>
          ${results.map((r, i) => `
            <tr${i === 0 ? ' class="best-row"' : ''}>
              <td>${escapeHtml(r.label)}</td>
              <td>${fmt(r.waiting)}</td>
              <td>${fmt(r.turnaround)}</td>
              <td>${fmt(r.response)}</td>
              <td>${fmt(r.utilization)}%</td>
              <td>${fmt(r.score)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    // Reflect the chosen policy in existing controls when options exist.
    if ([...$('algorithmSelect').options].some(o => o.value === winner.key)) {
      $('algorithmSelect').value = winner.key;
    }
    if ([...$('modeSelect').options].some(o => o.value === winner.mode)) {
      $('modeSelect').value = winner.mode;
    }

    updateControls();
    runFullSimulation(
      winner.key, winner.mode, selectedQuantum(), true
    );

    autoPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // --------------------------------------------------
  // CONTROL HINTS
  // --------------------------------------------------

  function updateControls() {
    const algorithm = selectedAlgorithm();
    const mode = selectedMode();
    const rr = algorithm === 'RR';

    $('quantumInput').disabled = !rr;

    const q = Number($('quantumInput').value);
    if (!Number.isInteger(q) || q < 1) {
      $('quantumInput').value = '2';
    }

    const hints = {
      FCFS: 'FCFS selects the earliest-arriving ready process and runs it to completion.',
      SJF: mode === 'preemptive'
        ? 'Preemptive SJF uses shortest remaining time first.'
        : 'Non-preemptive SJF selects the shortest available CPU burst.',
      SRTF: mode === 'preemptive'
        ? 'SRTF can interrupt a running process when another has less remaining time.'
        : 'In non-preemptive mode, SRTF behaves like SJF.',
      PRIORITY: mode === 'preemptive'
        ? 'Preemptive Priority can interrupt a process when a higher-priority process arrives.'
        : 'Non-preemptive Priority selects the ready process with the lowest priority number.',
      PPRIORITY: mode === 'preemptive'
        ? 'Preemptive Priority can interrupt a process when a higher-priority process arrives.'
        : 'In non-preemptive mode, Preemptive Priority behaves like Priority.',
      RR: mode === 'preemptive'
        ? 'Round Robin assigns each process a time quantum before returning it to the queue.'
        : 'In non-preemptive mode, the selected process runs to completion; the quantum is ignored.'
    };

    $('modeHint').textContent = hints[algorithm] || '';
  }

  // --------------------------------------------------
  // EVENT LISTENERS
  // --------------------------------------------------

  $('processForm').addEventListener('submit', event => {
    event.preventDefault();

    const id = $('pidInput').value.trim();
    const arrival = Number($('arrivalInput').value);
    const burst = Number($('burstInput').value);
    const priority = Number($('priorityInput').value);

    if (!id) {
      alert('Enter a process ID.');
      return;
    }

    if (processes.some(p => p.id.toLowerCase() === id.toLowerCase())) {
      alert('Process IDs must be unique.');
      return;
    }

    if (!Number.isInteger(arrival) || arrival < 0 ||
        !Number.isInteger(burst) || burst < 1 ||
        !Number.isInteger(priority) || priority < 0) {
      alert(
        'Arrival and priority must be whole numbers (0 or higher), ' +
        'and burst must be a positive whole number.'
      );
      return;
    }

    processes.push({ id, arrival, burst, priority });
    colorFor(id);
    renderProcesses();
    reset();

    $('pidInput').value = `P${processes.length + 1}`;
  });

  $('processRows').addEventListener('click', event => {
    const button = event.target.closest('[data-delete]');
    if (!button) return;

    processes = processes.filter(p => p.id !== button.dataset.delete);
    renderProcesses();
    reset();
  });

  $('clearBtn').addEventListener('click', () => {
    processes = [];
    renderProcesses();
    reset();
  });

  $('sampleBtn').addEventListener('click', () => {
    processes = [
      { id: 'P1', arrival: 0, burst: 5, priority: 2 },
      { id: 'P2', arrival: 1, burst: 3, priority: 1 },
      { id: 'P3', arrival: 2, burst: 8, priority: 3 },
      { id: 'P4', arrival: 3, burst: 4, priority: 2 }
    ];

    colorById = {};
    processes.forEach(p => colorFor(p.id));
    renderProcesses();
    reset();
  });

  $('algorithmSelect').addEventListener('change', () => {
    updateControls();
    reset();
  });

  $('modeSelect').addEventListener('change', () => {
    updateControls();
    reset();
  });

  $('quantumInput').addEventListener('change', () => {
    const quantum = Number($('quantumInput').value);
    if (!Number.isInteger(quantum) || quantum < 1) {
      $('quantumInput').value = '2';
    }
    reset();
  });

  $('speedSelect').addEventListener('change', () => {
    if (isRunning) {
      stopTimer();
      togglePause();
    }
  });

  $('runBtn').addEventListener('click', startSimulation);

  $('stepBtn').addEventListener('click', () => {
    if (!timeline.length || !activeResult) {
      if (!processes.length) {
        alert('Add at least one process first.');
        return;
      }

      stopTimer();

      try {
        activeResult = simulate(
          selectedAlgorithm(), selectedMode(),
          selectedQuantum(), cloneProcesses()
        );
      } catch (error) {
        alert(`Simulation error: ${error.message}`);
        return;
      }

      activePolicy = {
        algorithm: selectedAlgorithm(),
        mode: selectedMode(),
        quantum: selectedQuantum()
      };

      timeline = activeResult.segments;
      stepIndex = 0;
      setStatus('Running');
      $('playBtn').disabled = false;
      $('playBtn').textContent = 'Resume';
      renderStep();
    } else {
      stopTimer();
    }

    if (stepIndex < timeline.length) advance();
  });

  $('playBtn').addEventListener('click', togglePause);
  $('resetBtn').addEventListener('click', reset);
  $('compareBtn').addEventListener('click', compare);

  $('closeCompareBtn').addEventListener('click', () => {
    $('comparisonPanel').classList.add('hidden');
  });

  // --------------------------------------------------
  // INITIALIZE
  // --------------------------------------------------

  processes.forEach(p => colorFor(p.id));
  ensureExtraUI();
  renderProcesses();
  updateControls();
  reset();
})();
