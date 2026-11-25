import { readFile, mkdir, writeFile } from "node:fs/promises";
import { zipSync } from "fflate";
const source = await readFile(
  new URL(
    "../wordpress/local-seo-repairs/local-seo-repairs.php",
    import.meta.url,
  ),
);
const directory = new URL("../dist/downloads/", import.meta.url);
await mkdir(directory, { recursive: true });
const archive = zipSync({ "local-seo-repairs/local-seo-repairs.php": source });
await writeFile(new URL("local-seo-repairs.zip", directory), archive);
const development = new URL("../public/downloads/", import.meta.url);
await mkdir(development, { recursive: true });
await writeFile(new URL("local-seo-repairs.zip", development), archive);
console.log("Built the WordPress companion download from reviewed source.");
