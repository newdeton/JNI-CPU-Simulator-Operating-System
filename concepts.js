
(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const modules = {
    interrupts: {
      number: "01",
      kicker: "MODULE 01 · CPU EVENTS",
      title: "Interrupts",
      intro: "An interrupt asks the CPU to respond to an event while preserving enough information to continue interrupted work.",
      stages: [
        {
          title: "Process A is executing",
          explanation: "The CPU executes instructions for Process A. Its program counter and registers represent its current execution context.",
          active: "cpu",
          log: "Process A is running on the CPU."
        },
        {
          title: "A device raises an interrupt",
          explanation: "A timer, keyboard, disk, or network device signals that it needs attention.",
          active: "device",
          log: "An I/O device raises an interrupt request."
        },
        {
          title: "The CPU recognizes the interrupt",
          explanation: "The CPU accepts an eligible interrupt and transfers control to the operating system's interrupt-handling path.",
          active: "cpu",
          log: "The CPU accepts the interrupt."
        },
        {
          title: "Execution context is saved",
          explanation: "The machine and OS preserve the information needed to resume execution, such as the program counter and relevant registers.",
          active: "save",
          log: "The interrupted execution context is saved."
        },
        {
          title: "The interrupt handler runs",
          explanation: "The interrupt service routine handles the event. Longer work may be deferred so urgent interrupt handling can finish quickly.",
          active: "handler",
          log: "The interrupt handler services the event."
        },
        {
          title: "The saved context is restored",
          explanation: "The return-from-interrupt path restores the interrupted context, or the scheduler may select another ready process.",
          active: "save",
          log: "The CPU restores a resumable execution context."
        },
        {
          title: "Execution resumes",
          explanation: "Process A can continue from the saved point unless the operating system chooses another process to run.",
          active: "cpu",
          log: "Execution resumes after interrupt handling."
        }
      ],
      quiz: {
        question: "Why is execution context saved during interrupt handling?",
        options: [
          "To erase the process from memory",
          "To resume interrupted work correctly",
          "To permanently stop the CPU"
        ],
        answer: 1,
        feedback: "Saved execution state allows the CPU to continue from the correct point."
      }
    },

    states: {
      number: "02",
      kicker: "MODULE 02 · PROCESS LIFECYCLE",
      title: "Process States",
      intro: "A process changes state as it is created, waits for CPU time, executes, waits for events, and finishes.",
      stages: [
        {
          title: "New",
          explanation: "The operating system is creating the process and preparing the resources and metadata it needs.",
          active: "new",
          log: "Process is created: New."
        },
        {
          title: "Ready",
          explanation: "The process is ready to run but is waiting in the ready queue for CPU time.",
          active: "ready",
          log: "Process enters the Ready state."
        },
        {
          title: "Running",
          explanation: "The scheduler selects the process and the dispatcher gives it the CPU.",
          active: "running",
          log: "The process is dispatched to Running."
        },
        {
          title: "Blocked / Waiting",
          explanation: "The process requests I/O or waits for an event. It cannot continue that operation on the CPU until the event completes.",
          active: "blocked",
          log: "The process requests I/O and becomes Blocked."
        },
        {
          title: "Back to Ready",
          explanation: "The I/O event completes. The process becomes Ready, but it must still wait to be selected for CPU time.",
          active: "ready",
          log: "I/O completes; process returns to Ready."
        },
        {
          title: "Running again",
          explanation: "The scheduler dispatches the ready process again. Preemption can also move a running process back to Ready.",
          active: "running",
          log: "The process runs again."
        },
        {
          title: "Terminated",
          explanation: "The process finishes or is terminated, and the operating system reclaims its resources.",
          active: "terminated",
          log: "The process reaches Terminated."
        }
      ],
      quiz: {
        question: "A process is waiting for disk I/O. Which state is it normally in?",
        options: ["Ready", "Running", "Blocked / Waiting"],
        answer: 2,
        feedback: "A blocked process is waiting for an event and cannot continue that operation yet."
      }
    },

    pcb: {
      number: "03",
      kicker: "MODULE 03 · PROCESS METADATA",
      title: "Process Control Block",
      intro: "A PCB is an operating-system data structure used to keep track of a process and the information needed to manage it.",
      stages: [
        {
          title: "The PCB is created",
          explanation: "When a process is created, the OS creates its management record. The exact structure varies by operating system.",
          active: "create",
          log: "The OS allocates a PCB for Process P7."
        },
        {
          title: "Scheduling information is recorded",
          explanation: "The OS records information such as the process ID, state, priority, and scheduling or queue information.",
          active: "schedule",
          log: "PID, process state, and scheduling information are set."
        },
        {
          title: "The process executes",
          explanation: "The process has an execution context that includes a program counter and CPU register values.",
          active: "registers",
          log: "The process execution context is active."
        },
        {
          title: "A context switch occurs",
          explanation: "The OS saves the outgoing process's resumable state and updates its scheduling state.",
          active: "saved",
          log: "CPU context is saved during a context switch."
        },
        {
          title: "The process waits for I/O",
          explanation: "The OS marks the process Blocked and tracks the event it is waiting for.",
          active: "blocked",
          log: "The process state changes to Blocked."
        },
        {
          title: "The process resumes",
          explanation: "When selected to run again, the saved execution context is restored so the process can continue.",
          active: "registers",
          log: "Saved execution context is restored."
        }
      ],
      quiz: {
        question: "Which information is associated with process management?",
        options: [
          "Only the monitor's resolution",
          "Process state and saved CPU context",
          "Every file stored on the computer"
        ],
        answer: 1,
        feedback: "Process management tracks identity, state, scheduling, memory details, and execution context."
      }
    },

    messages: {
      number: "04",
      kicker: "MODULE 04 · INTER-PROCESS COMMUNICATION",
      title: "Message Passing",
      intro: "Processes can exchange information by sending and receiving messages through an inter-process communication mechanism.",
      stages: [
        {
          title: "The sender prepares a message",
          explanation: "Process A builds a message containing data it wants Process B to receive.",
          active: "sender",
          log: "Process A prepares the message: Task complete."
        },
        {
          title: "The send operation begins",
          explanation: "Process A invokes the IPC send operation. The implementation may copy data or use shared kernel buffers.",
          active: "channel",
          log: "Process A sends the message."
        },
        {
          title: "The message enters a queue",
          explanation: "The message is placed in a mailbox or queue associated with the receiver or communication endpoint.",
          active: "queue",
          log: "The message enters the mailbox."
        },
        {
          title: "The receiver waits",
          explanation: "With blocking receive, Process B may wait until a message arrives. Non-blocking receive behaves differently when no message is available.",
          active: "receiver",
          log: "Process B waits for the message."
        },
        {
          title: "The message is delivered",
          explanation: "The receive operation returns the queued message to Process B. A blocked receiver may be awakened.",
          active: "receiver",
          log: "The message is delivered to Process B."
        },
        {
          title: "The receiver processes the message",
          explanation: "Process B interprets the data and continues its work.",
          active: "done",
          log: "Process B handles the received message."
        }
      ],
      quiz: {
        question: "What is a mailbox or message queue used for?",
        options: [
          "Holding messages until they can be received",
          "Increasing the CPU clock speed",
          "Replacing the process scheduler"
        ],
        answer: 0,
        feedback: "A mailbox or queue temporarily holds messages between sender and receiver."
      }
    },

    memory: {
      number: "05",
      kicker: "MODULE 05 · DATA MOVEMENT",
      title: "CPU & Memory",
      intro: "Registers hold immediate values, caches keep useful data close to the CPU, RAM holds working data, and buffers smooth data transfers.",
      stages: [
        {
          title: "An instruction needs data",
          explanation: "The CPU executes an instruction that needs a value. The actual access path depends on the instruction and processor architecture.",
          active: "cpu",
          log: "A CPU instruction requests data."
        },
        {
          title: "Registers are used",
          explanation: "Registers hold values the CPU is actively using, including operands, addresses, and intermediate results.",
          active: "registers",
          log: "The CPU uses its registers for immediate values."
        },
        {
          title: "The cache is checked",
          explanation: "The processor checks whether the required data is in cache. A cache hit can avoid a slower lower-level access.",
          active: "cache",
          log: "The example demonstrates a cache miss."
        },
        {
          title: "Data is fetched from RAM",
          explanation: "On a cache miss, the memory system fetches data from RAM. The relevant cache line may then be populated.",
          active: "ram",
          log: "Requested data is fetched from RAM."
        },
        {
          title: "An I/O buffer holds data",
          explanation: "Buffers temporarily hold data while a producer, consumer, or device operates at a different speed. A buffer is not the same as a CPU cache.",
          active: "buffer",
          log: "An I/O buffer holds data during a transfer."
        },
        {
          title: "The operand is available",
          explanation: "The required value becomes available to the CPU's execution units so the instruction can continue.",
          active: "registers",
          log: "The operand is available for execution."
        }
      ],
      quiz: {
        question: "What is the main purpose of a CPU cache?",
        options: [
          "To permanently store every file",
          "To keep useful data and instructions closer to the CPU",
          "To replace all CPU registers"
        ],
        answer: 1,
        feedback: "Caches reduce average access latency by keeping copies of recently or frequently used data."
      }
    }
  };

  let currentModule = "interrupts";
  let stageIndex = -1;
  let timer = null;
  let quizAnswered = false;

  function data() {
    return modules[currentModule];
  }

  function stopPlayback() {
    if (timer !== null) {
      window.clearTimeout(timer);
    }

    timer = null;
    $("startBtn").disabled = false;
    $("pauseBtn").disabled = true;
  }

  function makeNode(title, subtitle, active = false, tone = "") {
    return `
      <div class="node ${active ? "active" : ""} ${tone}">
        <strong>${title}</strong>
        <small>${subtitle}</small>
      </div>`;
  }

  function renderVisual() {
    const stage = data().stages[stageIndex];

    if (!stage) {
      $("visualStage").innerHTML = `
        <div class="placeholder">
          <div class="placeholder-icon">▶</div>
          <h3>Ready to explore</h3>
          <p>Press Start or Step to begin the simulation.</p>
        </div>`;
      return;
    }

    const active = stage.active;
    let html = "";

    if (currentModule === "interrupts") {
      html = `
        <p class="diagram-title">INTERRUPT HANDLING FLOW</p>
        <div class="diagram-row">
          ${makeNode("Process A", "Running process", active === "cpu")}
          <span class="arrow">→</span>
          ${makeNode("CPU", "Accept interrupt", active === "cpu")}
          <span class="arrow">→</span>
          ${makeNode("Save context", "PC + registers", active === "save", "purple")}
        </div>
        <div class="diagram-row" style="margin-top:15px">
          ${makeNode("I/O device", "Timer / disk / keyboard", active === "device", "blue")}
          <span class="arrow">→</span>
          ${makeNode("Interrupt handler", "Service event", active === "handler", "warn")}
        </div>
        <p class="diagram-caption">
          Device request → CPU/OS handling → restore context → resume execution.
        </p>`;
    }

    if (currentModule === "states") {
      const states = [
        ["New", "Being created", "new"],
        ["Ready", "Waiting for CPU", "ready"],
        ["Running", "Using CPU", "running"],
        ["Blocked / Waiting", "Waiting for event", "blocked"],
        ["Ready again", "Event completed", "ready-again"],
        ["Terminated", "Finished", "terminated"]
      ];

      html = `
        <p class="diagram-title">PROCESS LIFECYCLE</p>
        <div class="state-grid">
          ${states.map(([title, subtitle, key]) =>
            makeNode(title, subtitle, active === key)
          ).join("")}
        </div>
        <p class="diagram-caption">
          New → Ready → Running. An I/O request may cause Running → Blocked → Ready.
          A running process eventually finishes or may be preempted.
        </p>`;
    }

    if (currentModule === "pcb") {
      const fields = [
        ["Process ID", "P7", active === "create"],
        ["State", active === "blocked" ? "BLOCKED" : "READY / RUNNING",
          active === "schedule" || active === "blocked"],
        ["Program counter", stageIndex < 3 ? "0x0040A2" : "0x0040A8",
          active === "registers" || active === "saved"],
        ["Saved registers", "R0=12 · R1=0x100",
          active === "registers" || active === "saved"],
        ["Priority", "5", active === "schedule"],
        ["Memory information", "Address-space reference", active === "schedule"]
      ];

      html = `
        <p class="diagram-title">PROCESS P7 · PCB SNAPSHOT</p>
        <div class="pcb-layout">
          <div class="pcb-card">
            <div class="pcb-head">
              <span>PROCESS CONTROL BLOCK</span>
              <span>PID 7</span>
            </div>
            ${fields.map(([label, value, highlighted]) => `
              <div class="pcb-row" ${highlighted ? 'style="background:#eaf7ee"' : ""}>
                <span>${label}</span>
                <strong>${value}</strong>
              </div>
            `).join("")}
          </div>
          <div>
            ${makeNode("CPU context", "PC + register values",
              active === "registers" || active === "saved", "purple")}
            <p class="diagram-caption">
              The PCB and related kernel structures help the OS manage the process.
            </p>
            ${makeNode("Scheduler", "State + priority",
              active === "schedule" || active === "blocked", "blue")}
          </div>
        </div>`;
    }

    if (currentModule === "messages") {
      html = `
        <p class="diagram-title">MESSAGE PASSING · PROCESS A → PROCESS B</p>
        <div class="diagram-row">
          ${makeNode("Process A", "Sender",
            active === "sender" || active === "done")}
          <span class="arrow">→</span>
          ${makeNode("IPC channel", "Send / receive",
            active === "channel", "blue")}
          <span class="arrow">→</span>
          ${makeNode("Mailbox / queue", "Message buffer",
            active === "queue", "purple")}
          <span class="arrow">→</span>
          ${makeNode("Process B", "Receiver",
            active === "receiver" || active === "done",
            active === "receiver" ? "warn" : "")}
        </div>
        <div class="diagram-row" style="margin-top:22px">
          ${makeNode("Message payload",
            stageIndex >= 1 ? '"Task complete"' : "Waiting to be sent",
            active === "queue")}
        </div>
        <p class="diagram-caption">
          A blocking receive may wait for a message. Non-blocking receive can return
          immediately if no message is available.
        </p>`;
    }

    if (currentModule === "memory") {
      const layers = [
        ["CPU / execution unit", "Executes instructions", "cpu", "EXECUTE"],
        ["Registers", "Immediate operands and addresses", "registers", "FAST ACCESS"],
        ["CPU cache", "Copies of useful data", "cache", "CACHE LOOKUP"],
        ["Main memory (RAM)", "Active programs and data", "ram", "MAIN MEMORY"],
        ["I/O buffer", "Temporary holding area for transfers", "buffer", "I/O TRANSFER"]
      ];

      html = `
        <p class="diagram-title">A SIMPLIFIED DATA PATH</p>
        <div class="memory-stack">
          ${layers.map(([title, subtitle, key, tag], index) => `
            <div class="memory-layer ${active === key ? "active" : ""}">
              <div>
                <strong>${title}</strong>
                <small>${subtitle}</small>
              </div>
              <span class="layer-tag">${tag}</span>
            </div>
            ${index < layers.length - 1
              ? '<div class="memory-flow">↕</div>'
              : ""}
          `).join("")}
        </div>
        <p class="diagram-caption">
          Registers, cache, RAM, and buffers serve different purposes. This is a
          simplified teaching model rather than a literal path for every instruction.
        </p>`;
    }

    $("visualStage").innerHTML = html;
  }

  function updateControls() {
    const total = data().stages.length;
    const completed = Math.max(0, stageIndex + 1);
    const percentage = Math.round((completed / total) * 100);

    $("stepCounter").textContent = `Step ${completed} of ${total}`;
    $("progressText").textContent = `${percentage}% complete`;
    $("progressBar").style.width = `${percentage}%`;

    $("stageBadge").textContent =
      stageIndex < 0
        ? "Ready to begin"
        : stageIndex >= total - 1
          ? "Simulation complete"
          : `Stage ${completed} · ${total}`;

    $("stepBtn").disabled = stageIndex >= total - 1;
  }

  function advance() {
    stopPlayback();

    if (stageIndex >= data().stages.length - 1) {
      return;
    }

    stageIndex++;
    const stage = data().stages[stageIndex];

    renderVisual();

    $("eventTitle").textContent = stage.title;
    $("eventExplanation").textContent = stage.explanation;

    const log = $("eventLog");

    if (stageIndex === 0) {
      log.innerHTML = "";
    }

    log.querySelectorAll("li").forEach(item => {
      item.classList.remove("current");
    });

    const item = document.createElement("li");
    item.className = "current";

    const time = document.createElement("time");
    time.textContent = `STEP ${stageIndex + 1}`;

    item.appendChild(time);
    item.appendChild(document.createTextNode(stage.log));
    log.appendChild(item);

    updateControls();
  }

  function play() {
    if (stageIndex >= data().stages.length - 1) {
      resetSimulation();
    }

    $("startBtn").disabled = true;
    $("pauseBtn").disabled = false;

    function tick() {
      if (stageIndex >= data().stages.length - 1) {
        stopPlayback();
        return;
      }

      stageIndex++;
      const stage = data().stages[stageIndex];

      renderVisual();
      $("eventTitle").textContent = stage.title;
      $("eventExplanation").textContent = stage.explanation;

      const log = $("eventLog");

      if (stageIndex === 0) {
        log.innerHTML = "";
      }

      log.querySelectorAll("li").forEach(item => {
        item.classList.remove("current");
      });

      const item = document.createElement("li");
      item.className = "current";

      const time = document.createElement("time");
      time.textContent = `STEP ${stageIndex + 1}`;

      item.appendChild(time);
      item.appendChild(document.createTextNode(stage.log));
      log.appendChild(item);

      updateControls();

      if (stageIndex < data().stages.length - 1) {
        timer = window.setTimeout(
          tick,
          Number($("speedSelect").value) || 950
        );
      } else {
        stopPlayback();
      }
    }

    timer = window.setTimeout(tick, 100);
  }

  function resetSimulation() {
    stopPlayback();
    stageIndex = -1;

    $("eventLog").innerHTML =
      '<li class="empty-log">Simulation events will appear here.</li>';

    $("eventTitle").textContent = "Ready when you are";
    $("eventExplanation").textContent =
      "Start the animation or move through the events manually.";

    renderVisual();
    updateControls();
  }

  function renderQuiz() {
    const quiz = data().quiz;

    $("quizQuestion").textContent = quiz.question;
    $("quizOptions").innerHTML = "";

    quiz.options.forEach((option, index) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "quiz-option";
      button.textContent = `${String.fromCharCode(65 + index)}. ${option}`;

      button.addEventListener("click", () => answerQuiz(index));
      $("quizOptions").appendChild(button);
    });

    $("quizFeedback").className = "quiz-feedback";
    $("quizFeedback").textContent =
      "Choose an answer to see your result.";

    quizAnswered = false;
  }

  function answerQuiz(index) {
    if (quizAnswered) return;

    quizAnswered = true;

    const quiz = data().quiz;
    const buttons = [
      ...$("quizOptions").querySelectorAll("button")
    ];

    buttons.forEach((button, buttonIndex) => {
      button.disabled = true;

      if (buttonIndex === quiz.answer) {
        button.classList.add("correct");
      } else if (buttonIndex === index) {
        button.classList.add("incorrect");
      }
    });

    const feedback = $("quizFeedback");

    if (index === quiz.answer) {
      feedback.textContent = `Correct! ${quiz.feedback}`;
      feedback.classList.add("good");
    } else {
      feedback.textContent = `Not quite. ${quiz.feedback}`;
      feedback.classList.add("bad");
    }
  }

  function setModule(moduleId) {
    if (!modules[moduleId]) return;

    stopPlayback();
    currentModule = moduleId;
    stageIndex = -1;

    document.querySelectorAll(".module-tab").forEach(button => {
      const selected = button.dataset.module === moduleId;

      button.classList.toggle("active", selected);
      button.setAttribute("aria-current", selected ? "page" : "false");
    });

    const module = data();

    $("moduleKicker").textContent = module.kicker;
    $("moduleTitle").textContent = module.title;
    $("moduleIntro").textContent = module.intro;

    renderQuiz();
    resetSimulation();
  }

  $("moduleNav").addEventListener("click", event => {
    const button = event.target.closest("[data-module]");

    if (button) {
      setModule(button.dataset.module);
    }
  });

  $("startBtn").addEventListener("click", play);
  $("pauseBtn").addEventListener("click", stopPlayback);
  $("stepBtn").addEventListener("click", advance);
  $("resetBtn").addEventListener("click", resetSimulation);
  $("quizResetBtn").addEventListener("click", renderQuiz);

  setModule("interrupts");
})();
