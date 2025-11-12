// Trifle Worker - Runs Python code in Web Worker to avoid blocking UI
// Communicates with main thread via JSON message protocol

import { setupPythonEnvironment, handleInputResponse as handleInputResponseFromEnv, setImportContext, preloadTrifle } from './python-env.js';

let pyodide = null;
let isRunning = false;
let currentOwnerId = null;
let currentTrifleId = null;

// Message helpers
function send(type, data = {}) {
    // Convert Pyodide proxy objects to plain JS objects for postMessage
    // If data has a toJs method (Pyodide proxy), convert it
    if (data && typeof data.toJs === 'function') {
        data = data.toJs({ dict_converter: Object.fromEntries });
    }
    self.postMessage({ type, ...data });
}

// Main message handler
self.onmessage = async (e) => {
    const { type, ...data } = e.data;

    try {
        switch (type) {
            case 'init':
                await handleInit(data);
                break;
            case 'load-files':
                await handleLoadFiles(data);
                break;
            case 'run':
                await handleRun(data);
                break;
            case 'stop':
                handleStop();
                break;
            case 'input-response':
                handleInputResponse(data);
                break;
            default:
                console.error('Unknown message type:', type);
        }
    } catch (error) {
        send('error', { message: error.message, stack: error.stack });
    }
};

// Initialize Pyodide
async function handleInit({ pyodideVersion }) {
    try {
        // Load Pyodide from CDN (using import for ES6 module compatibility)
        const pyodideModule = await import(`https://cdn.jsdelivr.net/pyodide/${pyodideVersion}/full/pyodide.mjs`);

        pyodide = await pyodideModule.loadPyodide({
            indexURL: `https://cdn.jsdelivr.net/pyodide/${pyodideVersion}/full/`,
        });

        // Setup Python environment
        await setupPythonEnvironment(pyodide, send);

        send('ready');
    } catch (error) {
        send('error', { message: `Failed to initialize Pyodide: ${error.message}` });
    }
}

// Load files into Pyodide filesystem
async function handleLoadFiles({ files, ownerId, trifleId, availableTrifles }) {
    try {
        // Store context for imports
        currentOwnerId = ownerId;
        currentTrifleId = trifleId;
        setImportContext(ownerId, trifleId);

        // Preload available trifles for imports
        if (availableTrifles) {
            // Build a map of trifle names to check for duplicates
            const nameMap = new Map();
            for (const trifle of availableTrifles) {
                if (!nameMap.has(trifle.name)) {
                    nameMap.set(trifle.name, []);
                }
                nameMap.get(trifle.name).push(trifle);
            }

            // Preload each unique name
            for (const [name, trifles] of nameMap.entries()) {
                if (trifles.length > 1) {
                    // Multiple trifles with same name
                    const errorResult = JSON.stringify({
                        error: `Multiple trifles named '${name}' found. Please rename to make unique.`
                    });
                    preloadTrifle(name, errorResult);
                } else {
                    const trifle = trifles[0];
                    // Check for self-import
                    if (trifle.id === trifleId) {
                        const errorResult = JSON.stringify({
                            error: `Cannot import from current trifle '${name}' (self-import not allowed)`
                        });
                        preloadTrifle(name, errorResult);
                    } else {
                        // Normal case: preload the trifle code
                        const result = JSON.stringify({
                            code: trifle.code,
                            id: trifle.id
                        });
                        preloadTrifle(name, result);
                    }
                }
            }
        }

        for (const file of files) {
            // Create parent directories if needed
            const parts = file.path.split('/');
            let currentPath = '';

            for (let i = 0; i < parts.length - 1; i++) {
                currentPath += (i > 0 ? '/' : '') + parts[i];
                try {
                    pyodide.FS.mkdir(currentPath);
                } catch (e) {
                    // Directory already exists, ignore
                }
            }

            // Write file
            try {
                pyodide.FS.writeFile(file.path, file.content);
            } catch (e) {
                send('error', { message: `Failed to write file ${file.path}: ${e.message}` });
                return;
            }
        }

        send('files-loaded');
    } catch (error) {
        send('error', { message: `Failed to load files: ${error.message}` });
    }
}

// Run Python code
async function handleRun({ mainFile }) {
    if (isRunning) {
        send('error', { message: 'Code is already running' });
        return;
    }

    isRunning = true;

    try {
        // Reset turtle counter before each run
        pyodide.runPython(`
import turtle
if hasattr(turtle, '_reset_turtle_counter'):
    turtle._reset_turtle_counter()
`);

        // Execute main.py
        await pyodide.runPythonAsync(`
import traceback
import sys

try:
    with open('${mainFile}', 'r') as f:
        # Execute in global namespace so user code has access to input, etc.
        code = f.read()
        exec(code, globals())
except Exception as e:
    traceback.print_exc()
finally:
    # Flush any remaining output
    sys.stdout.flush()
    sys.stderr.flush()
`);

        // Get list of all files to sync back to database
        const filesData = pyodide.runPython(`
import os
import json

def list_files(directory='.', prefix=''):
    """Recursively list all files"""
    files = []
    try:
        for item in os.listdir(directory):
            path = os.path.join(directory, item)
            relative_path = os.path.join(prefix, item) if prefix else item

            # Skip special directories and Python cache
            if item.startswith('.') or item == '__pycache__':
                continue

            if os.path.isfile(path):
                try:
                    with open(path, 'r') as f:
                        content = f.read()
                    files.append({'path': relative_path, 'content': content})
                except:
                    # Skip binary files or files we can't read
                    pass
            elif os.path.isdir(path):
                files.extend(list_files(path, relative_path))
    except:
        pass
    return files

json.dumps(list_files())
`);

        // Send files back to main thread for syncing
        send('files-changed', { files: JSON.parse(filesData) });

        send('complete');
    } catch (error) {
        send('error', { message: error.message });
    } finally {
        isRunning = false;
    }
}

// Stop execution (not much we can do in worker)
function handleStop() {
    // Workers don't have a way to interrupt Python execution
    // The main thread will terminate() this worker
    isRunning = false;
}

// Handle input response from main thread
function handleInputResponse({ value }) {
    handleInputResponseFromEnv({ value });
}
