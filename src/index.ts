//@ts-nocheck
import axios from "axios";
// import deob from 'deob-transformations';
import * as parser from "@babel/parser";
import traverse_ from "@babel/traverse";
import generate_ from "@babel/generator";
import types, { callExpression } from "@babel/types";
import * as encryptedCalls from "./enc.js";
let traverse = traverse_.default;
let generate = generate_.default;

import { writeFileSync, readFileSync } from "fs";

import { VM, VMScript } from "vm2";
import { CodeSaver } from "./code-saver.js";
import { VMWrapper } from "./vm-wrapper.js";

// Object Construction Pattern Detection Infrastructure
interface ObjectConstructionPattern {
    // The outermost call expression in the chain
    rootCall: types.CallExpression;

    // All nested call expressions in order
    chainedCalls: types.CallExpression[];

    // Name of the constructor function (e.g., "A")
    constructorFunction: string;

    // The base object being constructed upon
    baseObject: types.Expression;

    // Additional metadata for execution
    metadata: {
        depth: number;
        variableReferences: string[];
        complexity: number;
    };
}

interface ExecutionContext {
    variables: Map<string, any>;
    functions: Map<string, Function>;
    vmWrapper: VMWrapper;
}

interface ExecutionResult {
    success: boolean;
    result?: any;
    error?: Error;
    executedCode: string;
    executionTime: number;
}

// Utility functions for object construction pattern detection

/**
 * Identifies if a call expression is part of a chained function call pattern
 * that constructs objects by adding properties dynamically
 */
function isObjectConstructionPattern(callExpr: types.CallExpression): boolean {
    // Check if this is a function call with at least 3 arguments (object, key, value)
    if (!types.isIdentifier(callExpr.callee) || callExpr.arguments.length < 3) {
        return false;
    }

    // Check if the first argument is either an identifier, object expression, or another call expression
    const firstArg = callExpr.arguments[0];
    if (!types.isIdentifier(firstArg) &&
        !types.isCallExpression(firstArg) &&
        !types.isObjectExpression(firstArg) &&
        !types.isMemberExpression(firstArg)) {
        return false;
    }

    // If the first argument is a call expression, check if it uses the same function
    if (types.isCallExpression(firstArg) && types.isIdentifier(firstArg.callee)) {
        const outerFunctionName = (callExpr.callee as types.Identifier).name;
        const innerFunctionName = (firstArg.callee as types.Identifier).name;
        return outerFunctionName === innerFunctionName;
    }

    // Additional validation for the function name pattern
    const functionName = (callExpr.callee as types.Identifier).name;

    // Filter out common JavaScript methods that aren't object constructors
    const excludedMethods = [
        'console', 'log', 'error', 'warn', 'info', 'debug',
        'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
        'parseInt', 'parseFloat', 'isNaN', 'isFinite',
        'Math', 'Date', 'Array', 'Object', 'String', 'Number', 'Boolean',
        'JSON', 'RegExp', 'Error', 'Promise'
    ];

    if (excludedMethods.includes(functionName)) {
        return false;
    }

    // Check if this looks like a method call on an object (e.g., obj.method())
    // These are less likely to be object construction patterns
    if (functionName.includes('.') || functionName.startsWith('_') && functionName.length > 3) {
        return false;
    }

    return true;
}

/**
 * Extracts all chained calls from a nested call expression pattern
 */
function extractChainedCalls(rootCall: types.CallExpression): types.CallExpression[] {
    const chainedCalls: types.CallExpression[] = [];
    let currentCall = rootCall;

    while (currentCall) {
        chainedCalls.push(currentCall);

        // Check if the first argument is another call expression with the same function
        const firstArg = currentCall.arguments[0];
        if (types.isCallExpression(firstArg) &&
            types.isIdentifier(firstArg.callee) &&
            types.isIdentifier(currentCall.callee) &&
            firstArg.callee.name === currentCall.callee.name) {
            currentCall = firstArg;
        } else {
            break;
        }
    }

    return chainedCalls.reverse(); // Return in execution order (innermost first)
}

/**
 * Finds the base object in a chained construction pattern
 */
