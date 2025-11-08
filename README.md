# PerimeterX Deobfuscator

A powerful JavaScript/TypeScript deobfuscator specifically designed to handle PerimeterX obfuscated code. This tool uses advanced AST manipulation and VM execution to reverse various obfuscation techniques.

## 🎯 Features

- **Object Construction Pattern Detection**: Identifies and simplifies complex chained object construction patterns
- **String Decryption**: Decrypts encrypted string literals and function calls
- **Control Flow Simplification**: Flattens and simplifies obfuscated control flow structures
- **VM-based Evaluation**: Safely executes obfuscated code in isolated VM environment to extract runtime values
- **AST Transformation**: Uses Babel to parse, transform, and regenerate clean JavaScript code

## 🔧 Technical Details

This deobfuscator employs several techniques:

- **Pattern Matching**: Detects common obfuscation patterns used by PerimeterX
- **Safe Evaluation**: Uses VM2 for sandboxed code execution
- **Multi-pass Transformation**: Applies transformations iteratively for complex obfuscation layers

## 📖 How It Works: Array Shuffling Example

One of the primary obfuscation techniques this tool handles is **array shuffling** from obfuscator.io. Here's a detailed example of how it works:

### The Problem

When you encounter a call like `e(184)` in obfuscated code, it appears simple, but it's actually a multi-layer indirection:

```javascript
// The call
e(184)

// Local scope declaration
var e = gy;

// Which points to
var gy = yy;

// Which is the actual lookup function
function yy(t, e) {
  var n = Py();
  return (yy = function (t, e) {
    return n[t -= 150];
  })(t, e);
}

// Py() returns the original (unshuffled) array
function Py() {
  var t = ["uid", "type", "val", "3CzyXZh", "_pxRootUrl", "xhrResponse",
           "status", "documentMode", "getTime", "random", "FCguKlJNKhA=",
           "one", "_pxmvid", "OS0Db39ECFg=", "now", "4205084dpkMGH",
           "removeItem", "UBRqVhZ6ZWQ=", "ttl", "length", "3424pAXPiP",
           "trigger", "bind", "6231840wNqUVg", "toUTCString", "DFA2Eko4MiA=",
           "_asyncInit", "EmooaFcHLF8=", "reload", "_pxVid", "vid",
           "485618KYvBUj", "xhrSuccess", "xhrFailure", "1112013mkEmvF",
           "captcha", "subscribe", "_px_acp", "12474846CMUYjE", "pxInit",
           "RBh+WgJye2o=", "platform", "getItem", "18466gQfCqA", "pxvid",
           "247510trbTTH", "cookie"];
  return (Py = function () {
    return t;
  })();
}
```

### The Array Shuffling IIFE

Before any lookups work correctly, an IIFE (Immediately Invoked Function Expression) shuffles the array:

```javascript
(function (t, e) {
  var n = 180, r = 161, a = 164, o = 192, i = 175, c = 153, u = 173, s = 150, l = 168;
  var f = yy;
  var h = t();
  while (true) {
    try {
      if (parseInt(f(n)) / 1 * (parseInt(f(r)) / 2) + parseInt(f(a)) / 3 +
          parseInt(f(o)) / 4 + -parseInt(f(i)) / 5 + parseInt(f(c)) / 6 +
          -parseInt(f(u)) / 7 * (parseInt(f(s)) / 8) + -parseInt(f(l)) / 9 === 624349) {
        break;
      }
      h.push(h.shift());
    } catch (t) {
      h.push(h.shift());
    }
  }
})(Py);
```

This IIFE repeatedly shifts array elements until a specific mathematical condition is met (`=== 624349`).

### Before vs After Shuffling

**Before Shuffling (calling `yy(184)` would return):**
```
Index 184-150 = 34 → '1112013mkEmvF' ❌ WRONG
```

**After Shuffling (the array is reordered):**
```javascript
["3424pAXPiP", "trigger", "bind", "6231840wNqUVg", "toUTCString",
 "DFA2Eko4MiA=", "_asyncInit", "EmooaFcHLF8=", "reload", "_pxVid",
 "vid", "485618KYvBUj", "xhrSuccess", "xhrFailure", "1112013mkEmvF",
 "captcha", "subscribe", "_px_acp", "12474846CMUYjE", "pxInit",
 "RBh+WgJye2o=", "platform", "getItem", "18466gQfCqA", "pxvid",
 "247510trbTTH", "cookie", "uid", "type", "val", "3CzyXZh",
 "_pxRootUrl", "xhrResponse", "status", "documentMode", "getTime",
 "random", "FCguKlJNKhA=", "one", "_pxmvid", "OS0Db39ECFg=", "now",
 "4205084dpkMGH", "removeItem", "UBRqVhZ6ZWQ=", "ttl", "length"]
```

Now calling `yy(184)`:
```
Index 184-150 = 34 → "documentMode" ✅ CORRECT
```

### What This Deobfuscator Does

This tool automatically:
1. **Detects** the array shuffling IIFE pattern
2. **Executes** the shuffling logic in a safe VM environment
3. **Extracts** the correctly ordered array
4. **Replaces** all lookup calls (like `e(184)`) with their actual string values (`"documentMode"`)

The result is clean, readable code with all string lookups resolved to their actual values.

## 📦 Installation

```bash

# Install dependencies using pnpm (recommended)
pnpm install

# Or using npm
npm install
```

## 🚀 Usage

```bash
# Build the TypeScript code
tsc

# Run the main deobfuscator
npm start

# Run the magic key extractor
npm run magic
```

## 🛠️ Technologies Used

- **TypeScript**: For type-safe code
- **Babel**: For AST parsing and code generation
  - @babel/parser
  - @babel/traverse
  - @babel/generator
  - @babel/types
- **VM2**: For safe sandboxed code execution
- **Axios**: For HTTP requests (if needed for remote analysis)

## ⚠️ Disclaimer

This tool is provided for **educational and research purposes only**. It is designed to help understand obfuscation techniques and improve code analysis skills. 

- Use responsibly and only on code you have permission to analyze
- Respect intellectual property and license agreements
- The author is not responsible for any misuse of this tool

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built to demonstrate deobfuscation techniques
- Inspired by the need to understand and analyze obfuscated JavaScript code
- Thanks to the open-source community for the amazing tools (Babel, VM2, etc.)

## 📞 Contact

For questions or suggestions, please open an issue on GitHub.

---

**Note**: This is a showcase project demonstrating advanced JavaScript deobfuscation techniques. The code is provided as-is for educational purposes.
