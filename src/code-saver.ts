/**
 * Code Saving Module for PerimeterX Deobfuscator
 * 
 * This module provides functionality to save executed JavaScript code to files
 * for inspection and debugging purposes.
 */

import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Configuration options for the CodeSaver
 */
export interface CodeSaverOptions {
  /** Whether code saving is enabled */
  enabled: boolean;
  /** Directory where code files will be saved */
  outputDir: string;
  /** Pattern for file names, can include placeholders like {timestamp}, {index} */
  fileNamePattern: string;
  /** Whether to append to existing files or create new ones */
  appendToFile: boolean;
  /** Whether to include metadata in saved files */
  includeMetadata: boolean;
}

/**
 * Default configuration for CodeSaver
 */
const defaultOptions: CodeSaverOptions = {
  enabled: true,
  outputDir: './saved-eval-code',
  fileNamePattern: 'eval-{timestamp}.js',
  appendToFile: false,
  includeMetadata: true
};

/**
 * Class responsible for saving executed code to files
 */
export class CodeSaver {
  private options: CodeSaverOptions;
  private saveCount: number = 0;

  /**
   * Creates a new CodeSaver instance
   * @param options Configuration options
   */
  constructor(options: Partial<CodeSaverOptions> = {}) {
    this.options = { ...defaultOptions, ...options };
    this.ensureOutputDirExists();
  }

  /**
   * Ensures the output directory exists
   */
  private ensureOutputDirExists(): void {
    if (this.options.enabled && !existsSync(this.options.outputDir)) {
      try {
        mkdirSync(this.options.outputDir, { recursive: true });
      } catch (error) {
        console.error(`Failed to create output directory: ${error.message}`);
      }
    }
  }

  /**
   * Generates a file name based on the pattern
   * @param context Optional context information
   * @returns Generated file name
   */
  private generateFileName(context?: string): string {
    let fileName = this.options.fileNamePattern;
    
    // Replace placeholders in the file name pattern
    fileName = fileName.replace('{timestamp}', Date.now().toString());
    fileName = fileName.replace('{index}', this.saveCount.toString().padStart(4, '0'));
    fileName = fileName.replace('{context}', context || 'unknown');
    
    return join(this.options.outputDir, fileName);
  }

  /**
   * Formats the code with optional metadata
   * @param code The code to format
   * @param context Optional context information
   * @returns Formatted code
   */
  private formatCode(code: string, context?: string): string {
    if (!this.options.includeMetadata) {
      return code;
    }

    const timestamp = new Date().toISOString();
    const sourceFile = context || 'unknown';
    
    return `/**
 * ===================================================
 * Execution Context: ${sourceFile}
 * Timestamp: ${timestamp}
 * ===================================================
 */

// Original code follows
${code}`;
  }

  /**
   * Saves code to a file
   * @param code The code to save
   * @param context Optional context information
   * @returns The file path where the code was saved
   */
  public saveCode(code: string, context?: string): string {
    if (!this.options.enabled) {
      return '';
    }

    try {
      const filePath = this.generateFileName(context);
      const formattedCode = this.formatCode(code, context);
      
      if (this.options.appendToFile && existsSync(filePath)) {
        appendFileSync(filePath, `\n\n${formattedCode}`);
      } else {
        writeFileSync(filePath, formattedCode);
      }
      
      this.saveCount++;
      return filePath;
    } catch (error) {
      console.error(`Failed to save code: ${error.message}`);
      return '';
    }
  }

  /**
   * Checks if code saving is enabled
   * @returns Whether code saving is enabled
   */
  public isEnabled(): boolean {
    return this.options.enabled;
  }

  /**
   * Enables or disables code saving
   * @param enabled Whether code saving should be enabled
   */
  public setEnabled(enabled: boolean): void {
    this.options.enabled = enabled;
    if (enabled) {
      this.ensureOutputDirExists();
    }
  }

  /**
   * Updates the configuration options
   * @param options New configuration options
   */
  public updateOptions(options: Partial<CodeSaverOptions>): void {
    const oldOutputDir = this.options.outputDir;
    this.options = { ...this.options, ...options };
    
    // If output directory changed, ensure it exists
    if (this.options.enabled && oldOutputDir !== this.options.outputDir) {
      this.ensureOutputDirExists();
    }
  }
}