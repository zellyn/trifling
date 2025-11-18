/*
 * Turtle Graphics for Trifle
 * Adapted from Skulpt (https://github.com/skulpt/skulpt)
 *
 * Copyright (c) 2009-2016 Scott Graham and contributors to the Skulpt Project
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

// Turtle graphics implementation for Pyodide
// This is a significant adaptation from Skulpt's turtle.js to work with Pyodide instead of Skulpt

export function setupTurtleGraphics(targetElementId = 'canvasPane', options = {}) {
    const target = document.getElementById(targetElementId);
    if (!target) {
        throw new Error(`Turtle target element '${targetElementId}' not found`);
    }

    // Configuration
    const config = {
        width: 600,
        height: 400,
        animate: true,
        onFirstCanvas: options.onFirstCanvas || null  // Callback when first canvas is created
    };

    // Create a container for all turtle canvases to keep them stacked
    const container = document.createElement('div');
    container.id = 'turtleContainer';
    container.style.position = 'absolute';
    container.style.left = '50%';
    container.style.top = '50%';
    container.style.transform = 'translate(-50%, -50%)';
    container.style.width = `${config.width}px`;
    container.style.height = `${config.height}px`;
    target.appendChild(container);

    config.target = container;  // Append canvases to container

    // Turtle shapes
    const SHAPES = {
        arrow: [[-10, 0], [10, 0], [0, 10]],
        square: [[10, -10], [10, 10], [-10, 10], [-10, -10]],
        triangle: [[10, -5.77], [0, 11.55], [-10, -5.77]],
        classic: [[0, 0], [-5, -9], [0, -7], [5, -9]],
        turtle: [
            [0, 16], [-2, 14], [-1, 10], [-4, 7], [-7, 9], [-9, 8], [-6, 5], [-7, 1], [-5, -3], [-8, -6],
            [-6, -8], [-4, -5], [0, -7], [4, -5], [6, -8], [8, -6], [5, -3], [7, 1], [6, 5], [9, 8], [7, 9],
            [4, 7], [1, 10], [2, 14]
        ],
        circle: [
            [10, 0], [9.51, 3.09], [8.09, 5.88], [5.88, 8.09], [3.09, 9.51], [0, 10], [-3.09, 9.51],
            [-5.88, 8.09], [-8.09, 5.88], [-9.51, 3.09], [-10, 0], [-9.51, -3.09], [-8.09, -5.88],
            [-5.88, -8.09], [-3.09, -9.51], [-0, -10], [3.09, -9.51], [5.88, -8.09], [8.09, -5.88],
            [9.51, -3.09]
        ]
    };

    // Layer management
    function createLayer(zIndex, isHidden = false) {
        const canvas = document.createElement('canvas');
        const width = config.width;
        const height = config.height;

        canvas.width = width;
        canvas.height = height;
        canvas.style.position = 'absolute';
        // Center the canvas within the container
        canvas.style.left = '50%';
        canvas.style.top = '50%';
        canvas.style.transform = 'translate(-50%, -50%)';
        canvas.style.zIndex = zIndex;
        canvas.style.overflow = 'hidden';

        if (isHidden) {
            canvas.style.display = 'none';
        }

        const isFirstCanvas = config.target.children.length === 0;
        config.target.appendChild(canvas);  // Append to container

        // Trigger callback when first canvas is added
        if (isFirstCanvas && typeof config.onFirstCanvas === 'function') {
            config.onFirstCanvas();
        }

        const context = canvas.getContext('2d');
        context.lineCap = 'round';
        context.lineJoin = 'round';

        return context;
    }

    function clearLayer(context, color = null, image = null) {
        if (!context) return;

        context.save();
        context.setTransform(1, 0, 0, 1, 0, 0);

        if (color) {
            context.fillStyle = color;
            context.fillRect(0, 0, context.canvas.width, context.canvas.height);
        } else {
            context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        }

        if (image) {
            context.drawImage(image, 0, 0);
        }

        context.restore();
    }

    function removeLayer(layer) {
        if (layer && layer.canvas && layer.canvas.parentNode) {
            layer.canvas.parentNode.removeChild(layer.canvas);
        }
    }

    // Frame Manager - handles batching of operations and sprite updates
    class FrameManager {
        constructor() {
            this._frames = [];      // Queue of operations to execute
            this._frameCount = 0;   // Count of operations (where countAsFrame=true)
            this._buffer = 1;       // Frame buffer (from tracer())
            this._turtles = [];     // All turtle instances
            this._updateScheduled = false;  // Whether update is scheduled via Promise
        }

        addTurtle(turtle) {
            this._turtles.push(turtle);
        }

        frameBuffer(buffer) {
            if (typeof buffer === 'number') {
                this._buffer = buffer;
                // If new buffer <= current count, trigger immediate update
                if (buffer && buffer <= this._frameCount) {
                    this.update();
                }
            }
            return this._buffer;
        }

        addFrame(method, countAsFrame) {
            if (countAsFrame) {
                this._frameCount++;
            }

            this._frames.push(method);

            // Should we update now?
            const shouldUpdate = this._buffer && this._frameCount === this._buffer;
            if (shouldUpdate) {
                // Defer execution to allow current operation (like a for loop) to complete
                // This matches Skulpt's promise-based behavior where the full movement
                // is queued before any execution happens
                if (!this._updateScheduled) {
                    this._updateScheduled = true;
                    Promise.resolve().then(() => {
                        this._updateScheduled = false;
                        this.update();
                    });
                }
            }
        }

        update() {
            // Execute all queued operations in the next animation frame
            const frames = this._frames;
            this._frames = [];
            this._frameCount = 0;

            return new Promise((resolve) => {
                requestAnimationFrame(() => {
                    // Execute all frames in this batch
                    for (let i = 0; i < frames.length; i++) {
                        if (frames[i]) {
                            frames[i]();
                        }
                    }

                    // Redraw all turtle sprites
                    const sprites = screen.spriteLayer();
                    clearLayer(sprites);
                    for (let i = 0; i < this._turtles.length; i++) {
                        const turtle = this._turtles[i];
                        if (turtle._shown) {
                            turtle.drawTurtle(sprites);
                        }
                    }

                    resolve();
                });
            });
        }

        reset() {
            this._frames = [];
            this._frameCount = 0;
            this._buffer = 1;
            this._turtles = [];
            this._updateScheduled = false;
        }
    }

    // Create singleton frame manager
    const frameManager = new FrameManager();

    // Screen (world coordinate system)
    class Screen {
        constructor() {
            this.llx = -config.width / 2;
            this.lly = -config.height / 2;
            this.urx = config.width / 2;
            this.ury = config.height / 2;
            this.xScale = (this.urx - this.llx) / config.width;
            this.yScale = -1 * (this.ury - this.lly) / config.height;
            this.lineScale = Math.min(Math.abs(this.xScale), Math.abs(this.yScale));

            this._bgcolor = 'white';
            this._sprites = null;
            this._background = null;
        }

        tracer(n = null) {
            if (n !== null) {
                frameManager.frameBuffer(n);
            }
            return frameManager._buffer;
        }

        spriteLayer() {
            if (!this._sprites) {
                this._sprites = createLayer(3);
                this.applyWorld(this._sprites);
            }
            return this._sprites;
        }

        bgLayer() {
            if (!this._background) {
                this._background = createLayer(1);
                this.applyWorld(this._background);
            }
            return this._background;
        }

        applyWorld(context) {
            if (!context) return;

            clearLayer(context);
            context.restore();
            context.save();
            // Skulpt coordinate system: scale then translate
            context.scale(1 / this.xScale, 1 / this.yScale);
            context.translate(-this.llx, -this.ury);
        }

        bgcolor(color = null) {
            if (color !== null) {
                this._bgcolor = color;
                clearLayer(this.bgLayer(), this._bgcolor);
            }
            return this._bgcolor;
        }

        clear() {
            if (this._sprites) {
                clearLayer(this._sprites);
            }
            if (this._background) {
                clearLayer(this._background, this._bgcolor);
            }
        }

        reset() {
            removeLayer(this._sprites);
            removeLayer(this._background);
            this._sprites = null;
            this._background = null;
        }
    }

    // Turtle class
    class Turtle {
        constructor(shape = 'classic') {
            this.screen = screen;
            this._shape = shape;
            this._paper = null;
            this.reset();
            // Register with frame manager
            frameManager.addTurtle(this);
        }

        reset() {
            this._x = 0;
            this._y = 0;
            this._radians = 0;  // Start facing right (east) like Skulpt
            this._angle = 0;
            this._shown = true;
            this._down = true;
            this._color = 'black';
            this._fill = 'black';
            this._size = 1;
            this._filling = false;
            this._speed = 3;
            this._computed_speed = 6;  // speed * 2, for animation frames
            this._fullCircle = 360;

            if (this._paper) {
                removeLayer(this._paper);
                this._paper = null;
            }
        }

        getPaper() {
            if (!this._paper) {
                this._paper = createLayer(2);
                // Apply Skulpt-style coordinate transformation
                const canvas = this._paper.canvas;
                this._paper.save();
                // Scale to flip y-axis, then translate to center origin
                this._paper.scale(1 / this.screen.xScale, 1 / this.screen.yScale);
                this._paper.translate(-this.screen.llx, -this.screen.ury);
            }
            return this._paper;
        }

        // Movement
        forward(distance) {
            // Capture current position and direction at queue time
            const startX = this._x;
            const startY = this._y;
            const radians = this._radians;
            const color = this._color;
            const size = this._size;
            const dx = Math.cos(radians) * distance;
            const dy = Math.sin(radians) * distance;

            const pixels = Math.abs(distance);
            const frames = this._computed_speed ? Math.round(Math.max(1, pixels / this._computed_speed)) : 1;
            const xStep = dx / frames;
            const yStep = dy / frames;

            // Queue frame for fill buffer (doesn't count)
            if (this._filling) {
                frameManager.addFrame(() => {
                    if (this._fillPath) {
                        this._fillPath.lineTo(this._x, this._y);
                    }
                }, false);
            }

            // Split movement into multiple frames
            for (let i = 0; i < frames; i++) {
                // Compute destination based on start position of THIS forward() call
                const newX = startX + xStep * (i + 1);
                const newY = startY + yStep * (i + 1);
                const isFirst = (i === 0);
                // Capture the PREVIOUS position (for moveTo in first frame)
                const prevX = (i === 0) ? startX : (startX + xStep * i);
                const prevY = (i === 0) ? startY : (startY + yStep * i);

                // Capture all values in closure
                frameManager.addFrame(() => {
                    if (this._down) {
                        const paper = this.getPaper();
                        if (isFirst) {
                            paper.beginPath();
                            paper.moveTo(prevX, prevY);  // Use captured start position
                        }
                        paper.lineWidth = size * this.screen.lineScale;
                        paper.strokeStyle = color;
                        paper.lineTo(newX, newY);
                        paper.stroke();
                    }
                    // Update turtle position during execution
                    this._x = newX;
                    this._y = newY;
                }, true); // countAsFrame = true
            }

            // Update turtle position IMMEDIATELY (like Skulpt's promise chain)
            // This allows the next forward() call to see the updated position
            this._x = startX + dx;
            this._y = startY + dy;
        }

        backward(distance) {
            this.forward(-distance);
        }

        right(angle) {
            // Capture current angle at queue time
            const startAngle = this._angle;
            const delta = -angle; // right is negative
            const frames = this._computed_speed ? Math.round(Math.max(1, Math.abs(delta) / this._computed_speed)) : 1;
            const angleStep = delta / frames;

            for (let i = 0; i < frames; i++) {
                const newAngle = startAngle + angleStep * (i + 1);
                const newRadians = (newAngle * Math.PI) / 180;

                frameManager.addFrame(() => {
                    this._angle = newAngle;
                    this._radians = newRadians;
                }, true); // countAsFrame = true
            }

            // Update angle IMMEDIATELY (like Skulpt)
            this._angle = startAngle + delta;
            this._radians = (this._angle * Math.PI) / 180;
        }

        left(angle) {
            // Capture current angle at queue time
            const startAngle = this._angle;
            const delta = angle; // left is positive
            const frames = this._computed_speed ? Math.round(Math.max(1, Math.abs(delta) / this._computed_speed)) : 1;
            const angleStep = delta / frames;

            for (let i = 0; i < frames; i++) {
                const newAngle = startAngle + angleStep * (i + 1);
                const newRadians = (newAngle * Math.PI) / 180;

                frameManager.addFrame(() => {
                    this._angle = newAngle;
                    this._radians = newRadians;
                }, true); // countAsFrame = true
            }

            // Update angle IMMEDIATELY (like Skulpt)
            this._angle = startAngle + delta;
            this._radians = (this._angle * Math.PI) / 180;
        }

        goto(x, y) {
            // Capture current state at queue time
            const startX = this._x;
            const startY = this._y;
            const color = this._color;
            const size = this._size;
            const dx = x - startX;
            const dy = y - startY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const frames = this._computed_speed ? Math.round(Math.max(1, distance / this._computed_speed)) : 1;
            const xStep = dx / frames;
            const yStep = dy / frames;

            // Queue frame for fill buffer (doesn't count)
            if (this._filling) {
                frameManager.addFrame(() => {
                    if (this._fillPath) {
                        this._fillPath.lineTo(this._x, this._y);
                    }
                }, false);
            }

            for (let i = 0; i < frames; i++) {
                const newX = startX + xStep * (i + 1);
                const newY = startY + yStep * (i + 1);
                const isFirst = (i === 0);
                const prevX = (i === 0) ? startX : (startX + xStep * i);
                const prevY = (i === 0) ? startY : (startY + yStep * i);

                frameManager.addFrame(() => {
                    if (this._down) {
                        const paper = this.getPaper();
                        if (isFirst) {
                            paper.beginPath();
                            paper.moveTo(prevX, prevY);  // Use captured position
                        }
                        paper.lineWidth = size * this.screen.lineScale;
                        paper.strokeStyle = color;
                        paper.lineTo(newX, newY);
                        paper.stroke();
                    }
                    this._x = newX;
                    this._y = newY;
                }, true); // countAsFrame = true
            }

            // Update position IMMEDIATELY
            this._x = x;
            this._y = y;
        }

        setx(x) {
            this.goto(x, this._y);
        }

        sety(y) {
            this.goto(this._x, y);
        }

        setheading(angle) {
            const newRadians = (angle * Math.PI) / 180;
            frameManager.addFrame(() => {
                this._angle = angle;
                this._radians = newRadians;
            }, true); // countAsFrame = true

            // Update angle IMMEDIATELY
            this._angle = angle;
            this._radians = newRadians;
        }

        home() {
            this.goto(0, 0);
            this.setheading(0);
        }

        circle(radius, extent = null, steps = null) {
            // Default extent is full circle
            if (extent === null) {
                extent = this._fullCircle;
            }

            // Calculate number of steps for smooth circle
            if (steps === null) {
                const scale = 1 / this.screen.lineScale;
                const frac = Math.abs(extent) / this._fullCircle;
                steps = 1 + Math.floor(Math.min(11 + Math.abs(radius * scale) / 6, 59) * frac);
            }

            // Calculate per-step values
            const w = extent / steps;  // angle change per step
            const w2 = 0.5 * w;        // half angle for rotation
            let l = 2 * radius * Math.sin((w * Math.PI) / this._fullCircle);  // chord length

            // Handle negative radius (draws to the right instead of left)
            let angleIncrement = w;
            if (radius < 0) {
                l = -l;
                angleIncrement = -w;
            }

            // Capture starting state
            const startX = this._x;
            const startY = this._y;
            const startAngle = this._angle;
            const color = this._color;
            const size = this._size;

            // Rotate by half angle to start
            let currentAngle = startAngle + w2;
            let currentX = startX;
            let currentY = startY;

            // Draw circle as series of line segments
            for (let i = 0; i < steps; i++) {
                const headingAngle = currentAngle + angleIncrement * i;
                const headingRadians = (headingAngle * Math.PI) / 180;
                const dx = Math.cos(headingRadians) * l;
                const dy = Math.sin(headingRadians) * l;
                const nextX = currentX + dx;
                const nextY = currentY + dy;

                // Capture values in closure
                const angle = headingAngle;
                const radians = headingRadians;
                const toX = nextX;
                const toY = nextY;
                const fromX = currentX;
                const fromY = currentY;
                const isFirst = (i === 0);

                // Queue rotation frame
                frameManager.addFrame(() => {
                    this._angle = angle;
                    this._radians = radians;
                }, true);

                // Queue movement frame with fill support
                if (this._filling) {
                    frameManager.addFrame(() => {
                        if (this._fillPath) {
                            this._fillPath.lineTo(toX, toY);
                        }
                    }, false);
                }

                frameManager.addFrame(() => {
                    if (this._down) {
                        const paper = this.getPaper();
                        if (isFirst) {
                            paper.beginPath();
                            paper.moveTo(fromX, fromY);
                        }
                        paper.lineWidth = size * this.screen.lineScale;
                        paper.strokeStyle = color;
                        paper.lineTo(toX, toY);
                        paper.stroke();
                    }
                    this._x = toX;
                    this._y = toY;
                }, true);

                currentX = nextX;
                currentY = nextY;
            }

            // Final heading update
            const endAngle = radius < 0 ? startAngle - extent : startAngle + extent;
            const endRadians = (endAngle * Math.PI) / 180;

            frameManager.addFrame(() => {
                this._angle = endAngle;
                this._radians = endRadians;
            }, true);

            // Update position and angle IMMEDIATELY (like Skulpt)
            this._x = currentX;
            this._y = currentY;
            this._angle = endAngle;
            this._radians = endRadians;
        }

        // Position queries
        position() {
            return [this._x, this._y];
        }

        xcor() {
            return this._x;
        }

        ycor() {
            return this._y;
        }

        heading() {
            return this._angle;
        }

        // Pen control
        penup() {
            frameManager.addFrame(() => {
                this._down = false;
            }, false); // countAsFrame = false (doesn't count in Skulpt)
        }

        pendown() {
            frameManager.addFrame(() => {
                this._down = true;
            }, false); // countAsFrame = false (doesn't count in Skulpt)
        }

        pensize(size = null) {
            if (size !== null) {
                this._size = size;
            }
            return this._size;
        }

        speed(speed = null) {
            if (speed === null) {
                return this._speed;
            }

            // Support string speed names like Skulpt
            const speeds = {"fastest": 0, "fast": 10, "normal": 6, "slow": 3, "slowest": 1};
            if (typeof speed === "string" && speed in speeds) {
                speed = speeds[speed];
            }

            // Validate speed is a number
            if (typeof speed !== "number") {
                throw new Error("speed expected a string or number");
            }

            // Round speeds between 0.5 and 10.5, otherwise set to 0 (instant)
            if (speed > 0.5 && speed < 10.5) {
                speed = Math.round(speed);
            } else {
                speed = 0;
            }

            this._speed = speed;
            this._computed_speed = speed * 2;  // Internal animation speed
            return this._speed;
        }

        pencolor(...args) {
            if (args.length === 1) {
                this._color = this.normalizeColor(args[0]);
            } else if (args.length === 3) {
                this._color = this.normalizeColor(args);
            }
            return this._color;
        }

        fillcolor(...args) {
            if (args.length === 1) {
                this._fill = this.normalizeColor(args[0]);
            } else if (args.length === 3) {
                this._fill = this.normalizeColor(args);
            }
            return this._fill;
        }

        color(penColor = null, fillColor = null) {
            if (penColor !== null) {
                this.pencolor(penColor);
                if (fillColor !== null) {
                    this.fillcolor(fillColor);
                } else {
                    this.fillcolor(penColor);
                }
            }
            return [this._color, this._fill];
        }

        // Fill control
        begin_fill() {
            this._filling = true;
            this._fillPath = new Path2D();
            this._fillPath.moveTo(this._x, this._y);
        }

        end_fill() {
            if (this._filling && this._fillPath) {
                // Capture the fill color at queue time
                const fillColor = this._fill;
                // Keep reference to current path (don't null it yet - queued frames still need it)
                const fillPath = this._fillPath;

                // Turn off filling flag immediately so new movements don't add to path
                this._filling = false;

                // Queue the fill operation as a frame
                frameManager.addFrame(() => {
                    const paper = this.getPaper();
                    paper.fillStyle = fillColor;
                    paper.fill(fillPath);
                }, false); // Don't count as animation frame

                // Now we can null the path for next begin_fill()
                this._fillPath = null;
            }
        }

        // Visibility
        showturtle() {
            frameManager.addFrame(() => {
                this._shown = true;
            }, true); // countAsFrame = true (counts in Skulpt)
        }

        hideturtle() {
            frameManager.addFrame(() => {
                this._shown = false;
            }, true); // countAsFrame = true (counts in Skulpt)
        }

        // Drawing
        dot(size = null, color = null) {
            const dotSize = size || Math.max(this._size + 4, this._size * 2);
            const dotColor = color ? this.normalizeColor(color) : this._color;

            const paper = this.getPaper();
            paper.beginPath();
            paper.arc(this._x, this._y, dotSize / 2, 0, 2 * Math.PI);
            paper.fillStyle = dotColor;
            paper.fill();
        }

        clear() {
            if (this._paper) {
                clearLayer(this._paper);
            }
        }

        shape(name) {
            if (SHAPES[name]) {
                this._shape = name;
                frameManager.updateSprites();
            }
        }

        write(text, move = false, align = 'left', font = ['Arial', 8, 'normal']) {
            // Parse font argument (can be tuple/array or string)
            let fontString;
            if (Array.isArray(font)) {
                const face = font[0] || 'Arial';
                let size = String(font[1] || 12);
                const type = font[2] || 'normal';
                if (!/pt|px/.test(size)) {
                    size += 'pt';
                }
                fontString = `${type} ${size} ${face}`;
            } else {
                fontString = font;
            }

            const paper = this.getPaper();
            paper.save();
            paper.font = fontString;
            paper.textAlign = align;
            paper.scale(1, -1);  // Flip text right-side up
            paper.fillStyle = this._fill;
            paper.fillText(text, this._x, -this._y);
            paper.restore();

            // Handle move parameter
            if (move && (align === 'left' || align === 'center')) {
                const width = paper.measureText(text).width;
                const moveDistance = align === 'center' ? width / 2 : width;
                this.forward(moveDistance);
            }
        }

        // Sprite rendering (called by frame manager)
        drawTurtle(context) {
            const shape = SHAPES[this._shape];
            if (!shape) return;

            context.save();
            context.translate(this._x, this._y);
            // Undo the world transform to draw in pixel space
            context.scale(this.screen.xScale, this.screen.yScale);

            // Calculate bearing like Skulpt does
            const x = Math.cos(this._radians) / this.screen.xScale;
            const y = Math.sin(this._radians) / this.screen.yScale;
            const bearing = Math.atan2(y, x) - Math.PI / 2;
            context.rotate(bearing);

            context.beginPath();
            context.lineWidth = 1;
            context.strokeStyle = this._color;
            context.fillStyle = this._fill;
            context.moveTo(shape[0][0], shape[0][1]);

            for (let i = 1; i < shape.length; i++) {
                context.lineTo(shape[i][0], shape[i][1]);
            }

            context.closePath();
            context.fill();
            context.stroke();
            context.restore();
        }

        // Utility
        normalizeColor(color) {
            // Handle array/tuple colors [r, g, b]
            if (Array.isArray(color)) {
                const r = Math.max(0, Math.min(255, Math.floor(color[0])));
                const g = Math.max(0, Math.min(255, Math.floor(color[1])));
                const b = Math.max(0, Math.min(255, Math.floor(color[2])));
                return `rgb(${r}, ${g}, ${b})`;
            }
            // Handle string colors
            return String(color);
        }
    }

    // Create singleton screen
    const screen = new Screen();
    screen.clear();

    // Create default turtle
    const defaultTurtle = new Turtle();

    // Return API
    return {
        screen,
        Turtle,
        defaultTurtle,
        reset: () => {
            frameManager.reset();
            screen.reset();
            screen.clear();
            defaultTurtle.reset();
            frameManager.addTurtle(defaultTurtle); // Re-register after reset
        },
        setSize: (width, height) => {
            // Update config
            config.width = width;
            config.height = height;

            // Resize the container element
            config.target.style.width = `${width}px`;
            config.target.style.height = `${height}px`;

            // Reset screen to recreate layers with new size
            screen.reset();

            // Update screen coordinate system
            screen.llx = -width / 2;
            screen.lly = -height / 2;
            screen.urx = width / 2;
            screen.ury = height / 2;
            screen.xScale = (screen.urx - screen.llx) / width;
            screen.yScale = -1 * (screen.ury - screen.lly) / height;
            screen.lineScale = Math.min(Math.abs(screen.xScale), Math.abs(screen.yScale));

            // Clear with new dimensions
            screen.clear();

            // Reset frame manager and turtle
            frameManager.reset();
            defaultTurtle.reset();
            frameManager.addTurtle(defaultTurtle); // Re-register after reset
        }
    };
}
