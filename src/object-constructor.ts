//@ts-nocheck

/**
 * Object Construction Executor Module for PerimeterX Deobfuscator
 * 
 * This module provides functionality to execute object construction patterns
 * in a secure sandbox and generate clean object literals from the results.
 */

import * as types from "@babel/types";
import { VMWrapper } from "./vm-wrapper.js";

/**
 * Represents a detected object construction pattern
 */
export interface ObjectConstructionPattern {
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

/**
 * Execution context for object construction patterns
 * Manages variables and functions available during execution
 */
export interface ExecutionContext {
    variables: Map<string, any>;
    functions: Map<string, Function>;
    vmWrapper: VMWrapper;
}

/**
 * Result of executing an object construction pattern
 */
export interface ExecutionResult {
    success: boolean;
    result?: any;
    error?: Error;
    executedCode: string;
    executionTime: number;
}

/**
 * Interface for executing object construction patterns
 */
export interface ObjectConstructionExecutor {
    executeConstruction(pattern: ObjectConstructionPattern, context: ExecutionContext): ExecutionResult;
    validateResult(result: any): boolean;
}

/**
 * Interface for generating object literals from execution results
 */
export interface ObjectLiteralGenerator {
    generateObjectLiteral(obj: any): types.ObjectExpression;
    handleCircularReferences(obj: any): types.ObjectExpression;
    convertComplexValues(value: any): types.Expression;
}

/**
 * Implementation of ObjectConstructionExecutor
 * Handles safe execution of object construction patterns in VM2 sandbox
 */
export class ObjectConstructionExecutorImpl implements ObjectConstructionExecutor {
    private maxExecutionTime: number = 5000; // 5 seconds timeout
    private maxPropertyCount: number = 1000; // Maximum properties in result object
    private maxObjectDepth: number = 10; // Maximum nesting depth

    /**
     * Executes an object construction pattern in the sandbox
     * Requirements: 2.1, 2.2, 2.3, 5.2, 5.3
     */
    executeConstruction(pattern: ObjectConstructionPattern, context: ExecutionContext): ExecutionResult {
        const startTime = Date.now();
        
        try {
            // Generate executable code from the pattern
            const executableCode = this.generateExecutableCode(pattern, context);
            
            // Execute in VM2 sandbox using existing VMWrapper infrastructure
            const result = this.executeWithVMWrapper(executableCode, context);
            
            const executionTime = Date.now() - startTime;
            
            // Validate the result
            if (!this.validateResult(result)) {
                return {
                    success: false,
                    error: new Error("Execution result validation failed"),
                    executedCode: executableCode,
                    executionTime
                };
            }
            
            return {
                success: true,
                result,
                executedCode: executableCode,
                executionTime
            };
            
        } catch (error) {
            const executionTime = Date.now() - startTime;
            return {
                success: false,
                error: error as Error,
                executedCode: "",
                executionTime
            };
        }
    }

    /**
     * Validates that execution results are valid objects
     * Requirements: 6.1, 6.2
     */
    validateResult(result: any): boolean {
        // Check if result is an object
        if (typeof result !== 'object' || result === null) {
            return false;
        }
        
        // Check property count limits
        const propertyCount = this.countProperties(result);
        if (propertyCount > this.maxPropertyCount) {
            console.warn(`Object has too many properties (${propertyCount}), exceeds limit of ${this.maxPropertyCount}`);
            return false;
        }
        
        // Check object depth
        const depth = this.calculateObjectDepth(result);
        if (depth > this.maxObjectDepth) {
            console.warn(`Object nesting too deep (${depth}), exceeds limit of ${this.maxObjectDepth}`);
            return false;
        }
        
        // Check for circular references
        if (this.hasCircularReferences(result)) {
            console.warn("Object contains circular references");
            return false;
        }
        
        return true;
    }