function findBaseObject(chainedCalls: types.CallExpression[]): types.Expression {
    if (chainedCalls.length === 0) {
        throw new Error("No chained calls provided");
    }

    // The base object is the first argument of the innermost call
    const innermostCall = chainedCalls[0];
    return innermostCall.arguments[0];
}

/**
 * Extracts variable references from the construction pattern
 */
function extractVariableReferences(chainedCalls: types.CallExpression[]): string[] {
    const variables = new Set<string>();

    chainedCalls.forEach(call => {
        call.arguments.forEach(arg => {
            if (types.isIdentifier(arg)) {
                variables.add(arg.name);
            }
        });
    });

    return Array.from(variables);
}

/**
 * Creates an ObjectConstructionPattern from a detected call expression
 */
function createObjectConstructionPattern(rootCall: types.CallExpression): ObjectConstructionPattern | null {
    if (!isObjectConstructionPattern(rootCall) || !types.isIdentifier(rootCall.callee)) {
        return null;
    }

    const chainedCalls = extractChainedCalls(rootCall);
    const baseObject = findBaseObject(chainedCalls);
    const variableReferences = extractVariableReferences(chainedCalls);
    const constructorFunction = (rootCall.callee as types.Identifier).name;

    return {
        rootCall,
        chainedCalls,
        constructorFunction,
        baseObject,
        metadata: {
            depth: chainedCalls.length,
            variableReferences,
            complexity: chainedCalls.length * chainedCalls[0].arguments.length
        }
    };
}

/**
 * Validates that a detected pattern matches object construction signature
 * and filters out false positives and non-construction patterns
 */
function validateObjectConstructionPattern(pattern: ObjectConstructionPattern): boolean {
    // Requirement 1.2: Validate object construction signature

    // Check minimum depth - single calls are likely not construction patterns
    if (pattern.metadata.depth < 2) {
        return false;
    }

    // Check maximum reasonable depth to avoid performance issues
    if (pattern.metadata.depth > 50) {
        console.warn(`Object construction pattern too deep (${pattern.metadata.depth}), skipping for performance`);
        return false;
    }

    // Requirement 4.1, 4.2: Handle edge cases and validate function signatures

    // Validate that all chained calls have the expected signature (3+ arguments)
    for (const call of pattern.chainedCalls) {
        if (call.arguments.length < 3) {
            return false;
        }

        // Check that the second argument (key) is a string, identifier, or numeric literal
        const keyArg = call.arguments[1];
        if (!types.isStringLiteral(keyArg) &&
            !types.isIdentifier(keyArg) &&
            !types.isNumericLiteral(keyArg)) {
            return false;
        }

        // Validate third argument (value) - should be a reasonable value type
        const valueArg = call.arguments[2];
        if (!isValidValueArgument(valueArg)) {
            return false;
        }
    }

    // Filter out patterns that don't look like object construction
    // Check if the constructor function name is reasonable (1-3 characters for obfuscated code)
    if (pattern.constructorFunction.length === 0 || pattern.constructorFunction.length > 3) {
        return false;
    }

    // Validate that the base object is reasonable
    if (!isValidBaseObject(pattern.baseObject)) {
        return false;
    }

    // Check for consistent function usage across all calls
    const functionName = pattern.constructorFunction;
    for (const call of pattern.chainedCalls) {
        if (!types.isIdentifier(call.callee) || call.callee.name !== functionName) {
            return false;
        }
    }

    // Additional validation: Check for suspicious patterns that might be false positives
    if (isSuspiciousPattern(pattern)) {
        return false;
    }

    // Validate argument consistency across calls
    if (!hasConsistentArgumentPattern(pattern)) {
        return false;
    }

    return true;
}

/**
 * Validates if an argument is a valid value for object property assignment
 */
function isValidValueArgument(arg: types.Expression): boolean {
    return (
        types.isStringLiteral(arg) ||
        types.isNumericLiteral(arg) ||
        types.isBooleanLiteral(arg) ||
        types.isNullLiteral(arg) ||
        types.isIdentifier(arg) ||
        types.isArrayExpression(arg) ||
        types.isObjectExpression(arg) ||
        types.isCallExpression(arg) ||
        types.isMemberExpression(arg) ||
        types.isBinaryExpression(arg) ||
        types.isUnaryExpression(arg)
    );
}

