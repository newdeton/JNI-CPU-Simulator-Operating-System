# CPU Scheduling Simulator

A standalone HTML/CSS/JavaScript CPU scheduling lab. No framework, package manager, or backend is required.

## Run it

1. Extract the ZIP (or keep the project folder as-is).
2. Open `index.html` in a modern browser such as Chrome, Edge, or Firefox.
3. Add processes or click **Load sample**.
4. Select an algorithm, execution mode, and time quantum (for Round Robin), then click **Run simulation** or **Step**.

Optional local server (not required): from this directory run `python -m http.server 8000`, then visit `http://localhost:8000`.

## Features

- Process ID, arrival time, burst time, and priority inputs
- Round Robin, FCFS, SJF, SRTF, Priority, and Preemptive Priority
- Preemptive/non-preemptive mode selection
- Gantt timeline with CPU idle periods
- Run, step, pause/resume, and reset controls
- Completion, turnaround, waiting, and response times
- Average waiting, turnaround, and response times; CPU utilization
- Side-by-side algorithm comparison
- Responsive layout for desktop and mobile

## Definitions

- **Turnaround time** = completion time − arrival time
- **Waiting time** = turnaround time − CPU burst time
- **Response time** = first CPU start time − arrival time
- **CPU utilization** = total burst time ÷ elapsed time from time zero to final completion
- **Priority:** lower number means higher priority.

Round Robin is conventionally preemptive. The non-preemptive Round Robin option is included as an educational contrast: each selected process runs to completion and the quantum is ignored. FCFS, SJF, and non-preemptive Priority naturally run selected jobs to completion. SRTF and Preemptive Priority are designed to interrupt work when a newly arriving process changes the scheduling choice.

## Notes

- Times and bursts are integer time units; arrival times and priorities can be zero, burst times must be at least one.
- Comparison uses a preemptive run for RR, SRTF, and Preemptive Priority, and non-preemptive runs for the other algorithms. The selected Round Robin quantum is reused.
