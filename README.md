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