/**
 * Validates if a base object is reasonable for object construction
 */
function isValidBaseObject(baseObj: types.Expression): boolean {
    return (
        types.isIdentifier(baseObj) ||
        types.isObjectExpression(baseObj) ||
        types.isCallExpression(baseObj) ||
        types.isMemberExpression(baseObj)
    );
}

/**
 * Detects suspicious patterns that are likely false positives
 */
function isSuspiciousPattern(pattern: ObjectConstructionPattern): boolean {
    // Check if all keys are the same (unlikely in real object construction)
    const keys = new Set<string>();
    for (const call of pattern.chainedCalls) {
        const keyArg = call.arguments[1];
        let keyValue: string;

        if (types.isStringLiteral(keyArg)) {
            keyValue = keyArg.value;
        } else if (types.isIdentifier(keyArg)) {
            keyValue = keyArg.name;
        } else if (types.isNumericLiteral(keyArg)) {
            keyValue = keyArg.value.toString();
        } else {
            continue;
        }

        keys.add(keyValue);
    }

    // If all keys are the same, it's suspicious
    if (keys.size === 1 && pattern.chainedCalls.length > 1) {
        return true;
    }

    // Check for patterns with too many numeric keys (might be array-like, not object construction)
    let numericKeyCount = 0;
    for (const call of pattern.chainedCalls) {
        const keyArg = call.arguments[1];
        if (types.isNumericLiteral(keyArg) ||
            (types.isStringLiteral(keyArg) && /^\d+$/.test(keyArg.value))) {
            numericKeyCount++;
        }
    }

    // If more than 80% of keys are numeric, it might be array construction
    if (numericKeyCount / pattern.chainedCalls.length > 0.8) {
        return true;
    }

    // Check for patterns where the function name is a common JavaScript method
    const commonMethods = ['push', 'pop', 'shift', 'unshift', 'splice', 'slice', 'concat', 'join', 'map', 'filter', 'reduce'];
    if (commonMethods.includes(pattern.constructorFunction)) {
        return true;
    }

    return false;
}

/**
 * Validates that the pattern has consistent argument structure across calls
 */
function hasConsistentArgumentPattern(pattern: ObjectConstructionPattern): boolean {
    if (pattern.chainedCalls.length === 0) {
        return false;
    }

    const firstCallArgCount = pattern.chainedCalls[0].arguments.length;

    // All calls should have the same number of arguments
    for (const call of pattern.chainedCalls) {
        if (call.arguments.length !== firstCallArgCount) {
            return false;
        }
    }

    // For object construction, we expect exactly 3 arguments: (object, key, value)
    // Some patterns might have 4 arguments with additional metadata
    if (firstCallArgCount < 3 || firstCallArgCount > 4) {
        return false;
    }

    return true;
}

const fetchScript = false;

let data;
if (fetchScript) {
    data = await axios
        .get("https://account.ny.sportsbook.fanduel.com/JMCVuBG8/init.js")
        .then(function (response) {
            return response.data;
        });
} else {
    data = readFileSync("./static.js", "utf8");
}

const ast = parser.parse(data);

// Object Construction Pattern Detection - Run early before other transformations
const detectedPatterns: ObjectConstructionPattern[] = [];
const rejectedPatterns: { pattern: ObjectConstructionPattern; reason: string }[] = [];

traverse(ast, {
    CallExpression(path) {
        const callExpr = path.node;

        // Check if this call expression matches object construction pattern
        if (isObjectConstructionPattern(callExpr)) {
            const pattern = createObjectConstructionPattern(callExpr);

            if (pattern) {
                // Validate the pattern before adding to detected patterns
                if (validateObjectConstructionPattern(pattern)) {
                    detectedPatterns.push(pattern);
                    console.log(`Detected valid object construction pattern: ${pattern.constructorFunction} with depth ${pattern.metadata.depth}`);
                } else {
                    rejectedPatterns.push({ pattern, reason: 'Failed validation' });
                }
            }
        }
    }
});

