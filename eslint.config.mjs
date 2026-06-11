import js from "@eslint/js";
import security from "eslint-plugin-security";

export default [
  js.configs.recommended,
  security.configs.recommended,
  {
    languageOptions: {
      globals: {
        // Node.js globals
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        Buffer: "readonly",
        console: "readonly",
      }
    }
  },
  {
    files: ["src/__tests__/**/*.test.js"],
    languageOptions: {
      globals: {
        // Jest globals
        describe: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
      }
    }
  }
];  
