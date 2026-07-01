var fs = require("fs");
var buf = fs.readFileSync("app.js");

function replaceBytes(b, find, replace) {
    var idx = b.indexOf(find);
    while (idx >= 0) {
        b = Buffer.concat([b.slice(0, idx), replace, b.slice(idx + find.length)]);
        idx = b.indexOf(find, idx + replace.length);
    }
    return b;
}

// Pattern 1: corrupted ?? -> \u25CF
var found = 0;
var p1 = Buffer.from([0xE9, 0xA6, 0x83, 0xE6, 0x86, 0x97]);
if (buf.indexOf(p1) >= 0) found++;
var r1 = Buffer.from("\\u25CF");
buf = replaceBytes(buf, p1, r1);

// Pattern 2: corrupted ?? -> \u29BF
var p2 = Buffer.from([0xE9, 0xA6, 0x83, 0xE6, 0x95, 0x80]);
if (buf.indexOf(p2) >= 0) found++;
var r2 = Buffer.from("\\u29BF");
buf = replaceBytes(buf, p2, r2);

// Pattern 3: corrupted ? -> \u25CB
var p3 = Buffer.from([0xE9, 0x8A, 0xBC, 0x3F]);
if (buf.indexOf(p3) >= 0) found++;
var r3 = Buffer.from("\\u25CB");
buf = replaceBytes(buf, p3, r3);

// Also check for direct emoji that might have survived (just in case)
var p4 = Buffer.from("??");  // direct emoji
if (buf.indexOf(p4) >= 0) {
    found++;
    buf = replaceBytes(buf, p4, r1);
}
var p5 = Buffer.from("??");  // direct emoji
if (buf.indexOf(p5) >= 0) {
    found++;
    buf = replaceBytes(buf, p5, r2);
}

fs.writeFileSync("app.js", buf);
console.log("Fixed " + found + " patterns");