// Log summary of pattern detection if any patterns were found
if (detectedPatterns.length > 0 || rejectedPatterns.length > 0) {
    console.log(`\nObject Construction Pattern Detection Summary:`);
    console.log(`- Detected valid patterns: ${detectedPatterns.length}`);
    console.log(`- Rejected patterns: ${rejectedPatterns.length}`);

    if (detectedPatterns.length > 0) {
        console.log(`\nValid patterns found:`);
        detectedPatterns.forEach((pattern, index) => {
            console.log(`  ${index + 1}. ${pattern.constructorFunction}() - depth: ${pattern.metadata.depth}, complexity: ${pattern.metadata.complexity}`);
        });
    }
}

const arrs = [];
const arrayFunctionNames = [];
const arrayDeobCalls = {};
let arrayFunctions = "";

traverse(ast, {
    /*Looking for function:
       function Ql(n, t) {
        var e = Cf();
        return (Ql = function (n, t) {
          return e[n -= 422];
        })(n, t);
      } */
    FunctionDeclaration(path) {
        const { body } = path.node.body;

     
        if (
            types.isVariableDeclaration(body[0]) &&
            types.isReturnStatement(body[1]) &&
            body.length === 2 &&
            types.isCallExpression(body[1].argument)
        ) {
            var { init } = body[0].declarations[0];

            if (!types.isCallExpression(init)) return;
            if (init.callee && init.callee.name && init.arguments.length === 0) {
                // console.log(path.node.id.name);
                arrayDeobCalls[path.node.id.name] = `function (data) {

                    ${path.node.id.name}()

                }`;
                arrs.push([init.callee.name, path.node.id.name]);
                arrayFunctionNames.push(init.callee.name);
                const functionCode = generate(path.node).code;

                arrayFunctions += "\n" + functionCode;
                /*
                        const arrayRotate = path.getSibling(path.key + 1);
                        if (types.isExpressionStatement(arrayRotate)) {
        
                            const arrayFunc = generate(arrayRotate.node).code;
                            const combined = functionCode + arrayFunc;
                            // console.log(combined);
                        } else {
                            notFound.push(path.node.id.name);
                            // console.log('not expression statement', path.node.id.name);
                        } */
            }
        }
    },
});

// console.log(arrayDeobCalls);
//decode YDL
// traverse(ast, {
//     StringLiteral(path) {
//         const {
//             value
//         } = path.node;
//         if (value.includes('YDl')) {
//             const decoded = encryptedCalls.i(value);
//             path.replaceWith(types.stringLiteral(decoded));
//         }

//         // var base64Rejex = /^(?:[A-Z0-9+\/]{4})*(?:[A-Z0-9+\/]{2}==|[A-Z0-9+\/]{3}=|[A-Z0-9+\/]{4})$/i;
//         // var isBase64Valid = base64Rejex.test(value); // base64Data is the base64 string

//         // if (isBase64Valid) {
//         //     const decoded = Buffer.from(value, 'base64').toString('utf8');
//         //     path.replaceWith(types.stringLiteral(decoded));
//         // }
//     }
// })

traverse(ast, {
    CallExpression(path) {

        if (
            !types.isFunctionExpression(path.node.callee) || path.node.arguments.length !== 1
        )
            return;

        if (!types.isIdentifier(path.node.arguments[0])) return;
        if (types.isFunctionExpression(path.node.callee)) {
            const { body } = path.node.callee;

            if (body.body[0] == undefined) return;


            const lastStmt = body.body[body.body.length - 1];

            if (types.isWhileStatement(lastStmt)) {
                const functionCode = generate(path.node).code;


                // debugger;


                // i want to put the function code in a (functionCode)

                //
                arrayFunctions += `\n(${functionCode});\n`; // wrapped in () to preserve IIFE integrity
            }


            // if (types.isForStatement(body.body[0])) {
            //     const { block, handler } = body.body[0].body;

            //     if (types.isBlockStatement(block) && types.isCatchClause(handler)) {
            //         const functionCode = generate(path.node).code;
            //         arrayFunctions += "\n" + functionCode;
            //     }
            // }
        }
    },
    FunctionDeclaration(path) {
        if (!path.node.id) return;
        const { name } = path.node.id;
        if (arrayFunctionNames.includes(name) && path.node.params.length == 0) {

            const functionCode = generate(path.node).code;
            arrayFunctions += "\n" + functionCode;
        }
    },
});

