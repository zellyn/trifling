// Python Environment Setup for Trifle
// Sets up Python runtime: stdio, input, canvas API, turtle graphics, and modules

const OUTPUT_BATCH_SIZE = 1000;  // Batch output every 1000 characters for performance

// Input resolver for handling input requests
let inputResolver = null;

// Make input promise available to Python
self._getInputValue = () => {
    return new Promise((resolve) => {
        inputResolver = resolve;
    });
};

// Handle input response from main thread
export function handleInputResponse({ value }) {
    if (inputResolver) {
        inputResolver(value);
        inputResolver = null;
    }
}

// Store references needed for trifle imports
let currentOwnerId = null;
let currentTrifleId = null;
let loadedTrifles = new Map(); // Cache loaded trifles

// Function to set current context (called from worker when loading files)
export function setImportContext(ownerId, trifleId) {
    currentOwnerId = ownerId;
    currentTrifleId = trifleId;
    loadedTrifles.clear(); // Clear cache on new run
}

// Synchronous trifle code getter (called from Python import hook)
self._getTrifleCode = (trifleName) => {
    // Check if already loaded (cache)
    if (loadedTrifles.has(trifleName)) {
        return loadedTrifles.get(trifleName);
    }

    // This will be called synchronously from Python, so we need to have
    // pre-loaded all trifles. We'll do this when files are loaded.
    const result = JSON.stringify({
        error: `Trifle '${trifleName}' not found. Make sure the trifle exists and is owned by the current user.`
    });

    return result;
};

// Function to preload a trifle (called from worker before running code)
// jsonResult should be a JSON string with {code, id} or {error}
export function preloadTrifle(name, jsonResult) {
    loadedTrifles.set(name, jsonResult);
}