    /**
     * Generates executable code from an object construction pattern
     * Integrates with existing variable context from deobfuscation process
     * Requirements: 5.2, 5.3
     */
    private generateExecutableCode(pattern: ObjectConstructionPattern, context: ExecutionContext): string {
        // Import necessary variables and functions into the execution context
        let setupCode = "";
        
        // Add variable declarations for referenced variables from context
        // This leverages the existing CodeSaver's variable tracking
        for (const varName of pattern.metadata.variableReferences) {
            if (context.variables.has(varName)) {
                const value = context.variables.get(varName);
                // Handle different value types safely
                if (typeof value === 'string') {
                    setupCode += `var ${varName} = ${JSON.stringify(value)};\n`;
                } else if (typeof value === 'number' || typeof value === 'boolean') {
                    setupCode += `var ${varName} = ${value};\n`;
                } else if (value === null || value === undefined) {
                    setupCode += `var ${varName} = ${value};\n`;
                } else if (typeof value === 'object') {
                    try {
                        setupCode += `var ${varName} = ${JSON.stringify(value)};\n`;
                    } catch (error) {
                        // Handle circular references or non-serializable objects
                        setupCode += `var ${varName} = {};\n`;
                        console.warn(`Could not serialize variable ${varName}, using empty object`);
                    }
                } else {
                    setupCode += `var ${varName} = undefined;\n`;
                }
            } else {
                // Variable not found in context, initialize as undefined
                setupCode += `var ${varName} = undefined;\n`;
                console.warn(`Variable ${varName} not found in execution context`);
            }
        }
        
        // Add function declarations for referenced functions
        for (const [funcName, func] of context.functions) {
            setupCode += `var ${funcName} = ${func.toString()};\n`;
        }
        
        // Generate the actual construction code
        const constructionCode = this.generateConstructionCode(pattern);
        
        return setupCode + constructionCode;
    }

    /**
     * Generates the actual object construction code from the pattern
     */
    private generateConstructionCode(pattern: ObjectConstructionPattern): string {
        // For eval-based execution, we'll reconstruct the original call expression
        // and wrap it in a way that returns the final result
        
        // Start with the base object
        let code = "";
        
        // If base object is an identifier, we need to initialize it
        if (types.isIdentifier(pattern.baseObject)) {
            code += `var ${pattern.baseObject.name} = ${pattern.baseObject.name} || {};\n`;
        }
        
        // Generate the chained construction calls
        // We'll execute them in order and return the final result
        code += "var result = ";
        
        // Reconstruct the nested call structure
        code += this.reconstructCallChain(pattern.chainedCalls);
        
        code += ";\nresult;";
        
        return code;
    }

    /**
     * Reconstructs the call chain from the pattern
     */
    private reconstructCallChain(chainedCalls: types.CallExpression[]): string {
        if (chainedCalls.length === 0) {
            return "{}";
        }
        
        // Build the nested structure from innermost to outermost
        let result = "";
        
        for (let i = chainedCalls.length - 1; i >= 0; i--) {
            const call = chainedCalls[i];
            const funcName = (call.callee as types.Identifier).name;
            
            if (i === chainedCalls.length - 1) {
                // Innermost call - use the actual base object
                const baseArg = this.expressionToString(call.arguments[0]);
                const keyArg = this.expressionToString(call.arguments[1]);
                const valueArg = this.expressionToString(call.arguments[2]);
                
                result = `${funcName}(${baseArg}, ${keyArg}, ${valueArg})`;
            } else {
                // Outer calls - use the previous result as the first argument
                const keyArg = this.expressionToString(call.arguments[1]);
                const valueArg = this.expressionToString(call.arguments[2]);
                
                result = `${funcName}(${result}, ${keyArg}, ${valueArg})`;
            }
        }
        
        return result;
    }

