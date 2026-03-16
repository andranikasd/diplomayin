/**
 * Armenian Diploma Document Generator
 * Project: Intelligent Chatbot Platform for Armenian Business OSINT Data Analytics
 * Student: Grigoryan Andranik
 */

"use strict";

const DOCX_PATH = "/usr/local/lib/node_modules_global/lib/node_modules/docx";

const {
Document,
Packer,
Paragraph,
TextRun,
Table,
TableRow,
TableCell,
Header,
Footer,
AlignmentType,
HeadingLevel,
BorderStyle,
WidthType,
PageNumber
} = require(DOCX_PATH);

const fs = require("fs");


// ─────────────────────────────────────────────
// TEXT HELPERS
// ─────────────────────────────────────────────

const text = (t, opts = {}) =>
new TextRun({
text: t,
font: "Times New Roman",
size: 24,
...opts
});

const bold = (t, opts = {}) =>
text(t, { bold: true, ...opts });

function paragraph(children, opts = {}) {
if (typeof children === "string") children = [text(children)];

return new Paragraph({
children,
alignment: AlignmentType.BOTH,
spacing: { after: 160, line: 360 },
indent: { firstLine: 709 },
...opts
});
}

function center(children, opts = {}) {
if (typeof children === "string") children = [bold(children)];

return new Paragraph({
children,
alignment: AlignmentType.CENTER,
spacing: { after: 160 },
...opts
});
}

function h1(title) {
return new Paragraph({
heading: HeadingLevel.HEADING_1,
alignment: AlignmentType.CENTER,
children: [
new TextRun({
text: title,
font: "Times New Roman",
size: 28,
bold: true
})
],
spacing: { before: 480, after: 240 },
pageBreakBefore: true
});
}

function h2(title) {
return new Paragraph({
heading: HeadingLevel.HEADING_2,
children: [bold(title)],
spacing: { before: 360, after: 180 }
});
}


// ─────────────────────────────────────────────
// DOCUMENT
// ─────────────────────────────────────────────

