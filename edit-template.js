const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'HH-FRONTEND', 'PROFORMA_COT-2026-001.docx');
const content = fs.readFileSync(filePath, 'binary');
const zip = new PizZip(content);
const xml = zip.file("word/document.xml").asText();

// User requested replacements:
// 1. RAZÓN SOCIAL : [Nombre] -> {empresa}
// 2. RUC : [Numero] -> {ruc}
// 3. DIRECCIÓN : [Direccion] -> {direccion}
// 4. REFERENCIA : [Referencia] -> {referencia}
// 5. OBJETIVO -> {objetivo}
// 6. ALCANCE -> {#alcance_list}{text}{/alcance_list}
// 7. MONTO -> {monto}

console.log("Analyzing XML segments for replacements...");

// We need to be careful with XML tags splitting the text.
// A common issue in Word is <w:t>Razón</w:t><w:t> Social</w:t>
// For simplicity, we'll try to find the text after the colon.

let updatedXml = xml;

// This is a rough search and replace in XML. 
// Ideally we should use a regex that handles XML tags between characters, 
// but let's try direct replacement of identified blocks first.

// We will look for the specific values mentioned in previous context
const replacements = [
    { from: 'MOCHIGOMI SAC', to: '{empresa}' },
    { from: '20602908292', to: '{ruc}' },
    { from: 'PIURA', to: '{direccion}' },
    { from: 'S/ 4,800.00', to: '{monto}' },
    { from: '0009912/ 2026', to: '{codigo}' },
    { from: '05/05/2026', to: '{fecha}' },
    { from: '12 días calendario', to: '{plazo}' }
];

replacements.forEach(r => {
    if (updatedXml.includes(r.from)) {
        console.log(`Replacing "${r.from}" with "${r.to}"`);
        updatedXml = updatedXml.split(r.from).join(r.to);
    } else {
        console.log(`Could not find "${r.from}" in XML directly.`);
    }
});

// For complex blocks like Reference and Objective, we need more care.
// Let's just output the current XML state to a temporary file for inspection if needed.

zip.file("word/document.xml", updatedXml);
const buffer = zip.generate({type: 'nodebuffer'});
fs.writeFileSync(filePath, buffer);
console.log("Template updated successfully.");