// Setup Python environment (stdout/stderr capture, input, canvas API, trifling module)
export async function setupPythonEnvironment(pyodide, send) {
    // Make worker message sender available to Python via the js module
    // Python's 'from js import workerSend' will find it here
    self.workerSend = send;

    pyodide.runPython(`
import sys
from io import StringIO
from js import workerSend

# Console capture that batches output for performance
class WorkerConsole:
    def __init__(self, stream_type):
        self.stream_type = stream_type
        self.buffer = []
        self.batch_size = ${OUTPUT_BATCH_SIZE}  # Send after this many characters
        self.current_length = 0

    def write(self, text):
        if text:
            self.buffer.append(text)
            self.current_length += len(text)

            # Flush if buffer is getting large
            if self.current_length >= self.batch_size:
                self.flush()
        return len(text)

    def flush(self):
        if self.buffer:
            combined = ''.join(self.buffer)
            workerSend(self.stream_type, {'text': combined})
            self.buffer = []
            self.current_length = 0

# Redirect stdout and stderr to worker
sys.stdout = WorkerConsole('stdout')
sys.stderr = WorkerConsole('stderr')

# Input handler using message passing
_input_resolver = None
_input_value = None

def _wait_for_input(prompt=''):
    global _input_resolver, _input_value
    import asyncio

    # Send input request to main thread
    workerSend('input-request', {'prompt': str(prompt)})

    # This will be a synchronous call in the worker
    # The main thread will send back 'input-response'
    # We need to handle this differently...
    # Actually, we can't do synchronous waiting in a nice way
    # Let's use the existing async approach but with JSPI if available

    sys.stdout.flush()

# Try to use JSPI if available
try:
    from pyodide.ffi import run_sync, can_run_sync
    _has_jspi = True
except ImportError:
    _has_jspi = False

if _has_jspi:
    # JSPI-based input (works in Chrome/Firefox)
    async def _input_async(prompt=''):
        from js import _getInputValue
        import asyncio

        sys.stdout.flush()
        workerSend('input-request', {'prompt': str(prompt)})

        # Wait for response via _getInputValue promise
        result = await _getInputValue()
        if result is None:
            raise KeyboardInterrupt('Execution stopped')
        return result

    def input(prompt=''):
        # Check at runtime if JSPI is actually supported by the browser
        if not can_run_sync():
            raise RuntimeError(
                'input() is not supported in this browser.\\n'
                'This browser does not support JSPI (JavaScript Promise Integration).\\n'
                'Please use Chrome 137+, Firefox 139+, or Edge.\\n'
                'Safari does not yet support this feature.'
            )
        return run_sync(_input_async(prompt))

    __builtins__.input = input
else:
    # Fallback: input not supported without JSPI
    def input(prompt=''):
        raise RuntimeError(
            'input() is not supported in this browser.\\n'
            'Please use Chrome 137+, Firefox 139+, or Edge.'
        )

    __builtins__.input = input

# Canvas API that sends drawing commands to main thread
class Canvas:
    def __init__(self):
        self._send = workerSend
        self._width = 600
        self._height = 400

    def set_size(self, width, height):
        """Set canvas size."""
        self._width = width
        self._height = height
        self._send('canvas-set-size', {'width': width, 'height': height})

    def get_size(self):
        """Get canvas size as (width, height)."""
        return (self._width, self._height)

    def clear(self):
        """Clear the entire canvas."""
        self._send('canvas-clear', {})

    def set_fill_color(self, color):
        """Set fill color (CSS color string)."""
        self._send('canvas-set-fill-color', {'color': color})

    def set_stroke_color(self, color):
        """Set stroke color (CSS color string)."""
        self._send('canvas-set-stroke-color', {'color': color})

    def set_line_width(self, width):
        """Set line width."""
        self._send('canvas-set-line-width', {'width': width})

    def fill_rect(self, x, y, width, height):
        """Draw a filled rectangle."""
        self._send('canvas-fill-rect', {'x': x, 'y': y, 'width': width, 'height': height})

    def stroke_rect(self, x, y, width, height):
        """Draw a rectangle outline."""
        self._send('canvas-stroke-rect', {'x': x, 'y': y, 'width': width, 'height': height})

    def fill_circle(self, x, y, radius):
        """Draw a filled circle."""
        self._send('canvas-fill-circle', {'x': x, 'y': y, 'radius': radius})

    def stroke_circle(self, x, y, radius):
        """Draw a circle outline."""
        self._send('canvas-stroke-circle', {'x': x, 'y': y, 'radius': radius})

    def draw_line(self, x1, y1, x2, y2):
        """Draw a line from (x1, y1) to (x2, y2)."""
        self._send('canvas-draw-line', {'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2})

    def draw_text(self, text, x, y):
        """Draw text at position (x, y)."""
        self._send('canvas-draw-text', {'text': text, 'x': x, 'y': y})

    def set_font(self, font):
        """Set font (CSS font string, e.g. '16px Arial')."""
        self._send('canvas-set-font', {'font': font})

# Create trifling module with canvas and mine submodule
import sys
import types

# Canvas context that mimics HTML5 Canvas 2D API
class CanvasContext:
    def __init__(self):
        self._send = workerSend
        self._fillStyle = 'black'
        self._strokeStyle = 'black'
        self._lineWidth = 1

    @property
    def fillStyle(self):
        return self._fillStyle

    @fillStyle.setter
    def fillStyle(self, value):
        self._fillStyle = value

    @property
    def strokeStyle(self):
        return self._strokeStyle

    @strokeStyle.setter
    def strokeStyle(self, value):
        self._strokeStyle = value

    @property
    def lineWidth(self):
        return self._lineWidth

    @lineWidth.setter
    def lineWidth(self, value):
        self._lineWidth = value

    def fillRect(self, x, y, width, height):
        """Draw a filled rectangle."""
        self._send('canvas-draw', {
            'operation': 'fillStyle',
            'args': [self._fillStyle]
        })
        self._send('canvas-draw', {
            'operation': 'fillRect',
            'args': [x, y, width, height]
        })

    def strokeRect(self, x, y, width, height):
        """Draw a rectangle outline."""
        self._send('canvas-draw', {
            'operation': 'strokeStyle',
            'args': [self._strokeStyle]
        })
        self._send('canvas-draw', {
            'operation': 'lineWidth',
            'args': [self._lineWidth]
        })
        self._send('canvas-draw', {
            'operation': 'strokeRect',
            'args': [x, y, width, height]
        })

    def clearRect(self, x, y, width, height):
        """Clear a rectangle area."""
        self._send('canvas-draw', {
            'operation': 'clearRect',
            'args': [x, y, width, height]
        })

    def beginPath(self):
        """Begin a new path."""
        self._send('canvas-draw', {
            'operation': 'beginPath',
            'args': []
        })

    def closePath(self):
        """Close the current path."""
        self._send('canvas-draw', {
            'operation': 'closePath',
            'args': []
        })

    def moveTo(self, x, y):
        """Move to a point without drawing."""
        self._send('canvas-draw', {
            'operation': 'moveTo',
            'args': [x, y]
        })

    def lineTo(self, x, y):
        """Draw a line to a point."""
        self._send('canvas-draw', {
            'operation': 'lineTo',
            'args': [x, y]
        })

    def arc(self, x, y, radius, startAngle, endAngle):
        """Draw an arc/circle."""
        self._send('canvas-draw', {
            'operation': 'arc',
            'args': [x, y, radius, startAngle, endAngle]
        })

    def fill(self):
        """Fill the current path."""
        self._send('canvas-draw', {
            'operation': 'fillStyle',
            'args': [self._fillStyle]
        })
        self._send('canvas-draw', {
            'operation': 'fill',
            'args': []
        })

    def stroke(self):
        """Stroke the current path."""
        self._send('canvas-draw', {
            'operation': 'strokeStyle',
            'args': [self._strokeStyle]
        })
        self._send('canvas-draw', {
            'operation': 'lineWidth',
            'args': [self._lineWidth]
        })
        self._send('canvas-draw', {
            'operation': 'stroke',
            'args': []
        })

# Create canvas submodule with ctx
canvas_module = types.ModuleType('trifling.canvas')
canvas_module.__doc__ = "HTML5-like Canvas 2D API"
canvas_module.__package__ = 'trifling'
canvas_module.ctx = CanvasContext()

# Create mine as a proper module that can have submodules
mine_module = types.ModuleType('trifling.mine')
mine_module.__doc__ = "Submodule for importing user's own trifles"
mine_module.__package__ = 'trifling.mine'
mine_module.__path__ = []  # This makes it a package

class TriflingModule:
    def __init__(self):
        self.canvas = canvas_module  # Use the canvas module instead of Canvas instance
        self.mine = mine_module

trifling = TriflingModule()
sys.modules['trifling'] = trifling
sys.modules['trifling.canvas'] = canvas_module
sys.modules['trifling.mine'] = mine_module

# Custom import hook for trifling.mine.* imports
import sys
from importlib.abc import MetaPathFinder, Loader
from importlib.machinery import ModuleSpec
import types

class TriflingMineImporter(MetaPathFinder, Loader):
    """Import hook for trifling.mine.* modules"""

    def find_spec(self, fullname, path, target=None):
        """Find module spec for trifling.mine.* imports"""
        if fullname.startswith('trifling.mine.') and fullname.count('.') == 2:
            # Extract trifle name: trifling.mine.foo -> foo
            return ModuleSpec(fullname, self, origin='trifle-import')
        return None

    def create_module(self, spec):
        """Return None to use default module creation"""
        return None

    def exec_module(self, module):
        """Load trifle code into the module"""
        fullname = module.__name__
        trifle_name = fullname.split('.')[-1]

        # Request trifle code from JavaScript
        # This will be handled by the worker message system
        from js import _getTrifleCode
        import json

        try:
            result_json = _getTrifleCode(trifle_name)
            result = json.loads(result_json)

            if result.get('error'):
                raise ImportError(result['error'])

            code = result.get('code', '')

            if not code:
                raise ImportError(f"Trifle '{trifle_name}' has no code")

            # Set up module metadata
            module.__file__ = f'<trifle:{trifle_name}>'
            module.__package__ = fullname.rsplit('.', 1)[0]

            # Execute the trifle's main.py code in this module's namespace
            exec(code, module.__dict__)

        except ImportError:
            raise
        except Exception as e:
            raise ImportError(f"Failed to import trifle '{trifle_name}': {e}")

# Install the import hook
sys.meta_path.insert(0, TriflingMineImporter())
`);

    // Turtle graphics will be set up via message passing to main thread
    // All turtles (including default) use ID-based messaging
    pyodide.runPython(`
import sys
from js import workerSend

# Turtle ID management
_turtle_counter = -1  # Start at -1 so first turtle (default) gets ID 0

def _reset_turtle_counter():
    """Reset turtle counter for new execution. Called by JS before each run."""
    global _turtle_counter
    _turtle_counter = -1

# Turtle class for creating turtles
class Turtle:
    def __init__(self, shape='classic'):
        global _turtle_counter
        
        # Assign unique ID to this turtle
        _turtle_counter += 1
        self._id = f'turtle_{_turtle_counter}'
        
        # Create JS turtle instance
        workerSend('turtle-create', {'id': self._id, 'shape': shape})
    
    def forward(self, distance):
        workerSend('turtle-method', {'id': self._id, 'method': 'forward', 'args': [distance]})
    
    def fd(self, distance):
        self.forward(distance)
    
    def backward(self, distance):
        workerSend('turtle-method', {'id': self._id, 'method': 'backward', 'args': [distance]})
    
    def back(self, distance):
        self.backward(distance)
    
    def bk(self, distance):
        self.backward(distance)
    
    def right(self, angle):
        workerSend('turtle-method', {'id': self._id, 'method': 'right', 'args': [angle]})
    
    def rt(self, angle):
        self.right(angle)
    
    def left(self, angle):
        workerSend('turtle-method', {'id': self._id, 'method': 'left', 'args': [angle]})
    
    def lt(self, angle):
        self.left(angle)
    
    def goto(self, x, y):
        workerSend('turtle-method', {'id': self._id, 'method': 'goto', 'args': [x, y]})
    
    def setpos(self, x, y):
        self.goto(x, y)
    
    def setposition(self, x, y):
        self.goto(x, y)
    
    def setx(self, x):
        workerSend('turtle-method', {'id': self._id, 'method': 'setx', 'args': [x]})
    
    def sety(self, y):
        workerSend('turtle-method', {'id': self._id, 'method': 'sety', 'args': [y]})
    
    def setheading(self, angle):
        workerSend('turtle-method', {'id': self._id, 'method': 'setheading', 'args': [angle]})
    
    def seth(self, angle):
        self.setheading(angle)
    
    def home(self):
        workerSend('turtle-method', {'id': self._id, 'method': 'home', 'args': []})
    
    def penup(self):
        workerSend('turtle-method', {'id': self._id, 'method': 'penup', 'args': []})
    
    def pu(self):
        self.penup()
    
    def up(self):
        self.penup()
    
    def pendown(self):
        workerSend('turtle-method', {'id': self._id, 'method': 'pendown', 'args': []})
    
    def pd(self):
        self.pendown()
    
    def down(self):
        self.pendown()
    
    def pensize(self, size):
        workerSend('turtle-method', {'id': self._id, 'method': 'pensize', 'args': [size]})
    
    def width(self, size):
        self.pensize(size)
    
    def pencolor(self, *args):
        # Just like other methods - plain dict works fine
        workerSend('turtle-method', {'id': self._id, 'method': 'pencolor', 'args': list(args)})

    def fillcolor(self, *args):
        # Just like other methods - plain dict works fine
        workerSend('turtle-method', {'id': self._id, 'method': 'fillcolor', 'args': list(args)})

    
    def color(self, *args):
        if len(args) == 1:
            self.pencolor(args[0])
            self.fillcolor(args[0])
        elif len(args) == 2:
            self.pencolor(args[0])
            self.fillcolor(args[1])
    
    def begin_fill(self):
        workerSend('turtle-method', {'id': self._id, 'method': 'begin_fill', 'args': []})
    
    def end_fill(self):
        workerSend('turtle-method', {'id': self._id, 'method': 'end_fill', 'args': []})
    
    def showturtle(self):
        workerSend('turtle-method', {'id': self._id, 'method': 'showturtle', 'args': []})
    
    def st(self):
        self.showturtle()
    
    def hideturtle(self):
        workerSend('turtle-method', {'id': self._id, 'method': 'hideturtle', 'args': []})
    
    def ht(self):
        self.hideturtle()
    
    def dot(self, size=None, color=None):
        workerSend('turtle-method', {'id': self._id, 'method': 'dot', 'args': [size, color]})
    
    def clear(self):
        workerSend('turtle-method', {'id': self._id, 'method': 'clear', 'args': []})
    
    def delay(self, delay):
        pass  # No-op for now

    def speed(self, speed):
        workerSend('turtle-method', {'id': self._id, 'method': 'speed', 'args': [speed]})

    def circle(self, radius, extent=None, steps=None):
        args = [radius]
        if extent is not None:
            args.append(extent)
            if steps is not None:
                args.append(steps)
        workerSend('turtle-method', {'id': self._id, 'method': 'circle', 'args': args})

    def shape(self, name=None):
        if name is None:
            # Return current shape (not implemented - would need getter)
            return 'classic'
        workerSend('turtle-method', {'id': self._id, 'method': 'shape', 'args': [name]})

    def write(self, text, move=False, align='left', font=('Arial', 8, 'normal')):
        workerSend('turtle-method', {'id': self._id, 'method': 'write', 'args': [str(text), move, align, font]})

# Default turtle uses the pre-created turtle_0 (created by JS setupTurtleGraphics)
class _DefaultTurtle:
    def __init__(self):
        self._id = 'turtle_0'

    # Delegate all methods to Turtle class implementation
    def __getattr__(self, name):
        # Get the method from Turtle class
        turtle_method = getattr(Turtle, name, None)
        if turtle_method and callable(turtle_method):
            # Return a bound method
            return lambda *args, **kwargs: turtle_method(self, *args, **kwargs)
        raise AttributeError(f"'{type(self).__name__}' object has no attribute '{name}'")

_default_turtle = _DefaultTurtle()

# Module-level functions delegate to default turtle
def forward(distance):
    _default_turtle.forward(distance)

def fd(distance):
    _default_turtle.fd(distance)

def backward(distance):
    _default_turtle.backward(distance)

def back(distance):
    _default_turtle.back(distance)

def bk(distance):
    _default_turtle.bk(distance)

def right(angle):
    _default_turtle.right(angle)

def rt(angle):
    _default_turtle.rt(angle)

def left(angle):
    _default_turtle.left(angle)

def lt(angle):
    _default_turtle.lt(angle)

def goto(x, y):
    _default_turtle.goto(x, y)

def setpos(x, y):
    _default_turtle.setpos(x, y)

def setposition(x, y):
    _default_turtle.setposition(x, y)

def setx(x):
    _default_turtle.setx(x)

def sety(y):
    _default_turtle.sety(y)

def setheading(angle):
    _default_turtle.setheading(angle)

def seth(angle):
    _default_turtle.seth(angle)

def home():
    _default_turtle.home()

def penup():
    _default_turtle.penup()

def pu():
    _default_turtle.pu()

def up():
    _default_turtle.up()

def pendown():
    _default_turtle.pendown()

def pd():
    _default_turtle.pd()

def down():
    _default_turtle.down()

def pensize(size):
    _default_turtle.pensize(size)

def width(size):
    _default_turtle.width(size)

def pencolor(*args):
    _default_turtle.pencolor(*args)

def fillcolor(*args):
    _default_turtle.fillcolor(*args)

def color(*args):
    _default_turtle.color(*args)

def begin_fill():
    _default_turtle.begin_fill()

def end_fill():
    _default_turtle.end_fill()

def showturtle():
    _default_turtle.showturtle()

def st():
    _default_turtle.st()

def hideturtle():
    _default_turtle.hideturtle()

def ht():
    _default_turtle.ht()

def dot(size=None, color=None):
    _default_turtle.dot(size, color)

def clear():
    _default_turtle.clear()

def reset():
    workerSend('turtle-reset', {})

def speed(speed):
    _default_turtle.speed(speed)

def circle(radius, extent=None, steps=None):
    _default_turtle.circle(radius, extent, steps)

def shape(name=None):
    return _default_turtle.shape(name)

def write(text, move=False, align='left', font=('Arial', 8, 'normal')):
    _default_turtle.write(text, move, align, font)

# Screen class
class Screen:
    def __init__(self):
        pass

    def tracer(self, n=None, delay=None):
        if n is not None:
            workerSend('turtle-tracer', {'n': n})
        # delay parameter not implemented yet
        return None

    def setup(self, width=600, height=400, startx=None, starty=None):
        """Set canvas size. startx/starty are ignored (web-based)."""
        workerSend('turtle-setup', {'width': width, 'height': height})

    def bgcolor(self, color=None):
        if color is not None:
            workerSend('turtle-bgcolor', {'color': color})
        return None  # Getter not implemented

    def clear(self):
        clear()

    def reset(self):
        reset()

# Module-level screen setup function
def setup(width=600, height=400, startx=None, starty=None):
    """Set canvas size. startx/starty are ignored (web-based)."""
    workerSend('turtle-setup', {'width': width, 'height': height})

def bgcolor(color=None):
    """Set the background color of the canvas."""
    if color is not None:
        workerSend('turtle-bgcolor', {'color': color})

# Register turtle module
sys.modules['turtle'] = sys.modules[__name__]
`);
}
