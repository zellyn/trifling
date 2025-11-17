// Snippet Runner - Lightweight runnable code snippets for documentation
// Embeds mini Ace editor instances with Pyodide execution

import { TrifleDB } from './db.js';
import { showError, showInfo } from './notifications.js';
import { setupTurtleGraphics } from './turtle.js';

// Terminal is loaded as a global from terminal.js script tag
const Terminal = window.Terminal;

// Shared worker for all snippets on the page
let sharedWorker = null;
let workerReady = false;
let activeSnippet = null; // Currently running snippet

// Initialize worker
async function initWorker() {
    if (sharedWorker) return;

    sharedWorker = new Worker('/js/worker.js', { type: 'module' });

    sharedWorker.onmessage = (e) => {
        const { type, ...data } = e.data;

        if (type === 'ready') {
            workerReady = true;
            return;
        }

        // Route messages to active snippet
        if (activeSnippet) {
            activeSnippet.handleWorkerMessage(type, data);
        }
    };

    sharedWorker.onerror = (error) => {
        console.error('Worker error:', error);
        showError('Python runtime error');
    };

    // Initialize the worker
    sharedWorker.postMessage({
        type: 'init',
        pyodideVersion: 'v0.28.3'
    });
}

// Counter for unique snippet IDs
let snippetIdCounter = 0;

class CodeSnippet {
    constructor(container) {
        this.container = container;
        this.snippetId = snippetIdCounter++;  // Unique ID for this snippet
        this.mode = container.dataset.mode; // 'text' or 'graphics'
        this.codeDiv = container.querySelector('.snippet-code');
        this.outputDiv = container.querySelector('.snippet-output');
        this.runBtn = container.querySelector('.run-btn');
        this.copyBtn = container.querySelector('.copy-btn');
        this.makeTrifleBtn = container.querySelector('.make-trifle-btn');

        this.editor = null;
        this.terminal = null;
        this.canvas = null;
        this.canvasCtx = null;
        this.isRunning = false;
        this.turtleAPI = null;
        this.turtles = {};  // Map of turtle ID -> Turtle instance

        this.init();
    }

    async init() {
        // Load Ace editor
        await this.loadAce();

        // Get code from data attribute
        const code = this.codeDiv.dataset.code;

        // Debug: log the code to see if it's being read correctly
        if (!code || code.trim() === '') {
            console.error('No code found in data-code attribute for snippet', this.snippetId);
            console.log('codeDiv:', this.codeDiv);
            console.log('dataset:', this.codeDiv.dataset);
        }

        // Create Ace editor
        this.editor = ace.edit(this.codeDiv);
        this.editor.setTheme('ace/theme/monokai');
        this.editor.session.setMode('ace/mode/python');
        this.editor.setOptions({
            fontSize: '13px',
            showPrintMargin: false,
            highlightActiveLine: false,
            showGutter: true,
            maxLines: 20,
            minLines: 3,
        });
        this.editor.setValue(code, -1);

        // Set up output area
        this.setupOutput();

        // Event listeners
        this.runBtn.addEventListener('click', () => this.run());
        this.copyBtn.addEventListener('click', () => this.copyCode());
        this.makeTrifleBtn.addEventListener('click', () => this.makeTrifle());

        // Cmd/Ctrl+Enter to run
        this.editor.commands.addCommand({
            name: 'run',
            bindKey: { win: 'Ctrl-Enter', mac: 'Cmd-Enter' },
            exec: () => this.run(),
        });
    }

