---
title: Canvas API
description: Draw shapes and graphics with the canvas API
category: Graphics
order: 3
---

# Canvas API

The canvas API gives you direct control over drawing. It's perfect for creating custom graphics, games, and visualizations.

## Basic Setup

Access the canvas through the `trifling.canvas` module:

```python-editor-graphics
from trifling.canvas import ctx

# Draw a rectangle
ctx.fillStyle = "#FF6B6B"
ctx.fillRect(50, 50, 100, 80)
```

## Drawing Shapes

### Rectangles

```python-editor-graphics
from trifling.canvas import ctx

# Filled rectangle
ctx.fillStyle = "#4ECDC4"
ctx.fillRect(20, 20, 100, 60)

# Outlined rectangle
ctx.strokeStyle = "#1A535C"
ctx.lineWidth = 3
ctx.strokeRect(150, 20, 100, 60)
```

### Lines and Paths

```python-editor-graphics
from trifling.canvas import ctx

ctx.strokeStyle = "#FF6B6B"
ctx.lineWidth = 2

# Draw a triangle
ctx.beginPath()
ctx.moveTo(100, 50)
ctx.lineTo(150, 150)
ctx.lineTo(50, 150)
ctx.closePath()
ctx.stroke()
```

### Circles and Arcs

```python-editor-graphics
from trifling.canvas import ctx, Math

# Draw a circle
ctx.fillStyle = "#FFE66D"
ctx.beginPath()
ctx.arc(100, 100, 50, 0, 2 * Math.PI)
ctx.fill()

# Draw an outlined circle
ctx.strokeStyle = "#4ECDC4"
ctx.lineWidth = 3
ctx.beginPath()
ctx.arc(250, 100, 50, 0, 2 * Math.PI)
ctx.stroke()
```

## Colors and Styles

### RGB and Hex Colors

```python-editor-graphics
from trifling.canvas import ctx

# Hex colors
ctx.fillStyle = "#FF6B6B"
ctx.fillRect(20, 20, 60, 60)

# RGB colors
ctx.fillStyle = "rgb(78, 205, 196)"
ctx.fillRect(100, 20, 60, 60)

# RGBA (with transparency)
ctx.fillStyle = "rgba(255, 230, 109, 0.5)"
ctx.fillRect(180, 20, 60, 60)
```

### Filled and Stroked Shapes

```python-editor-graphics
from trifling.canvas import ctx, Math

# Filled circle
ctx.fillStyle = "#FF6B6B"
ctx.beginPath()
ctx.arc(80, 80, 40, 0, 2 * Math.PI)
ctx.fill()

# Stroked circle
ctx.strokeStyle = "#4ECDC4"
ctx.lineWidth = 4
ctx.beginPath()
ctx.arc(200, 80, 40, 0, 2 * Math.PI)
ctx.stroke()

# Both filled and stroked
ctx.fillStyle = "#FFE66D"
ctx.strokeStyle = "#1A535C"
ctx.lineWidth = 3
ctx.beginPath()
ctx.arc(320, 80, 40, 0, 2 * Math.PI)
ctx.fill()
ctx.stroke()
```

## Patterns and Designs

### Grid Pattern

```python-editor-graphics
from trifling.canvas import ctx

# Draw a grid
ctx.strokeStyle = "#E0E0E0"
ctx.lineWidth = 1

# Vertical lines
for x in range(0, 400, 20):
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, 300)
    ctx.stroke()

# Horizontal lines
for y in range(0, 300, 20):
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(400, y)
    ctx.stroke()
```

### Concentric Circles

```python-editor-graphics
from trifling.canvas import ctx, Math

colors = ["#FF6B6B", "#FFA500", "#FFE66D", "#4ECDC4", "#45B7D1"]

for i in range(5):
    ctx.strokeStyle = colors[i]
    ctx.lineWidth = 3
    ctx.beginPath()
    radius = 100 - (i * 18)
    ctx.arc(200, 150, radius, 0, 2 * Math.PI)
    ctx.stroke()
```

### Checkerboard

```python-editor-graphics
from trifling.canvas import ctx

size = 40
colors = ["#1A535C", "#4ECDC4"]

for row in range(8):
    for col in range(8):
        color_index = (row + col) % 2
        ctx.fillStyle = colors[color_index]
        ctx.fillRect(col * size, row * size, size, size)
```

## Animation Basics

Create simple animations by clearing and redrawing:

```python-editor-graphics
from trifling.canvas import ctx, Math
import time

# Clear canvas
ctx.fillStyle = "white"
ctx.fillRect(0, 0, 400, 300)

# Animate a ball moving across the screen
for i in range(20):
    # Clear previous frame
    ctx.clearRect(0, 0, 400, 300)

    # Draw ball at new position
    x = 20 + i * 18
    y = 150

    ctx.fillStyle = "#FF6B6B"
    ctx.beginPath()
    ctx.arc(x, y, 15, 0, 2 * Math.PI)
    ctx.fill()

    time.sleep(0.05)
```

## Complex Shapes

### Star

```python-editor-graphics
from trifling.canvas import ctx, Math

def draw_star(cx, cy, spikes, outer_radius, inner_radius):
    ctx.beginPath()
    for i in range(spikes * 2):
        angle = (i * Math.PI) / spikes
        radius = outer_radius if i % 2 == 0 else inner_radius
        x = cx + radius * Math.cos(angle - Math.PI / 2)
        y = cy + radius * Math.sin(angle - Math.PI / 2)
        if i == 0:
            ctx.moveTo(x, y)
        else:
            ctx.lineTo(x, y)
    ctx.closePath()

# Draw a yellow star
ctx.fillStyle = "#FFE66D"
ctx.strokeStyle = "#FFA500"
ctx.lineWidth = 2
draw_star(200, 150, 5, 80, 35)
ctx.fill()
ctx.stroke()
```

## Canvas Methods Reference

### Drawing Rectangles
- `fillRect(x, y, width, height)` - Draw filled rectangle
- `strokeRect(x, y, width, height)` - Draw outlined rectangle
- `clearRect(x, y, width, height)` - Clear rectangle area

### Drawing Paths
- `beginPath()` - Start a new path
- `closePath()` - Close the current path
- `moveTo(x, y)` - Move to position without drawing
- `lineTo(x, y)` - Draw line to position
- `arc(x, y, radius, startAngle, endAngle)` - Draw arc/circle
- `fill()` - Fill the current path
- `stroke()` - Stroke the current path

### Styles
- `fillStyle` - Color for filling (hex, rgb, rgba)
- `strokeStyle` - Color for stroking
- `lineWidth` - Width of lines

## Try Your Own!

Create a custom design:

```python-editor-graphics
from trifling.canvas import ctx, Math

# Your creative code here!
# Try combining shapes, colors, and patterns

# Example: Simple house
ctx.fillStyle = "#8B4513"
ctx.fillRect(100, 150, 200, 120)  # House body

ctx.fillStyle = "#FF6B6B"
ctx.beginPath()  # Roof
ctx.moveTo(90, 150)
ctx.lineTo(200, 80)
ctx.lineTo(310, 150)
ctx.closePath()
ctx.fill()

ctx.fillStyle = "#4ECDC4"
ctx.fillRect(150, 200, 50, 70)  # Door
```

## Next Steps

- Combine canvas with turtle graphics
- Create interactive visualizations
- Build simple games
- Check out [Trifle Imports](/static/docs/imports.html) to share canvas utilities
