# Optional local matching: third-party notices

| Component | Selected version / revision | License | Source |
| --- | --- | --- | --- |
| Transformers.js | 4.3.2 | Apache-2.0 | https://github.com/huggingface/transformers.js |
| ONNX Runtime Web | Exact dependency resolved by package-lock.json | MIT, Microsoft Corporation | https://github.com/microsoft/onnxruntime/blob/main/LICENSE |
| Xenova/all-MiniLM-L6-v2 | 751bff37182d3f1213fa05d7196b954e230abad9 | Apache-2.0 declared by the model repository | https://huggingface.co/Xenova/all-MiniLM-L6-v2 |

`npm run prepare:ml` copies the CPU runtime `.mjs` / `.wasm` files from the installed dependency into generated `public/ml-runtime/`, with its MIT license and the Transformers.js Apache license. `npm run dev` and `npm run build` run preparation automatically. Generated runtime files are ignored in Git and copied into the production output by Vite. Preserve the license and notice files with distributions. Model weights are not included in this repository or downloaded by the build; they are requested from the pinned model revision after user consent and may be cached by the browser.

These permissive licenses allow use subject to their terms. They do not promise unrestricted free hosting, bandwidth, inference quality or continued model availability. See each source's full terms. Pip's SVG is original application artwork, not copied from the user's character reference.
