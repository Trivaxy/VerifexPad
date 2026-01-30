const examples = [
  {
    name: "Hello World",
    code: `fn main() {
  print("Hello, Verifex!");
}`
  },
  {
    name: "Variable Declaration",
    code: `fn main() {
  // Immutable variables
  let name: String = "John";
  let male = true;
  
  // Mutable variables
  mut age = 21;
  mut gpa: Real = 88.0;
  
  print("Name: " + name);
  print("Age: " + age);
}`
  },
  {
    name: "Loop Example",
    code: `fn main() {
    mut i = 0;
    while (i < 10) {
        mut r = 0;
        mut s = "";
        while (r < i) {
            s = s + "*";
            r = r + 1;
        }
        print(s);
        i = i + 1;
    }
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
  
  // ! Try uncommenting this line !
  // divide(4.0, 0.0);
  
  // But this is safe
  if (numFromUser == 0.0) {
    print("Cannot divide by zero!");
  } else {
    // Within this block, numFromUser is known to be non-zero
    let result = divide(4.0, numFromUser);
    print("Result: " + result);
  }
}`
  },
  {
    name: "Bank Account Example",
    code: `type NonNegativeReal = Real where value >= 0.0;
type PositiveReal = Real where value > 0.0;

struct Account {
    balance: NonNegativeReal,

    fn! new(initial_deposit: NonNegativeReal) -> Account {
    	return Account { balance: initial_deposit };
    }

    fn deposit(amount: PositiveReal) {
        balance = balance + amount;
    }

    fn withdraw(amount: PositiveReal) -> Bool {
        if (balance >= amount) { // try removing this if statement!
            balance = balance - amount; // Still NonNegativeReal
            return true;
        }
        return false;
    }
}

fn main() {
    mut acc = Account.new(100.0);

    acc.deposit(50.0);
    print("Balance: " + acc.balance);

    let success = acc.withdraw(70.0);
    print("Withdraw 70 success: " + success + ", New Balance: " + acc.balance);

    let success2 = acc.withdraw(100.0);
    print("Withdraw 100 success: " + success2 + ", New Balance: " + acc.balance);
}`
  },
  {
    name: "Counter Example",
    code: `type NonNegativeInt = Int where value >= 0;

struct Counter {
    count: NonNegativeInt,

    fn! new() -> Counter {
        return Counter { count: 0 };
    }

    fn increment() {
        count = count + 1;
    }

    fn decrement() {
        if (count > 0) {
            count = count - 1;
        }
    }
}

fn main() {
    mut c = Counter.new();
    print(c.count);

    c.increment();
    print(c.count);
    
    c.decrement();
    print(c.count);
}`
  },
];

export default examples;