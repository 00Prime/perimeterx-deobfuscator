import * as parser from "@babel/parser";
import traverse_, { NodePath } from "@babel/traverse";
import generate_ from "@babel/generator";
import * as types from "@babel/types";

// Handle default exports properly for Babel modules
const traverse = (traverse_ as any).default || traverse_;
const generate = (generate_ as any).default || generate_;
import { writeFileSync, readFileSync } from "fs";
import { VM } from "vm2";
import { CodeSaver } from "./code-saver.js";
const data = readFileSync("./deob.js", "utf8");

const codeSaver = new CodeSaver({
    enabled: false,
    outputDir: './saved-eval-code',
    fileNamePattern: 'eval-{timestamp}-{index}.js',
    appendToFile: false,
    includeMetadata: true
});
// VMWrapper available if needed for future use
// const vmWrapper = new VMWrapper(vm, codeSaver);
const ast = parser.parse(data);
console.log('wassssgoooood g');
traverse(ast, {
    CallExpression(path: NodePath<types.CallExpression>) {
        const { callee, arguments: args } = path.node;
        const arg = args[0];

        
        if (types.isStringLiteral(arg) && types.isIdentifier(callee)) {
      
            const scope = path.scope.getBinding(callee.name);
            try {
                if (!scope || !scope.path) return;
                const functionNode = scope.path.node;
                if (!types.isFunctionDeclaration(functionNode) && !types.isFunctionExpression(functionNode)) return;
                const body = functionNode.body.body[0];
                if (types.isIfStatement(body)) {
                    if (isBase64(arg.value)) {
                        const decoded = atob(arg.value);
                        path.replaceWith(types.stringLiteral(decoded));
                    }
                }
                if (types.isReturnStatement(body)) {
                    const gotargs = body.argument;
                    if (types.isCallExpression(gotargs) && 
                        gotargs.arguments.length === 2 && 
                        types.isRegExpLiteral(gotargs.arguments[0]) && 
                        types.isFunctionExpression(gotargs.arguments[1])) {
                        const value = arg.value;
                        const decoded = decrypt(value);
                        path.replaceWith(types.stringLiteral(decoded));
                    }
                }


                // if the scope is 

                try {
                    
                    //@ts-ignore
                if(types.isForStatement(scope.path.node.body.body[0])) { 
                    //@ts-ignore
                    const forBody = scope.path.node.body.body[0].body.body[0];
                    //@ts-ignore
                    if(scope.path.node.body.body[0].body.body[0].expression.operator == "+=") { 
                        //LOCKED IN MF ITS THE GOFFSDMASL:KDMALS:D

                        
                        const result = decodeXor(arg.value);
                        path.replaceWith(types.stringLiteral(result));



                    }
                }
                } catch (e ) { 
            }
                if (!types.isIfStatement(body)) {
                    return;
                }
                if (!types.isBlockStatement(body.alternate)) {
                    return;
                }
                const alternateBody = body.alternate.body[0];
                if (!types.isReturnStatement(alternateBody)) {
                    return;
                }
                const consequent = body.consequent;
                const test = body.test;
                if (!types.isBlockStatement(consequent)) {
                    return;
                }
                const consequentBody = consequent.body[0];
                if (!types.isReturnStatement(consequentBody)) {
                    return;
                }
                const consequentReturn = consequentBody.argument;
                if (!types.isCallExpression(consequentReturn)) {
                    return;
                }


                if(!types.isBinaryExpression(body.test)) {
                    return;
                }
                const decoded = atob(arg.value);
                path.replaceWith(types.stringLiteral(decoded));
            }
            catch (e) { }
        }
    },
});




function isBase64(str: unknown): boolean {
    if (typeof str !== 'string') return false;
  
    // — no /x flag, no inline comments, no stray whitespace —
    const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})?$/;
  
    if (!base64Regex.test(str)) {
      return false;
    }
  
    try {
      // Browser version:
      const decoded = atob(str);
  
      // Optional: reject any non‑printable ASCII
      for (let i = 0; i < decoded.length; i++) {
        const code = decoded.charCodeAt(i);
        if (code < 32 || code > 126) {
          return false;
        }
      }
  
      // Normalize padding and re‑encode to catch things like "YWJjZA" vs "YWJjZA=="
      const reEncoded = btoa(decoded).replace(/=+$/, '');
      const normalized = str.replace(/=+$/, '');
  
      return reEncoded === normalized;
    } catch {
      return false;
    }
  }
  
  


// Utility function for custom decryption (currently unused)
// const cache: Record<string, string> = {};
// function customDecrypt(str: string): string {
//     if (cache[str]) {
//         return cache[str];
//     }
//     const decoded = atob(str);
//     let result = '';
//     for (let i = 0; i < decoded.length; i++) {
//         const keyChar = "udnk64o".charCodeAt(i % 7);
//         result += String.fromCharCode(keyChar ^ decoded.charCodeAt(i));
//     }
//     cache[str] = result;
//     return result;
// }

function decrypt(t: string, i: number = 13): string {
    return t.replace(/[A-Za-z]/g, function (char: string) {
        return String.fromCharCode(char.charCodeAt(0) + (char.toUpperCase() <= "M" ? i : -i));
    });
}


function decodeXor(base64Input) {
  // Decode base64 into a string
  const decoded = Buffer.from(base64Input, "base64").toString("binary");

  // First char is the XOR key
  const key = decoded.charCodeAt(0);

  // XOR each remaining char with the key
  let result = "";
  for (let i = 1; i < decoded.length; i++) {
    result += String.fromCharCode(key ^ decoded.charCodeAt(i));
  }

  return result;
}
const code = generate(ast).code;
writeFileSync("./outwithdeob.js", code);