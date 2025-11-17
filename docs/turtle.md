---
title: Turtle Graphics
description: Create beautiful drawings with turtle graphics
category: Graphics
order: 2
---

# Turtle Graphics

Turtle graphics is a fun way to create drawings using Python. Imagine a turtle with a pen that moves around the canvas, drawing as it goes!

## Basic Movement

The turtle starts at the center (0, 0) facing right:

```python-editor-graphics
import turtle

# Move forward
turtle.forward(100)

# Turn and move again
turtle.left(90)
turtle.forward(100)
```

## Drawing a Square

Let's draw a complete square:

```python-editor-graphics
import turtle

for i in range(4):
    turtle.forward(100)
    turtle.right(90)
```

## Colors and Pen

Make your drawings colorful:

```python-editor-graphics
import turtle

turtle.pencolor("red")
turtle.pensize(3)
turtle.forward(100)

turtle.pencolor("blue")
turtle.left(90)
turtle.forward(100)

turtle.pencolor("green")
turtle.left(90)
turtle.forward(100)
```

## Filled Shapes

Fill shapes with color:

```python-editor-graphics
import turtle

turtle.fillcolor("yellow")
turtle.begin_fill()

for i in range(4):
    turtle.forward(100)
    turtle.right(90)

turtle.end_fill()
```

## Drawing Circles

Circles are easy with turtle:

```python-editor-graphics
import turtle

# Draw a circle
turtle.circle(50)

# Move and draw another
turtle.penup()
turtle.goto(0, -100)
turtle.pendown()

turtle.fillcolor("lightblue")
turtle.begin_fill()
turtle.circle(50)
turtle.end_fill()
```

## Spirals

Create mesmerizing spirals:

```python-editor-graphics
import turtle

turtle.speed(0)  # Fastest speed
turtle.bgcolor("black")
turtle.pencolor("cyan")

for i in range(100):
    turtle.forward(i * 2)
    turtle.right(91)
```

## Rainbow Star

Combine colors and shapes:

```python-editor-graphics
import turtle

turtle.speed(0)
turtle.bgcolor("black")

colors = ["red", "orange", "yellow", "green", "blue", "purple"]

for i in range(36):
    turtle.pencolor(colors[i % len(colors)])
    turtle.forward(100)
    turtle.right(170)
```

## Flower Pattern

Create a beautiful flower:

```python-editor-graphics
import turtle

turtle.speed(0)
turtle.bgcolor("lightgreen")
turtle.pencolor("purple")
turtle.fillcolor("pink")

for i in range(12):
    turtle.begin_fill()
    turtle.circle(50)
    turtle.end_fill()
    turtle.right(30)
```

## Useful Commands

Here are common turtle commands:

- `forward(distance)` - Move forward
- `backward(distance)` - Move backward
- `right(angle)` - Turn right (degrees)
- `left(angle)` - Turn left (degrees)
- `goto(x, y)` - Move to position
- `setheading(angle)` - Set direction
- `penup()` - Stop drawing
- `pendown()` - Start drawing
- `pencolor(color)` - Set pen color
- `fillcolor(color)` - Set fill color
- `pensize(width)` - Set pen width
- `circle(radius)` - Draw a circle
- `speed(value)` - Set speed (0-10, 0 is fastest)
- `bgcolor(color)` - Set background color
- `clear()` - Clear the drawing
- `reset()` - Clear and reset position

## Try Your Own!

Create your own design. Here's a starter:

```python-editor-graphics
import turtle

turtle.speed(0)

# Your creative code here!
for i in range(8):
    turtle.circle(50)
    turtle.right(45)
```

## Next Steps

- Experiment with different shapes and colors
- Try combining multiple patterns
- Create animations by clearing and redrawing
- Check out the [Canvas API](/static/docs/canvas.html) for more drawing options
