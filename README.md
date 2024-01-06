# TypeScript Server Instance Project

A robust project for managing and interacting with a TypeScript Server (TSServer). It includes an extensive array of functionalities such as file manipulation, code analysis, formatting, refactoring, and more, making it an ideal starting point for any TypeScript project requiring direct interaction with TSServer.

## Code Guardian
[![TSServer Instance build verification](https://github.com/aicore/template-nodejs/actions/workflows/build_verify.yml/badge.svg)](https://github.com/aicore/template-nodejs/actions/workflows/build_verify.yml)

# Commands available

## Initialization
To initialize the TypeScript Server:
```shell
> npm install   // do this only once.
> node -e 'require("./path-to-createTSServerInstance").init()'
# Usage and Examples

This TypeScript Server (TSServer) Instance project provides a wide range of functionalities to interact with TypeScript Server. Below are examples of how you can use these functionalities.

## Initialization

Before you start, make sure to initialize the TypeScript Server:

```javascript
const tsServer = require('./path-to-createTSServerInstance').init();
