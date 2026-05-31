import { createSmallRetailShopScene } from "../src/demo-scenes/small-retail-shop";
import { simulateStudio } from "@sentineltwin/simulation";
import { buildReportData, exportAsMarkdown, exportAsHtml, exportAsText } from "@sentineltwin/report";

const scene = createSmallRetailShopScene();
const result = simulateStudio(scene);
const report = buildReportData(scene, result);

console.log("=== MARKDOWN ===");
console.log(exportAsMarkdown(report));
console.log("\n\n=== TEXT ===");
console.log(exportAsText(report));
console.log("\n\n=== HTML SECTIONS ===");
// Extract section headers
const html = exportAsHtml(report);
const sections = html.match(/<h2>(.*?)<\/h2>/g);
if (sections) sections.forEach(s => console.log(s));
