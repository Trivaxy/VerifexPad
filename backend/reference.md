# Welcome to Verifex

Verifex is a programming language that makes your compiler work for you, preventing bugs before they happen and giving you confidence in your code. This guide will walk you through the key features of Verifex with examples you can try in VerifexPad.

## Variables and Types

In Verifex, variables are immutable (unchangeable) by default, making your code safer and easier to understand.

```rust
// Immutable variables with 'let'
let name: String = "Alex";
let age = 28;  // Type is inferred as Int

// Mutable variables with 'mut'
mut counter = 0;
mut balance: Real = 100.50;
```

### Try it yourself:
- Create immutable and mutable variables
- Try changing an immutable variable - the compiler will stop you!

## Functions

Functions in Verifex are simple to define, with clear parameter types and return types:

```rust
fn add(a: Int, b: Int) -> Int {
    return a + b;
}

fn greet(name: String) {
    io.print("Hello, " + name + "!");
}
```

### Try it yourself:
- Create a function that multiplies two numbers
- Call it with different values

## Making Your Code Safer: Refined Types

One of Verifex's most powerful features is **refined types** - these let you specify constraints on values at compile time. Let's see a classic example:

```rust
// This function has a problem - what if b is zero?
fn divide(a: Real, b: Real) -> Real {
    return a / b;  // The compiler will warn about this!
}
```

Here's how to fix it with refined types:

```rust
// Create a type that can never be zero
type NonZeroReal = Real where value != 0.0;

// Now our function is safe!
fn divide(a: Real, b: NonZeroReal) -> Real {
    return a / b;  // This is now safe
}
```

When someone calls your function, the compiler ensures they can only pass non-zero values.

### More refined type examples:

```rust
type PositiveInt = Int where value > 0;
type ValidAge = Int where value >= 0 && value < 150;
type EmailAddress = String where value.contains("@");
```

### Try it yourself:
- Create a refined type for a percentage (0-100)
- Write a function that uses your refined type
- Observe how the compiler prevents invalid values

## No More Nulls: Maybe Types

Instead of null references that cause crashes, Verifex uses **maybe types** to explicitly handle cases where a value might not exist:

```rust
// This function might not find a user
fn find_user(id: Int) -> User or NotFound {
    // Implementation details...
    if (userExists) 
        return user;
    else
        return NotFound { message: "User not found" };
}

// You must handle both possibilities
fn greet_user(id: Int) {
    let result = find_user(id);
    
    check result {
        User -> io.print("Hello, " + result.name + "!"),
        NotFound -> io.print("User not found")
    }
}
```

### Try it yourself:
- Create a function that might fail
- Use the `check` statement to handle both outcomes

## Data Organization: Structs

Verifex uses structs to group related data:

```rust
struct Point {
    x: Real,
    y: Real,
    
    // Methods can be added to structs
    fn distance_from_origin() -> Real {
        return Math.sqrt(x*x + y*y);
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

### Try it yourself:
- Create a struct for a rectangle with width and height
- Add a method to calculate its area
- Create instances and call the method

## Composition: Building Complex Types

Verifex uses composition rather than inheritance to build complex types:

```rust
struct Animal {
    name: String,
    age: NonNegativeInt,
    
    fn make_sound() {
        io.print("Generic animal sound");
    }
}

struct Bird {
    ..Animal,  // Embed all fields and methods from Animal
    wingspan: PositiveReal,
    
    // Override the sound method
    fn make_sound() {
        io.print("Tweet tweet");
    }
    
    fn fly() {
        io.print(name + " is flying with " + wingspan + " wings!");
    }
}
```

### Try it yourself:
- Create a base struct
- Create another struct that embeds it
- Add methods to both and see how they interact

## Archetypes: Defining Capabilities

Archetypes in Verifex are similar to interfaces in other languages - they define what methods and fields a struct should have:

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
    io.print(item.draw());
}

render(Circle { radius: 5 });  // ○
```

### Try it yourself:
- Create an archetype for shapes
- Implement it with different structs
- Write a function that works with any shape

## Collections

Verifex supports arrays and other collections:

```rust
// Arrays
let numbers = [1, 2, 3, 4, 5];
let names: String[] = ["Alice", "Bob", "Charlie"];

// Accessing elements
let first = numbers[0];  // 1

// Iterating
for (let i = 0; i < names.length; i++) {
    io.print(names[i]);
}

// Or more concisely
for (String name in names) {
    io.print(name);
}
```

### Try it yourself:
- Create an array of numbers
- Calculate the sum using a loop
- Find the maximum value in the array

## Putting It All Together

Let's see a more complete example combining these features:

```rust
// Define refined types for our constraints
type PositiveInt = Int where value > 0;
type NonEmptyString = String where value.length > 0;

// Define a data structure
struct Product {
    id: PositiveInt,
    name: NonEmptyString,
    price: PositiveInt,
    
    fn display() {
        io.print(id + ": " + name + " - $" + (price / 100));
    }
}

// A function that might fail
fn find_product(id: PositiveInt) -> Product or NotFound {
    // Implementation details...
    if (productExists) 
        return product;
    else
        return NotFound { message: "Product not found" };
}

// Main function using these concepts
fn main() {
    let products = [
        Product { id: 1, name: "Phone", price: 79900 },
        Product { id: 2, name: "Laptop", price: 129900 },
        Product { id: 3, name: "Headphones", price: 14900 }
    ];
    
    for (Product product in products) {
        product.display();
    }
    
    let result = find_product(4);
    check result {
        Product -> result.display(),
        NotFound -> io.print("Sorry, product not found")
    }
}
```

## Next Steps

- Try the examples provided in VerifexPad
- Modify them to experiment with different features
- Create your own programs combining multiple Verifex concepts
- Check out the full [Verifex documentation](https://github.com/yourusername/verifex) for more details

Happy coding with Verifex!