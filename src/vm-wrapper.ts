/**
 * VM2 Wrapper for PerimeterX Deobfuscator
 * 
 * This module provides a wrapper around VM2 that intercepts code before execution
 * and saves it using the CodeSaver for inspection and debugging purposes.
 */

import { VM, VMScript } from 'vm2';
import { CodeSaver } from './code-saver.js';

/**
 * Wrapper class for VM2 that intercepts and saves code before execution
 */
export class VMWrapper {
  private vm: VM;
  private codeSaver: CodeSaver;

  /**
   * Creates a new VMWrapper instance
   * @param vm The VM2 instance to wrap
   * @param codeSaver The CodeSaver instance to use for saving code
   */
  constructor(vm: VM, codeSaver: CodeSaver) {
    this.vm = vm;
    this.codeSaver = codeSaver;
  }

  /**
   * Runs a code string in the VM2 sandbox
   * Intercepts the code and saves it before execution
   * @param code The JavaScript code to execute
   * @param context Optional context information for the saved file
   * @returns The result of the code execution
   */
  public run(code: string, context?: string): any {
    // Save the code before execution if enabled
    if (this.codeSaver.isEnabled()) {
      const savedPath = this.codeSaver.saveCode(code, context || 'vm-run');
      if (savedPath) {
        console.log(`Code saved to: ${savedPath}`);
      }
    }

    // Execute the code in the VM2 sandbox
    return this.vm.run(code);
  }

  /**
   * Runs a VMScript object in the VM2 sandbox
   * Intercepts the code and saves it before execution
   * @param script The VMScript object to execute
   * @param context Optional context information for the saved file
   * @returns The result of the script execution
   */
  public runScript(script: VMScript, context?: string): any {
    // Extract code from VMScript for saving
    // Note: VMScript doesn't expose the original code directly,
    // so we'll save what we can access
    if (this.codeSaver.isEnabled()) {
      // VMScript.code property contains the compiled code
      const codeToSave = script.code || script.toString();
      const savedPath = this.codeSaver.saveCode(codeToSave, context || 'vm-script');
      if (savedPath) {
        // console.log(`Script code saved to: ${savedPath}`);
      }
    }

    // Execute the script in the VM2 sandbox
    return this.vm.run(script);
  }

  /**
   * Gets the underlying VM2 instance
   * @returns The wrapped VM2 instance
   */
  public getVM(): VM {
    return this.vm;
  }

  /**
   * Gets the CodeSaver instance
   * @returns The CodeSaver instance
   */
  public getCodeSaver(): CodeSaver {
    return this.codeSaver;
  }

  /**
   * Enables or disables code saving
   * @param enabled Whether code saving should be enabled
   */
  public setCodeSavingEnabled(enabled: boolean): void {
    this.codeSaver.setEnabled(enabled);
  }

  /**
   * Checks if code saving is enabled
   * @returns Whether code saving is enabled
   */
  public isCodeSavingEnabled(): boolean {
    return this.codeSaver.isEnabled();
  }
}