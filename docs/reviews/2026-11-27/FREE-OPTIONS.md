# Free and open-source options worth considering

Primary sources checked on 27 November 2026. These are research candidates, not installed integrations or measured improvements. Verify the selected artifact/version/license again when implementing. Open-source software, open model weights and a hosted free tier are different things.

## Recommended shortlist

| Option | Relevant use | Free/cost boundary | Fit and recommendation |
|---|---|---|---|
| [Ollama](https://github.com/ollama/ollama) + [Qwen3-4B-Instruct-2507](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507) | Optional local wording, classification and structured drafts | Ollama MIT; this Qwen artifact Apache-2.0. Local compute, memory, electricity and downloads remain the user's responsibility | Pilot in the local Workbench only. Compare quality/latency against the current provider before recommending a default. A 4B candidate is not proof of suitability for the user's hardware |
| [Transformers.js](https://github.com/huggingface/transformers.js) + [BGE-small-en-v1.5](https://huggingface.co/BAAI/bge-small-en-v1.5) | Semantic paragraph/page retrieval for relevant link candidates and evidence selection | Library Apache-2.0; listed model MIT. Browser/Node compute and model assets still cost resources | Strong candidate after a simple lexical baseline. This model is English-focused. Validate the actual ONNX/quantised artifact and multilingual needs; similarity is not editorial confidence |
| [Lighthouse](https://github.com/GoogleChrome/lighthouse) | Performance reports without a shared PageSpeed API allowance | Apache-2.0; Chrome and local CPU required; local testing time is real | High value. Existing JSON import already works as an integration point. Later add a queued local worker for selected URLs, not every crawled page by default |
| [Mozilla Readability](https://github.com/mozilla/readability) | Candidate extraction of main article content for AI evidence | Apache-2.0; DOM parsing resources required | Compare with the current parser on editorial pages. It can omit important product/service details; retain raw evidence and fallback. It is not a sanitizer or a universal replacement parser |
| [Playwright](https://github.com/microsoft/playwright) + [axe-core](https://github.com/dequelabs/axe-core) | Real UI flow, narrow viewport, focus, accessibility regression checks | Playwright Apache-2.0; axe-core MPL-2.0; local/CI compute required | First testing investment. Use development-only tooling; automated checks do not certify usability or accessibility. [Official integration guide](https://playwright.dev/docs/accessibility-testing) |
| [Promptfoo](https://github.com/promptfoo/promptfoo) | Reproducible prompt/provider/model comparison | Repository license is MIT-style; optional services/provider inference have separate terms/costs | Optional dev tool. The existing Node test runner is sufficient for deterministic validators; add the CLI only if model comparison becomes recurring |

Ollama supports schema-based structured outputs locally; its current documentation says cloud structured outputs are not supported. JSON conformity still does not prove factual support. [Structured-output documentation](https://docs.ollama.com/capabilities/structured-outputs).

Transformers.js can run models in the browser using ONNX Runtime, and documents quantisation and Node usage. A compatible model export is still required; do not assume every Hugging Face checkpoint works directly. Lazy-load in a worker, allow cancellation and show download size before starting. [Official documentation](https://huggingface.co/docs/transformers.js/en/index).

## Useful APIs and what they can actually supply

| API/data path | What it adds | Limit and deployment decision |
|---|---|---|
| [Search Console API](https://developers.google.com/webmaster-tools/about) or existing ZIP import | Actual authorised-site search measurements; joint dimensions when queried that way | OAuth/property permission for direct connection, quotas and incomplete/top-row coverage. ZIP needs no new provider integration. Neither route gives competitor traffic. [Usage limits](https://developers.google.com/webmaster-tools/limits) |
| [PageSpeed Insights](https://developers.google.com/speed/docs/insights/v5/get-started) | Google's Lighthouse lab results and recommendations | Keyless requests are supported; Google recommends a key for frequent use. Quotas/reachability remain. Preserve existing user-key and JSON fallback rather than promise a reliable unlimited shared key |
| [CrUX API](https://developer.chrome.com/docs/crux/api/) | Aggregated real-user experience metrics where Google has coverage | Requires a Google Cloud API key. Coverage can be absent; this is not a Lighthouse score. Present page/origin granularity and collection window distinctly. Keep any lab and field sources separate |
| [Gemini Developer API free tier](https://ai.google.dev/gemini-api/docs/pricing) | Optional hosted text generation for eligible accounts/models | Limited models and project quotas; not open-source inference. Current free-tier pricing says content can be used to improve products, so do not silently send client evidence. User-selected provider/consent and current account terms are prerequisites. [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) |
| [GroqCloud](https://console.groq.com/docs/rate-limits) | Another optional hosted inference candidate | Model/organisation limits apply. Do not treat availability of hosted open-weight models as unlimited free compute. Recheck the user's plan, supported model and data terms before any integration |

No researched option establishes a reliable, complete, unlimited-free SERP, keyword-volume, difficulty or competitor-traffic feed for this product. Model suggestions are not those measurements. For a no-subscription competitor MVP, accept user-selected competitor URLs, crawl a bounded sample, compare documented topics/intents and cite excerpts. Let users add a dated manual SERP observation; do not scrape search engines or call invented rankings “research”.

## Best no-new-subscription architecture

1. Keep the current deterministic crawl, manual plan and response checks useful without a provider.
2. Improve extraction/retrieval and validators in the existing app before adding model infrastructure.
3. Reuse GSC ZIP and Lighthouse JSON as optional user-supplied evidence, with truthful dates/dimensions/device labels.
4. Add local semantic retrieval after comparing it to lexical matching. Do not make a model download mandatory for the first useful action.
5. Pilot one local text model in the local app. Retain explicit user-key NVIDIA as an alternative; do not claim its existing allowance is permanently free.
6. Hosted deployment keeps manual features/imports and explicit provider choices. Vercel server functions cannot reach the visitor's Ollama by connecting to the server's localhost. Do not expose Ollama publicly or add arbitrary private-network proxy URLs. A remote/local bridge is a separate permission/security design.

Local Lighthouse needs a separate bounded browser job with URL/network restrictions; do not weaken crawler SSRF or robots protections to add it. No hosted Chromium workload or cloud GPU is proposed as cost-free.

## Adoption order

**First:** fix the interaction defects and add deterministic validation plus a small browser regression suite. **Second:** GSC evidence selection and semantic link retrieval. **Third:** a measured local-model/Lighthouse pilot. Additional hosted providers are optional, because provider variety does not solve the present evidence/flow problems.

Nothing in this shortlist was installed or connected during report preparation. No model weights were downloaded and no API quota was consumed for generation or speed testing.