const doc = new Document({

creator: "Grigoryan Andranik",
title: "Հայաստանի բիզնես շուկայի OSINT տվյալների ինտելեկտուալ վերլուծության հարթակ",

sections: [
{
properties: {
page: {
margin: {
top: 2834,
bottom: 2268,
left: 4252,
right: 1701
}
}
},

headers: {
default: new Header({
children: [new Paragraph({ children: [text("")] })]
})
},

footers: {
default: new Footer({
children: [
new Paragraph({
alignment: AlignmentType.CENTER,
children: [
new TextRun({
children: [PageNumber.CURRENT],
font: "Times New Roman",
size: 20
})
]
})
]
})
},

children: [

/* ───────────────── COVER PAGE ───────────────── */

center([
bold("ՀԱՅԱՍՏԱՆԻ ՀԱՆՐԱՊԵՏՈՒԹՅԱՆ"),
], { spacing: { after: 60 } }),

center([
bold("ԿՐԹՈՒԹՅԱՆ, ԳԻՏՈՒԹՅԱՆ, ՄՇԱԿՈՒՅԹԻ ԵՎ ՍՊՈՐՏԻ ՆԱԽԱՐԱՐՈՒԹՅՈՒՆ"),
]),

center([
bold("ՀԱՅԱՍՏԱՆԻ ՊԵՏԱԿԱՆ ՊՈԼԻՏԵԽՆԻԿԱԿԱՆ ՀԱՄԱԼՍԱՐԱՆ"),
]),

new Paragraph({ children: [text("")], spacing: { after: 500 } }),

center([
text("Ինֆորմատիկայի և կիրառական մաթեմատիկայի ֆակուլտետ")
]),

center([
text("Ծրագրային ճարտարագիտության և տեղեկատվական համակարգերի ամբիոն")
]),

new Paragraph({ children: [text("")], spacing: { after: 800 } }),

center([
bold("ԴԻՊԼՈՄԱՅԻՆ ԱՇԽԱՏԱՆՔ", { size: 32 })
]),

new Paragraph({ children: [text("")], spacing: { after: 200 } }),

center([
bold(
"Հայաստանի բիզնես շուկայի OSINT տվյալների\nինտելեկտուալ վերլուծության չաթբոտ հարթակ",
{ size: 30 }
)
]),

center([
text(
"Intelligent Chatbot Platform for Armenian Business OSINT Data Analytics",
{ italics: true }
)
]),

new Paragraph({ children: [text("")], spacing: { after: 700 } }),

paragraph([
text("Կատարեց՝ "),
bold("Անդրանիկ Գրիգորյան")
], { indent: {} }),

paragraph("Ուղղություն՝ Ծրագրային ճարտարագիտություն", { indent: {} }),

paragraph("Կուրս՝ 4-րդ", { indent: {} }),

paragraph("Գիտական ղեկավար՝ ____________________", { indent: {} }),

paragraph("Ամբիոնի վարիչ՝ ____________________", { indent: {} }),

paragraph("Պաշտպանություն՝ «____» __________ 2025 թ.", { indent: {} }),

paragraph("Գնահատական՝ ____________", { indent: {} }),

new Paragraph({ children: [text("")], spacing: { after: 200 } }),

center([bold("Երևան 2025")]),



/* ───────────────── ANNOTATION ───────────────── */

h1("ԱՆՈՏԱՑԻԱ"),

h2("Հայերեն"),

paragraph(
"Սույն դիպլոմային աշխատանքը նվիրված է Հայաստանի բիզնես շուկայի վերաբերյալ բաց աղբյուրներից ստացվող տվյալների ավտոմատ հավաքագրման, պահպանման և վերլուծության համար նախատեսված ինտելեկտուալ չաթբոտ հարթակի նախագծմանը և իրականացմանը։"
),

paragraph(
"Հարթակը հնարավորություն է տալիս օգտատերերին բնական լեզվով ձևակերպված հարցումների միջոցով ստանալ վերլուծական տվյալներ հայկական ընկերությունների, շուկայական միտումների, ֆինանսական ցուցանիշների և նորությունների վերաբերյալ։"
),

paragraph(
"Համակարգը կառուցված է Node.js և Express.js տեխնոլոգիաների հիման վրա՝ օգտագործելով PostgreSQL տվյալների բազա և ժամանակակից մեծ լեզվային մոդելներ (LLM) բնական լեզվի հարցումները SQL հարցումների վերածելու համար։"
),

h2("English Summary"),

paragraph(
"This thesis presents the design and implementation of an intelligent chatbot platform for collecting and analyzing OSINT data about the Armenian business ecosystem. The system allows users to query a structured PostgreSQL database using natural language and obtain analytical insights, statistics, and visualizations."
),

paragraph(
"The platform integrates modern technologies including Node.js, PostgreSQL, Redis, and large language models (LLMs) to convert natural language queries into SQL statements and generate analytical summaries."
),


/* ───────────────── INTRODUCTION ───────────────── */

h1("ՆԵՐԱԾՈՒԹՅՈՒՆ"),

paragraph(
"Ժամանակակից թվային տնտեսության պայմաններում տվյալների արդյունավետ հավաքագրումն ու վերլուծությունը դարձել են ռազմավարական նշանակության գործոններ։ Բաց աղբյուրներից ստացվող տվյալները (OSINT) լայնորեն կիրառվում են տնտեսական վերլուծության, շուկայի հետազոտությունների և բիզնես որոշումների կայացման գործընթացում։"
),

paragraph(
"Հայաստանի բիզնես միջավայրում առկա տեղեկատվությունը հաճախ բաշխված է տարբեր աղբյուրներում, ինչը դժվարացնում է տվյալների կենտրոնացված հավաքագրումն ու վերլուծությունը։"
),

paragraph(
"Սույն աշխատանքում առաջարկվում է ինտելեկտուալ չաթբոտ հարթակ, որը ավտոմատ կերպով հավաքագրում է OSINT տվյալներ, պահպանում դրանք տվյալների բազայում և ապահովում բնական լեզվով հարցումների միջոցով դրանց վերլուծությունը։"
),



/* ───────────────── CONCLUSION ───────────────── */

h1("ԵԶՐԱԿԱՑՈՒԹՅՈՒՆ"),

paragraph(
"Աշխատանքի ընթացքում նախագծվել և իրականացվել է Հայաստանի բիզնես շուկայի վերաբերյալ բաց աղբյուրներից տվյալների հավաքագրման և վերլուծության ինտելեկտուալ համակարգ։"
),

paragraph(
"Ներկայացված լուծումը հնարավորություն է տալիս ավտոմատ կերպով հավաքել, մշակել և վերլուծել բիզնես տվյալները՝ օգտագործելով բնական լեզվի մշակման և մեծ լեզվային մոդելների տեխնոլոգիաները։"
),

paragraph(
"Ստացված արդյունքները ցույց են տալիս, որ նման հարթակները կարող են արդյունավետ գործիք հանդիսանալ բիզնես վերլուծության և շուկայի հետազոտությունների համար։"
)

]
}
]
});


// ───────────────── SAVE FILE ─────────────────

const outPath =
"/sessions/affectionate-cool-faraday/mnt/tam/diploma_armenian_clean.docx";

Packer.toBuffer(doc)
.then(buf => {
fs.writeFileSync(outPath, buf);
console.log("Document created:", outPath);
})
.catch(e => {
console.error(e);
});