    /**
     * Converts an AST expression to its string representation
     */
    private expressionToString(expr: types.Expression): string {
        if (types.isStringLiteral(expr)) {
            return `"${expr.value}"`;
        } else if (types.isNumericLiteral(expr)) {
            return expr.value.toString();
        } else if (types.isBooleanLiteral(expr)) {
            return expr.value.toString();
        } else if (types.isNullLiteral(expr)) {
            return "null";
        } else if (types.isIdentifier(expr)) {
            return expr.name;
        } else {
            // For complex expressions, we'll need to generate code
            // This is a simplified version - in practice, we'd use Babel generator
            return "undefined";
        }
    }

    /**
     * Executes code using existing VMWrapper infrastructure
     * Requirements: 2.1, 2.2, 2.3, 5.2, 5.3
     */
    private executeWithVMWrapper(code: string, context: ExecutionContext): any {
        // Use the existing VMWrapper for execution
        // The VMWrapper already handles code saving and provides VM2 sandbox
        // This integrates with the existing CodeSaver functionality
        
        try {
            // Execute using VMWrapper which automatically saves code via CodeSaver
            const result = context.vmWrapper.run(code, "object-construction");
            return result;
        } catch (error) {
            throw new Error(`Object construction execution failed: ${error.message}`);
        }
    }

    /**
     * Creates an execution context from the current deobfuscation state
     * Requirements: 5.1, 5.2, 5.3
     */
    public static createExecutionContext(
        vmWrapper: VMWrapper, 
        variables: Map<string, any> = new Map(), 
        functions: Map<string, Function> = new Map()
    ): ExecutionContext {
        return {
            variables,
            functions,
            vmWrapper
        };
    }

    /**
     * Extracts variables from the current deobfuscation context
     * This method can be used to populate the ExecutionContext with variables
     * from the ongoing deobfuscation process
     */
    public static extractVariablesFromScope(scope: any): Map<string, any> {
        const variables = new Map<string, any>();
        
        // This would be implemented to extract variables from Babel scope
        // For now, return empty map as placeholder
        // In practice, this would traverse the scope bindings
        
        return variables;
    }

    /**
     * Extracts functions from the current deobfuscation context
     * This method can be used to populate the ExecutionContext with functions
     * from the ongoing deobfuscation process
     */
    public static extractFunctionsFromScope(scope: any): Map<string, Function> {
        const functions = new Map<string, Function>();
        
        // This would be implemented to extract functions from Babel scope
        // For now, return empty map as placeholder
        // In practice, this would traverse function declarations and expressions
        
        return functions;
    }

    /**
     * Counts the total number of properties in an object (including nested)
     */
    private countProperties(obj: any, visited = new Set()): number {
        if (visited.has(obj)) {
            return 0; // Avoid infinite recursion on circular references
        }
        
        if (typeof obj !== 'object' || obj === null) {
            return 0;
        }
        
        visited.add(obj);
        let count = 0;
        
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                count++;
                count += this.countProperties(obj[key], visited);
            }
        }
        
        visited.delete(obj);
        return count;
    }

    /**
     * Calculates the maximum depth of an object
     */
    private calculateObjectDepth(obj: any, visited = new Set()): number {
        if (visited.has(obj)) {
            return 0; // Avoid infinite recursion
        }
        
        if (typeof obj !== 'object' || obj === null) {
            return 0;
        }
        
        visited.add(obj);
        let maxDepth = 0;
        
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const depth = 1 + this.calculateObjectDepth(obj[key], visited);
                maxDepth = Math.max(maxDepth, depth);
            }
        }
        
        visited.delete(obj);
        return maxDepth;
    }

    /**
     * Checks for circular references in an object
     */
    private hasCircularReferences(obj: any, visited = new Set()): boolean {
        if (typeof obj !== 'object' || obj === null) {
            return false;
        }
        
        if (visited.has(obj)) {
            return true; // Circular reference detected
        }
        
        visited.add(obj);
        
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (this.hasCircularReferences(obj[key], visited)) {
                    return true;
                }
            }
        }
        
        visited.delete(obj);
        return false;
    }
}