    async loadAce() {
        // Load Ace editor if not already loaded
        if (window.ace) return;

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/ace/1.32.2/ace.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Ace editor'));
            document.head.appendChild(script);
        });
    }

    setupOutput() {
        if (this.mode === 'graphics') {
            // Create canvas pane for graphics mode (similar to editor)
            this.outputDiv.innerHTML = `
                <div class="snippet-terminal"></div>
                <div class="snippet-canvas-pane" id="snippetCanvasPane-${this.snippetId}">
                    <canvas class="snippet-canvas"></canvas>
                </div>
            `;
            this.canvas = this.outputDiv.querySelector('.snippet-canvas');
            this.canvas.width = 400;
            this.canvas.height = 300;
            this.canvasCtx = this.canvas.getContext('2d');

            const terminalDiv = this.outputDiv.querySelector('.snippet-terminal');
            this.terminal = new Terminal(terminalDiv, null);

            // Set up turtle graphics
            const canvasPaneId = `snippetCanvasPane-${this.snippetId}`;
            this.turtleAPI = setupTurtleGraphics(canvasPaneId, {
                width: 400,
                height: 300,
                animate: true
            });
            // Register default turtle
            this.turtles['turtle_0'] = this.turtleAPI.defaultTurtle;
        } else {
            // Create terminal for text mode
            this.outputDiv.innerHTML = '<div class="snippet-terminal"></div>';
            const terminalDiv = this.outputDiv.querySelector('.snippet-terminal');
            this.terminal = new Terminal(terminalDiv, null);
        }
    }

    async run() {
        if (this.isRunning) return;

        // Initialize worker if needed
        if (!sharedWorker) {
            await initWorker();
        }

        // Wait for worker to be ready
        if (!workerReady) {
            showInfo('Loading Python runtime...');
            const waitForWorker = new Promise((resolve) => {
                const check = setInterval(() => {
                    if (workerReady) {
                        clearInterval(check);
                        resolve();
                    }
                }, 100);
            });
            await waitForWorker;
        }

        // Set this as active snippet
        activeSnippet = this;
        this.isRunning = true;
        this.runBtn.textContent = '⏹ Stop';
        this.runBtn.disabled = true;

        // Clear output
        this.terminal.clear();
        if (this.canvas) {
            this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        if (this.turtleAPI) {
            // Clean up all turtle paper layers before resetting
            for (const id in this.turtles) {
                const turtle = this.turtles[id];
                if (turtle._paper && turtle._paper.canvas) {
                    turtle._paper.canvas.remove();
                }
            }

            this.turtleAPI.reset();
            this.turtles = {};
            this.turtles['turtle_0'] = this.turtleAPI.defaultTurtle;
        }

        // Show output area
        this.outputDiv.style.display = 'block';

        // Get code
        const code = this.editor.getValue();

        // Load code as single file
        sharedWorker.postMessage({
            type: 'load-files',
            files: [{ path: 'snippet.py', content: code }],
            ownerId: 'snippet',
            trifleId: 'snippet',
        });

        // Run code
        sharedWorker.postMessage({
            type: 'run',
            mainFile: 'snippet.py',
        });
    }

    handleWorkerMessage(type, data) {
        switch (type) {
            case 'stdout':
                this.terminal.write(data.text);
                break;
            case 'stderr':
                this.terminal.write(data.text, 'error');
                break;
            case 'input-request':
                this.terminal.requestInput(data.prompt, (value) => {
                    sharedWorker.postMessage({
                        type: 'input-response',
                        value,
                    });
                });
                break;
            case 'canvas-clear':
                if (this.canvas) {
                    this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                }
                break;
            case 'canvas-draw':
                if (this.canvas) {
                    this.handleCanvasDraw(data);
                }
                break;
            case 'turtle-create':
                // Create a new turtle instance
                if (this.turtleAPI) {
                    this.turtles[data.id] = new this.turtleAPI.Turtle(data.shape || 'classic');
                }
                break;
            case 'turtle-method':
                // Call a method on a specific turtle instance
                if (this.turtleAPI) {
                    const turtle = this.turtles[data.id];
                    if (turtle && typeof turtle[data.method] === 'function') {
                        turtle[data.method](...(data.args || []));
                    }
                }
                break;
            case 'turtle-reset':
                if (this.turtleAPI) {
                    this.turtleAPI.reset();
                    // Re-register default turtle after reset
                    this.turtles = {};
                    this.turtles['turtle_0'] = this.turtleAPI.defaultTurtle;
                }
                break;
            case 'turtle-tracer':
                if (this.turtleAPI) {
                    this.turtleAPI.screen.tracer(data.n);
                }
                break;
            case 'turtle-setup':
                if (this.turtleAPI) {
                    // Clean up all turtle paper layers before resizing
                    for (const id in this.turtles) {
                        const turtle = this.turtles[id];
                        if (turtle._paper && turtle._paper.canvas) {
                            turtle._paper.canvas.remove();
                        }
                    }

                    // Set canvas size
                    this.canvas.width = data.width;
                    this.canvas.height = data.height;
                    this.turtleAPI.setSize(data.width, data.height);
                    // Re-register all turtles after resize
                    this.turtles = {};
                    this.turtles['turtle_0'] = this.turtleAPI.defaultTurtle;
                }
                break;
            case 'complete':
                this.isRunning = false;
                this.runBtn.textContent = '▶ Run';
                this.runBtn.disabled = false;
                activeSnippet = null;
                break;
            case 'error':
                this.terminal.write(data.message + '\n', 'error');
                this.isRunning = false;
                this.runBtn.textContent = '▶ Run';
                this.runBtn.disabled = false;
                activeSnippet = null;
                break;
        }
    }

    handleCanvasDraw(data) {
        const { operation, args } = data;
        const ctx = this.canvasCtx;

        try {
            switch (operation) {
                case 'fillRect':
                    ctx.fillRect(...args);
                    break;
                case 'strokeRect':
                    ctx.strokeRect(...args);
                    break;
                case 'clearRect':
                    ctx.clearRect(...args);
                    break;
                case 'fillStyle':
                    ctx.fillStyle = args[0];
                    break;
                case 'strokeStyle':
                    ctx.strokeStyle = args[0];
                    break;
                case 'lineWidth':
                    ctx.lineWidth = args[0];
                    break;
                case 'beginPath':
                    ctx.beginPath();
                    break;
                case 'closePath':
                    ctx.closePath();
                    break;
                case 'moveTo':
                    ctx.moveTo(...args);
                    break;
                case 'lineTo':
                    ctx.lineTo(...args);
                    break;
                case 'arc':
                    ctx.arc(...args);
                    break;
                case 'fill':
                    ctx.fill();
                    break;
                case 'stroke':
                    ctx.stroke();
                    break;
            }
        } catch (error) {
            console.error('Canvas draw error:', error);
        }
    }


    copyCode() {
        const code = this.editor.getValue();
        navigator.clipboard.writeText(code).then(() => {
            const originalText = this.copyBtn.textContent;
            this.copyBtn.textContent = '✓';
            setTimeout(() => {
                this.copyBtn.textContent = originalText;
            }, 1000);
        });
    }

    async makeTrifle() {
        const code = this.editor.getValue();

        // Show modal to get name and description
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Create Trifle</h2>
                <form id="createTrifleForm">
                    <div class="form-group">
                        <label for="trifleName">Name:</label>
                        <input type="text" id="trifleName" required autofocus>
                    </div>
                    <div class="form-group">
                        <label for="trifleDesc">Description (optional):</label>
                        <textarea id="trifleDesc" rows="3"></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Create</button>
                        <button type="button" class="btn-secondary" id="cancelBtn">Cancel</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        const form = modal.querySelector('#createTrifleForm');
        const cancelBtn = modal.querySelector('#cancelBtn');
        const nameInput = modal.querySelector('#trifleName');

        nameInput.focus();

        // Escape to cancel
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                cleanup();
            }
        };

        const cleanup = () => {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', escHandler);
        };

        cancelBtn.addEventListener('click', cleanup);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) cleanup();
        });

        document.addEventListener('keydown', escHandler);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = nameInput.value.trim();
            const description = modal.querySelector('#trifleDesc').value.trim();

            // Create trifle in IndexedDB
            const db = new TrifleDB();
            try {
                const trifleId = await db.createTrifle(name, description);

                // Add the code as main.py
                const file = {
                    name: 'main.py',
                    content: code,
                };

                const fileHash = await db.addFile(file.content);
                await db.updateTrifleFile(trifleId, file.name, fileHash, new Date().toISOString());

                showInfo(`Trifle "${name}" created!`);
                cleanup();

                // Redirect to editor
                window.location.href = `/editor.html?id=${trifleId}`;
            } catch (error) {
                showError('Failed to create trifle: ' + error.message);
                console.error(error);
            }
        });
    }
}

// Initialize all code snippets on the page
function initSnippets() {
    const snippets = document.querySelectorAll('.runnable-snippet');
    snippets.forEach(container => {
        new CodeSnippet(container);
    });
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSnippets);
} else {
    initSnippets();
}