traverse(ast, {
    VariableDeclarator(path) {
        let proxyObjectProperties = {};
        if (types.isObjectExpression(path.node.init)) {
            //check if object is being reassigned
            if (
                path.scope.getBinding(path.node.id.name).constantViolations.length > 0
            ) {
                return;
            }

            path.node.init.properties.forEach((property) => {
                if (types.isNumericLiteral(property.value)) {
                    proxyObjectProperties[property.key.name] = property.value.value;
                } else if (types.isBinaryExpression(property.value)) {
                    const binaryExpressionCode = generate(property.value).code;
                    proxyObjectProperties[property.key.name] = binaryExpressionCode;
                } else {
                    return;
                }
            });

            // console.log(proxyObjectProperties);
            const bindingReferences = path.scope.getBinding(
                path.node.id.name
            ).referencePaths;

            if (bindingReferences) {
                bindingReferences.forEach((referencePath) => {
                    const parentPath = referencePath.parentPath;
                    if (parentPath.isMemberExpression()) {
                        if (
                            !proxyObjectProperties[
                            referencePath.parentPath.node.property.name
                            ]
                        )
                            return;
                        const propertyName = parentPath.node.property.name;
                        const propertyValue = proxyObjectProperties[propertyName];
                        //TODO Better way to handle binary expressions
                        try {
                            parentPath.replaceWithSourceString(propertyValue);
                        } catch (error) {
                            // console.log('error');
                        }
                    }
                });
            }
        } else if (types.isNumericLiteral(path.node.init)) {
            const bindingReferences = path.scope.getBinding(
                path.node.id.name
            ).referencePaths;
            let isUsedInLoop = false;
            let isUpdated = false;
            bindingReferences.forEach((reference) => {
                if (
                    reference.findParent(types.isForStatement) ||
                    reference.findParent(types.isWhileStatement)
                ) {
                    // now make sure it's not updated if it is do not replace it
                    isUsedInLoop = true;
                    if (types.isUpdateExpression(reference.parent)) {
                        isUpdated = true;
                    }
                }
                if (types.isUpdateExpression(reference.parent)) {
                    // isUsedInLoop = true;
                    isUpdated = true;
                }
            });
            if (!isUsedInLoop && !isUpdated) {
                bindingReferences.forEach((reference) => {
                    // console.log('ddd');
                    reference.replaceWith(types.numericLiteral(path.node.init.value));
                });
            }
        }
    },
});

traverse(ast, {
    CallExpression(path) {
        if (types.isIdentifier(path.node.callee)) {
            let binding = path.scope.getBinding(path.node.callee.name);
            while (binding && types.isVariableDeclarator(binding.path.node)) {
                const init = binding.path.node.init;
                if (types.isIdentifier(init)) {
                    path.node.callee.name = init.name;
                    binding = path.scope.getBinding(init.name);
                } else {
                    break;
                }
            }
        }
    },
});

//delete unused variables
traverse(ast, {
    VariableDeclarator(path) {
        const { node, scope } = path;
        const { constant, referenced } = scope.getBinding(node.id.name);
        // If the variable is constant and never referenced, remove it.
        if (constant && !referenced) {
            path.remove();
        }
    },
    FunctionDeclaration(path) {
        const { node, scope } = path;
        const { constant, referenced } = scope.getBinding(node.id.name);
        if (constant && !referenced) {
            path.remove();
        }
    },
});

// console.log(arrayFunctions);

const vm = new VM({
    eval: false,
    wasm: false,
    fixAsync: true
});

