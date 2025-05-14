const examples = [
  {
    name: "Hello World",
    code: `fn main() {
  io.print("Hello, Verifex!");
}`
  },
  {
    name: "Variable Declaration",
    code: `fn main() {
  // Immutable variables
  let name: String = "Omar";
  let male = true;
  
  // Mutable variables
  mut age = 21;
  mut gpa: Real = 88.0;
  
  io.print("Name: " + name);
  io.print("Age: " + age);
}`
  },
  {
    name: "Refined Types Example",
    code: `// Define a refined type for non-zero real numbers
type NonZeroReal = Real where value != 0.0;

// This function is now safe at compile time
fn divide(a: Real, b: NonZeroReal) -> Real {
  return a / b;
}

fn main() {
  let numFromUser: Real = 5.0;
  
  // This would cause a compile error
  // divide(4, 0);
  
  // But this is safe
  if (numFromUser == 0) {
    io.print("Cannot divide by zero!");
  } else {
    // Within this block, numFromUser is known to be non-zero
    let result = divide(4, numFromUser);
    io.print("Result: " + result);
  }
}`
  },
  {
    name: "Maybe Types",
    code: `type IPv4Addr = String where value matches "^((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}$";

fn connect(ip: IPv4Addr) -> Connection or ConnectionError {
  // Implementation would go here
  if (ip == "127.0.0.1") {
    return Connection { status: "connected" };
  } else {
    return ConnectionError { message: "Failed to connect" };
  }
}

fn main() {
  let connection = connect("127.0.0.1");
  
  // Must handle both possible outcomes
  check connection {
    Connection -> io.print("Connected successfully!"),
    ConnectionError -> io.print("Couldn't connect")
  }
}`
  },
  {
    name: "Structs and Methods",
    code: `struct Vehicle {
  fuel: NonNegativeReal,
  distance: NonNegativeReal,

  // Static function acting as a constructor
  fn! new() -> Vehicle {
    return Vehicle { fuel: 0, distance: 0 };
  }
  
  // Instance methods
  fn refuel(amount: NonNegativeReal) {
    fuel += amount;
  }
  
  fn drive(km: NonZeroReal) {
    let fuelUsed = km * 0.5;
    if (fuelUsed > fuel) {
      distance += fuel * 2;
      fuel = 0;
    }
    else {
      distance += km;
      fuel -= fuelUsed;
    }
  }
}  

fn main() {
  let vehicle = Vehicle.new();
  io.print("Initial fuel: " + vehicle.fuel);
  
  vehicle.refuel(10);
  io.print("After refueling: " + vehicle.fuel);
  
  vehicle.drive(5);
  io.print("Distance traveled: " + vehicle.distance);
  io.print("Remaining fuel: " + vehicle.fuel);
}`
  },
  {
    name: "Composition Example",
    code: `struct Animal {
  name: String,
  age: NonNegativeInt,

  fn greet() {
    io.print("I'm a " + name);
  }
}

struct Flier {
  wingspan: PositiveReal,

  fn fly() {
    io.print("Flying!");
  }
}

struct Bird {
  ..Animal,
  ..Flier
}

fn main() {
  let bird = Bird {
    name: "Bird",
    age: 2,
    wingspan: 3.5
  };

  bird.greet(); // I'm a bird
  bird.fly();   // Flying!
  
  io.print("Wingspan: " + bird.wingspan);
}`
  }
];

export default examples;