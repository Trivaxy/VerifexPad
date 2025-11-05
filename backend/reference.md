# Welcome to Verifex

Verifex is a programming language and research project designed to give you confidence in your code. This is part of a graduation project, and as such, Verifex at the moment is only an MVP of a language that can be taken much farther.

If you're interested in trying it out, head over to https://try.verifex.xyz/

## Variables and Types

In Verifex, variables are immutable (unchangeable) by default. Types are optional and are inferred.

```rust
// Immutable variables with 'let'
let name: String = "Alex";
let age = 28;  // Type is inferred as Int

// Mutable variables with 'mut'
mut counter = 0;
mut balance: Real = 100.50;
```

There are a few primitive types: `Int`, `Real`, `Bool`, `String`.
You can expect the same binary operators `+, -, &&, etc` and so on to be present and in the precedence you expect.

`Int` and `Real` do not automatically convert to one another. Use `as_real(x)` and `as_int(x)` if needed.

## Functions

They're simple to define, with clear parameter types and return types:

```rust
fn add(a: Int, b: Int) -> Int {
    return a + b;
}

fn greet(name: String) {
    print("Hello, " + name + "!"); // Implicit string conversion
}

fn main() {
    greet("World");
}
```

`main()` is the entrypoint of any Verifex program. Parameters are always immutable.
`print` is a built-in function that accepts any value and sends it to stdout.

## Refined Types

One of Verifex's most powerful features is **refined types** - these let you specify constraints on values at compile time.

```rust
// This function has a problem - what if b is zero?
fn divide_bad(a: Real, b: Real) -> Real {
    return a / b; // The compiler will warn about this!
}

type NonZeroReal = Real where value != 0; // value is a special placeholder of type 'Real'

fn divide_ok(a: Real, b: NonZeroReal) -> Real {
    return a / b;
}

fn main() {
    let x = 0;
    divide_bad(10, x);
    divide_ok(10, x); // The compiler will throw an error here

    if (x != 0) {
        divide_ok(10, x); // no issue here
    }
}
```

The condition in a refined type must be guaranteed to be met at all points in a program where the refined type is used.

Experiment with the condition in the `if` to see what works and what doesn't. The compiler's analysis is more sophisticated than just checking if the condition in it exactly matches what's in `NonZeroReal`.

The condition has access to nothing except `value`.

Some more examples:

```rust
type PositiveInt = Int where value > 0;
type ValidAge = Int where value >= 0 && value < 150;
type Origin = Point where value.x == 0 && value.y == 0;
```

Try it out yourself.

## Maybe Types

Verifex gives you *union types* (a type that can be any of several) under the name 'Maybe Type'.

```rust
// This function might not find a user
fn find_user(id: Int) -> User or NotFound {
    // Implementation details...
    if (userExists) 
        return user;
    else
        return NotFound { message: "User not found" };
}

fn greet_user(id: Int) {
    let result = find_user(id);
    
    if (result is User) {
        print("Hello, " + result.name + "!");
        return;
    }

    print("Error: " + result.message);
}
```

The `is` operator lets you test which type a maybe type takes. The compiler automatically "morphs" the maybe-type throughout the program as needed. Within the `if` statement above, it knows `result` is a `User`, so it allows you to treat it like one. It also knows that after the block it must be `NotFound`.

## Data Organization: Structs

Verifex uses structs to group related data:

```rust
struct Point {
    x: Real,
    y: Real,
    
    // Methods can be added to structs
    fn distance_from_origin() -> Real {
        return sqrt(x*x + y*y);
    }
    
    // Static method (like a constructor)
    fn! origin() -> Point {
        return Point { x: 0, y: 0 };
    }
}

// Create and use a struct
let home = Point { x: 5, y: 12 };
let distance = home.distance_from_origin();  // 13
```

## Composition

Verifex uses composition rather than inheritance to build complex types:

```rust
struct Animal {
    name: String,
    age: NonNegativeInt,
    
    fn make_sound() {
        print("Generic animal sound");
    }
}

struct Bird {
    ..Animal,  // Embed all fields and methods from Animal
    wingspan: PositiveReal,
    
    // Override the sound method
    fn make_sound() {
        print("Chirp");
    }
    
    fn fly() {
        print(name + " is flying with " + wingspan + "cm wings!");
    }
}
```

When you embed a struct into another one, all of its fields and methods (except static ones) get embedded.

## Archetypes: Defining Capabilities

(Not implemented yet)

Archetypes in Verifex are similar to interfaces in other languages - they define what methods *and fields* a type should have:

```rust
archetype Drawable {
    fn draw() -> String,
}

struct Circle {
    radius: PositiveReal,
    
    fn draw() -> String {
        return "○";
    }
}

// Any struct with a draw method can be used where Drawable is expected
fn render(item: Drawable) {
    print(item.draw());
}

fn main() {
    render(Circle { radius: 5 });  // ○
}
```

## Loops and Collections

Verifex supports arrays and while loops.

The `#` operator works with strings and arrays, and returns their length


```rust
// Arrays
let numbers = [1, 2, 3, 4, 5];
let names: String[] = ["Alice", "Bob", "Charlie"];

// Accessing elements
let first = numbers[0];  // 1

// Iterating
mut i = 0;
while (i < #names) {
    print(names[i]);
    i = i + 1;
}
```