// Create CodeSaver with configuration
const codeSaver = new CodeSaver({
    enabled: true,
    outputDir: './saved-eval-code',
    fileNamePattern: 'index-{timestamp}-{index}.js',
    appendToFile: false,
    includeMetadata: true
});

// Create VMWrapper
const vmWrapper = new VMWrapper(vm, codeSaver);

console.log(arrayFunctions);
const arrayFunctionsCalls = arrayFunctionNames.map((name) => {
    return vmWrapper.runScript(new VMScript(arrayFunctions + "\n" + name + "()"), `array-function-${name}`);
});

const map = new Map();
arrs.forEach((arr, i) => {
    map.set(arr[1], arrayFunctionsCalls[i]);
});

// console.log(arrayFunctionNames);

//traverse ast again and replace arrs call with function

traverse(ast, {
    CallExpression(path) {
        const { callee, arguments: args } = path.node;
        if (
            types.isIdentifier(path.node.callee) &&
            path.node.arguments.length == 1
        ) {

            const { name } = path.node.callee;
            if (map.has(name)) {
                if (types.isNumericLiteral(path.node.arguments[0])) {
                    const value = path.node.arguments[0].value;
                    const callee = map.get(name);
                    const code = generate(path.node).code
                    // run function code in vm and see what the result is and replace the path with that strihng
                    try {

                        const decoded = vmWrapper.vm.run(code);

                        //replace the call with the decoded value
                        path.replaceWith(types.stringLiteral(decoded));


                    } catch (error) {
                        console.log(error)
                    }
                } else if (types.isIdentifier(path.node.arguments[0])) {
                    const value = path.node.arguments[0].name;
                    //find the value of the arr from binding scope
                    const binding = path.scope.getBinding(value);
                    const valueOfArr = binding.path.node.init.value;
                    const callee = map.get(name);
                    const code = `${name}(${valueOfArr})`
                    // run function code in vm and see what the result is and replace the path with that strihng
                    try {

                        const decoded = vmWrapper.vm.run(code);

                        //replace the call with the decoded value
                        path.replaceWith(types.stringLiteral(decoded));


                    } catch (error) {
                        console.log(error)
                    }

                }

            }
        }
    },
});



// //Handle the Q(base64EncodedStr) calls
// traverse(ast, {
//     CallExpression(path: types.CallExpression) {
//         const {
//             callee,
//         } = path.node;

//         const args = path.node.arguments;

//         if (types.isIdentifier(callee) && callee.name == "Q" && types.isStringLiteral(args[0])) {
//             const arg = args[0];
//             if (types.isStringLiteral(arg)) {
//                 const decoded = decode(arg.value).toString();

//                 path.replaceWith(types.stringLiteral(decoded));
//             }
//         } else {

//         }
//     }
// })





function decode(encodedString) {
    const decodedBase64 = atob(encodedString);

    return decodedBase64

}


// traverse(ast, {
//     CallExpression(path) {
//         const { callee, arguments: args } = path.node;

//         // //atob call
//         if (callee.name == "n") {
//             const arg = args[0];

//             if (types.isStringLiteral(arg)) {

//                 try {

//                     const decoded = decode(arg.value);

//                     path.replaceWith(types.stringLiteral(decoded));
//                 } catch (error) {

//                 }
//             }
//         }
//         //not sure
//         if (callee.name === "da") {
//             const arg = args[0];
//             if (types.isStringLiteral(arg)) {
//                 const decoded = encryptedCalls.da(arg.value);
//                 path.replaceWith(types.stringLiteral(decoded));
//             }
//         }
//         // //not sure
//         // if (callee.name === 'c' || callee.name === 'n' || callee.name === 'o' || callee.name === 'e' || callee.name === 'r' || callee.name === 'r' || callee.name === 't') {
//         //     const arg = args[0];
//         //     //make sure there is only one arg
//         //     if (types.isStringLiteral(arg) && args.length === 1) {
//         //         const decoded = encryptedCalls.i(arg.value);
//         //         path.replaceWith(types.stringLiteral(decoded));
//         //     }
//         // }
//     },
// });
//genereate code
const { code } = generate(ast);

writeFileSync("./deob.js", code);
