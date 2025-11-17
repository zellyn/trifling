---
title: Trifle Imports
description: Share code between trifles with the import system
category: Advanced
order: 4
---

# Trifle Imports

Trifling lets you import code from other trifles, making it easy to share utilities, libraries, and modules across your projects.

## Basic Import

To import from another trifle, use the special `trifling.mine` package:

```python-editor-text
# Import from a trifle
from trifling.mine.my_utils import greeting

# Use the imported function
message = greeting("World")
print(message)
```

This will:
1. Look for a trifle named "my_utils" in your collection
2. Load its `main.py` file
3. Import the `greeting` function

## Creating a Module Trifle

Let's say you create a trifle called "math_helpers" with this code in `main.py`:

```python
def double(n):
    return n * 2

def square(n):
    return n ** 2

def is_even(n):
    return n % 2 == 0

PI = 3.14159
```

Now you can import it from any other trifle:

```python-editor-text
from trifling.mine.math_helpers import double, square, is_even, PI

print(f"Double 5: {double(5)}")
print(f"Square 7: {square(7)}")
print(f"Is 8 even? {is_even(8)}")
print(f"Pi: {PI}")
```

## Import Patterns

### Import Everything

```python
from trifling.mine.my_module import *
```

### Import Specific Items

```python
from trifling.mine.my_module import func1, func2, MY_CONSTANT
```

### Import with Alias

```python
from trifling.mine.very_long_name import something as short_name
```

## Multi-File Trifles

If your trifle has multiple files, you can specify which file to import from:

```python
# Import from helpers.py instead of main.py
from trifling.mine.my_project.helpers import utility_function
```

## Example: Color Utilities

Create a trifle named "colors" with useful color functions:

```python
# In trifle "colors" - main.py

def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def rgb_to_hex(r, g, b):
    """Convert RGB to hex color"""
    return f'#{r:02x}{g:02x}{b:02x}'

def lighten(hex_color, percent):
    """Lighten a color by percentage"""
    r, g, b = hex_to_rgb(hex_color)
    r = min(255, int(r + (255 - r) * percent / 100))
    g = min(255, int(g + (255 - g) * percent / 100))
    b = min(255, int(b + (255 - b) * percent / 100))
    return rgb_to_hex(r, g, b)

# Common colors
RED = "#FF0000"
GREEN = "#00FF00"
BLUE = "#0000FF"
```

Then use it in another trifle:

```python-editor-text
from trifling.mine.colors import hex_to_rgb, lighten, RED, BLUE

print(f"Red in RGB: {hex_to_rgb(RED)}")
print(f"Blue in RGB: {hex_to_rgb(BLUE)}")
print(f"Lighter red: {lighten(RED, 30)}")
```

## Example: Drawing Helpers

Create a trifle named "draw_helpers" with canvas utilities:

```python
# In trifle "draw_helpers" - main.py

from trifling.canvas import ctx, Math

def draw_circle(x, y, radius, color):
    """Draw a filled circle"""
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, 2 * Math.PI)
    ctx.fill()

def draw_rect(x, y, width, height, color):
    """Draw a filled rectangle"""
    ctx.fillStyle = color
    ctx.fillRect(x, y, width, height)

def draw_star(cx, cy, spikes, outer_radius, inner_radius, color):
    """Draw a star shape"""
    ctx.fillStyle = color
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
    ctx.fill()

def clear():
    """Clear the canvas"""
    ctx.clearRect(0, 0, 400, 300)
```

Use it to create drawings easily:

```python-editor-graphics
from trifling.mine.draw_helpers import draw_circle, draw_star, draw_rect

# Draw a scene
draw_rect(0, 200, 400, 100, "#90EE90")  # Grass
draw_circle(320, 60, 40, "#FFD700")      # Sun
draw_star(200, 150, 5, 50, 20, "#FF6B6B") # Star
```

## Best Practices

### 1. Use Descriptive Names

Give your module trifles clear, descriptive names:
- ✅ `string_helpers`, `color_utils`, `physics_engine`
- ❌ `stuff`, `misc`, `utils123`

### 2. Document Your Functions

Add docstrings to help users understand your code:

```python
def calculate_distance(x1, y1, x2, y2):
    """
    Calculate distance between two points.

    Args:
        x1, y1: Coordinates of first point
        x2, y2: Coordinates of second point

    Returns:
        Distance as a float
    """
    return ((x2 - x1)**2 + (y2 - y1)**2)**0.5
```

### 3. Group Related Functions

Keep related functionality together in one module:

```python
# Good: math_utils.py
def add(a, b): ...
def subtract(a, b): ...
def multiply(a, b): ...

# Better organized than having separate trifles for each function
```

### 4. Version Your Modules

If you make breaking changes, consider creating a new version:
- `my_library_v1`
- `my_library_v2`

## Common Use Cases

### Game Utilities

```python
# trifle: game_utils
class Vector2:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def add(self, other):
        return Vector2(self.x + other.x, self.y + other.y)

    def magnitude(self):
        return (self.x**2 + self.y**2)**0.5

def check_collision(x1, y1, r1, x2, y2, r2):
    """Check if two circles collide"""
    dist = ((x2 - x1)**2 + (y2 - y1)**2)**0.5
    return dist < (r1 + r2)
```

### Data Processing

```python
# trifle: data_helpers
def average(numbers):
    """Calculate average of a list"""
    return sum(numbers) / len(numbers)

def find_min_max(numbers):
    """Return tuple of (min, max)"""
    return (min(numbers), max(numbers))

def normalize(numbers):
    """Normalize numbers to 0-1 range"""
    min_val, max_val = find_min_max(numbers)
    range_val = max_val - min_val
    return [(n - min_val) / range_val for n in numbers]
```

### Text Utilities

```python
# trifle: text_utils
def title_case(text):
    """Convert text to title case"""
    return ' '.join(word.capitalize() for word in text.split())

def reverse_words(text):
    """Reverse the order of words"""
    return ' '.join(reversed(text.split()))

def count_vowels(text):
    """Count vowels in text"""
    return sum(1 for char in text.lower() if char in 'aeiou')
```

## Error Handling

If a trifle can't be found, you'll get an import error:

```python
try:
    from trifling.mine.nonexistent import func
except ImportError as e:
    print(f"Could not import: {e}")
    print("Make sure the trifle exists in your collection")
```

## Next Steps

- Create your own utility trifles
- Build a library of reusable functions
- Share trifles with others using the export feature
- Combine imports with [Turtle Graphics](/static/docs/turtle.html) and [Canvas API](/static/docs/canvas.html)

Happy coding!
