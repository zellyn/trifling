---
title: Introduction to Python
description: Learn Python basics with interactive examples
category: Getting Started
order: 1
---

# Introduction to Python

Welcome to Trifling! This interactive tutorial will teach you Python programming right in your browser. No installation required.

## Your First Program

Let's start with the classic "Hello, World!" program:

```python-editor-text
print("Hello, World!")
```

Click the **Run** button to execute the code. You can edit the code and run it again!

## Variables and Data Types

Python makes it easy to work with different types of data:

```python-editor-text
# Numbers
age = 25
price = 19.99

# Strings
name = "Alice"
message = 'Hello, Python!'

# Booleans
is_student = True
has_license = False

print(f"{name} is {age} years old")
print(f"Student status: {is_student}")
```

## Loops

Loops let you repeat actions:

```python-editor-text
# For loop
for i in range(5):
    print(f"Count: {i}")

print()  # Empty line

# While loop
count = 0
while count < 3:
    print(f"While loop: {count}")
    count += 1
```

## Lists

Lists store multiple values:

```python-editor-text
# Create a list
fruits = ["apple", "banana", "cherry"]

# Access items
print(f"First fruit: {fruits[0]}")

# Add items
fruits.append("orange")

# Loop through list
print("\nAll fruits:")
for fruit in fruits:
    print(f"  - {fruit}")
```

## Functions

Functions help you organize code:

```python-editor-text
def greet(name):
    return f"Hello, {name}!"

def add(a, b):
    return a + b

# Call functions
print(greet("World"))
print(f"5 + 3 = {add(5, 3)}")
```

## Conditionals

Make decisions in your code:

```python-editor-text
def check_age(age):
    if age < 13:
        return "You're a child"
    elif age < 20:
        return "You're a teenager"
    else:
        return "You're an adult"

print(check_age(10))
print(check_age(16))
print(check_age(25))
```

## Interactive Input

Try using `input()` to get user input:

```python-editor-text
name = input("What's your name? ")
print(f"Nice to meet you, {name}!")

age = input("How old are you? ")
print(f"Wow, {age} years old!")
```

## Try It Yourself

Create a simple program that asks for a number and prints its square:

```python-editor-text
# Your code here
number = input("Enter a number: ")
square = int(number) ** 2
print(f"The square of {number} is {square}")
```

## Next Steps

Now that you know the basics, try these tutorials:

- [Turtle Graphics](/static/docs/turtle.html) - Create drawings and animations
- [Canvas API](/static/docs/canvas.html) - Draw shapes and images directly
- [Trifle Imports](/static/docs/imports.html) - Share code between projects

Remember: You can turn any example into a trifle by clicking **Make Trifle**!
