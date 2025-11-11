Verifex is a small language with a big goal: make correctness practical. It pairs a friendly, familiar syntax with a solver‑backed verifier that proves useful properties of your code before it runs.

Use this guide to get productive quickly, then lean into what makes Verifex special: refined types, maybe (union) types with flow narrowing, composition, and archetypes.

## The Basics

- Variables are immutable by default. Use `mut` when you need mutation.
- Types are optional and inferred. Add annotations when you want clarity or guarantees.
- There's only a few primitive types: `Int`, `Real`, `Bool`, `String`.
- Operators: arithmetic `+ - * /`, comparisons, boolean `&& || !`. These are all evaluated in the order you expect them to. `+` concatenates strings (non‑strings are converted).

```rust
// Values and mutability
let name: String = "Alex";
let age = 28;           // inferred Int
mut counter = 0;        // mutable variable
mut balance: Real = 100.5;

// Functions
fn add(a: Int, b: Int) -> Int {
    return a + b;
}

fn greet(name: String) {
    print("Hello, " + name + "!");
}

fn main() {
    greet("World");
}
```

Keep in mind that:
- Parameters are always immutable.
- There’s no implicit `Int`↔`Real` conversion. Use `as_real(x)` or `as_int(x)`.
- End statements with `;` (blocks after `if/while` don’t need a trailing `;`).

## Structs, Methods, and Static Functions

Use structs to group data and define methods. Instance methods access fields directly. Static methods use `fn!` and don’t need an instance.

```rust
struct Point {
    x: Real,
    y: Real,

    fn distance() -> Real {
        return sqrt(x*x + y*y);
    }

    fn! origin() -> Point {
        return Point { x: 0, y: 0 };
    }
}

let home = Point { x: 3, y: 4 };
let home_dist = home.distance();
let zero = Point.origin();
```

## Arrays and Strings

- Array literals: `[1, 2, 3]`
- Array types: `T[]` (e.g. `String[]`)
- Length: `#arr` or `#str`
- Indexing: `arr[i]` (index must be `Int`)

```rust
let names: String[] = ["Alice", "Bob"];
mut i = 0;
while (i < #names) {
    print(names[i]);
    i = i + 1;
}
```

---

## Refined Types: State What Must Be True (and Let the Compiler Prove It)

Refined types take a base type and constrain it with a boolean expression over a special placeholder `value` (and its fields). Verifex uses a solver to prove that your program only uses values that satisfy the constraint on every execution path.

To be specific, the compiler knows what must be true or false in every path. Take a look at this example:

```rust
type NonZeroReal = Real where value != 0;

fn divide(a: Real, b: NonZeroReal) -> Real {
    return a / b;
}

fn main() {
    let x: Real = 0;
    // divide(10, x);     // error: x isn’t guaranteed to be NonZeroReal
    if (x != 0) {
        divide(10, x);    // ok: in this branch, x is proven non‑zero
    } else {
        // in this branch, x is proven to be zero
    }
    // back out here, x is not proven to be either zero or non-zero
}
```

Return statements also affect what the compiler knows about execution paths.
```rust
if (x < 5) {
    return;
}

// x is proven to be >= 5 at this point
```

Here's some more examples of refined types you can define:
```rust
type PositiveInt = Int where value > 0;
type ValidAge = Int where value >= 0 && value < 130;
type Origin = Point where value.x == 0 && value.y == 0;
```

Essentially, assigning to a refined type requires proving the value is valid in that path. This moves entire classes of runtime bugs to compile-time, before they ever hit production.

## Maybe Types (Union Types)

You can represent a value that may be one of several types using `T1 or T2 or ...`. You can also test which type the value is with the `is` operator, and the compiler narrows the type within branches and logically after them.

```rust
fn find_user(id: Int) -> User or NotFound {
    // pretend we query a DB
    if (id > 0) {
        return User { name: "A", age: 30 };
    }
    else {
        return NotFound { message: "No user" };
    }
}

fn greet_user(id: Int) {
    let result = find_user(id);
    if (result is User) {
        print("Hello, " + result.name); // result is proven to be a User
        return;
    }
    print("Error: " + result.message);  // result is definitely a NotFound error
}
```

## Composition Over Inheritance

Embed a struct into another with `..OtherStruct`. Fields and instance methods from the embedded struct are included. This favors “has‑a” composition over “is‑a” inheritance.

```rust
struct ContactInfo { email: String }

struct Person {
    name: String,
    ..ContactInfo,
}

let p = Person { name: "Nora", email: "n@n" };
print(p.email); // from ContactInfo
```

If you embed multiple structs that define the same member, you’ll get a duplicate‑member error.

Static methods remain tied to their defining struct and aren’t embedded as instance methods.

## Archetypes: Structural Capabilities

Archetypes specify required methods and fields. Any struct that has them *implements* the archetype automatically. No explicit declaration needed, unlike most other languages.

```rust
archetype Shape {
    sides: Int,
    fn perimeter() -> Real,
}

struct Polygon {
    sides: Int,

    fn perimeter() -> Real {
        return ...;
    }
}

fn print_shape(s: Shape) {
    print("sides=" + s.sides);
    print("perimeter=" + s.perimeter());
}

print_shape(Polygon { sides: 3 }); // ok: Polygon structurally matches Shape
```

Structs themselves can act like archetypes for composed types; embedding often makes a struct satisfy another’s shape.

## Putting It Together

```rust
type NonEmpty = String where #value > 0;

struct User {
    name: NonEmpty,
    age: Int,
}

archetype Greeter {
    fn greet() -> String,
}

struct FriendlyUser {
    ..User,
    fn greet() -> String { return "Hello, " + name; }
}

fn find_user(id: Int) -> FriendlyUser or NotFound {
    if (id > 0) return FriendlyUser { name: "Alex", age: 28 };
    else return NotFound { message: "Missing" };
}

fn show(id: Int) {
    let r = find_user(id);
    if (r is FriendlyUser) {
        print(r.greet());   // narrowed to FriendlyUser (also satisfies Greeter)
    } else {
        print("Error: " + r.message);
    }
}
```

Enjoy tinkering.