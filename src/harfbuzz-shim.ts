// Replaces the `harfbuzzjs` package entry (see "alias" in wrangler.jsonc / vitest.config.ts).
// The stock entry loads hb.wasm via fs/fetch, which Workers cannot do; here the wasm is bundled
// as a precompiled module and handed to the Emscripten loader.
// @ts-expect-error untyped CJS modules
import createHarfBuzz from "../node_modules/harfbuzzjs/hb.js";
// @ts-expect-error untyped CJS modules
import hbjs from "../node_modules/harfbuzzjs/hbjs.js";
import hbWasm from "../node_modules/harfbuzzjs/hb.wasm";

// The Emscripten loader reads self.location (absent in Workers) unless __filename is defined.
(globalThis as { __filename?: string }).__filename ??= "/hb.js";

const ready: Promise<unknown> = createHarfBuzz({
  instantiateWasm(imports: WebAssembly.Imports, done: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void) {
    WebAssembly.instantiate(hbWasm, imports).then((instance) => done(instance, hbWasm));
    return {};
  },
}).then((mod: any) => {
  // hbjs registers a free() destroy callback via addFunction, which compiles a wasm trampoline at
  // runtime (forbidden on Workers). The exported free() already has that signature, so put it
  // straight into the function table instead. Other addFunction uses (custom font funcs) are
  // not needed by satori and keep the stock behaviour.
  const table: WebAssembly.Table = mod.wasmExports.__indirect_function_table;
  const patched = Object.create(mod);
  patched.addFunction = (fn: unknown, sig: string) => {
    if (sig === "vi" && typeof fn === "function" && fn.length === 1) {
      const idx = table.length;
      table.grow(1);
      table.set(idx, mod.wasmExports.free);
      return idx;
    }
    return mod.addFunction(fn, sig);
  };
  return hbjs(patched);
});

export default ready;
