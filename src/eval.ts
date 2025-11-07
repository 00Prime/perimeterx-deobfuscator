//@ts-nocheck

import axios from "axios";
// import deob from 'deob-transformations';
import * as parser from "@babel/parser";
import traverse_ from "@babel/traverse";
import generate_ from "@babel/generator";
import types from "@babel/types";
import * as encryptedCalls from "./enc.js";
let traverse = traverse_.default;
let generate = generate_.default;

import { writeFileSync, readFileSync } from "fs";

import { VM, VMScript } from "vm2";
import { CodeSaver } from "./code-saver.js";
import { VMWrapper } from "./vm-wrapper.js";


const data = readFileSync("../deob.js", "utf8");


const vm = new VM({
    console: "inherit",
    eval: false,
});

// Create CodeSaver with configuration
const codeSaver = new CodeSaver({
    enabled: false,
    outputDir: './saved-eval-code',
    fileNamePattern: 'eval-{timestamp}-{index}.js',
    appendToFile: false,
    includeMetadata: true
});

// Create VMWrapper
const vmWrapper = new VMWrapper(vm, codeSaver);

//load functions into the vm
vmWrapper.run(functions, 'functions-initialization');
const ast = parser.parse(data);

console.log('wassssgoooood g');


traverse(ast, {
    CallExpression(path) {
        const { callee, arguments: args } = path.node;

        // //atob call
        const arg = args[0];

        if (types.isNumericLiteral(arg)) {

            try {

                //callee.name(arg.value) in vm
                const decoded = vmWrapper.run(`${callee.name}(${arg.value})`, `decode-${callee.name}-${arg.value}`);
                //replace the call with the decoded value
                path.replaceWith(types.stringLiteral(decoded));


            } catch (error) {

            }
        }

    },
});

const code = generate(ast).code;

writeFileSync("./outwithdeob.js", code);