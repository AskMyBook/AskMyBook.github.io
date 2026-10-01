// بيولّد persona.js (للمتصفح) من server/persona.js عشان المصدر يبقى واحد.
import { TEACHER_PERSONA } from "../server/persona.js";
import { writeFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
writeFileSync(fileURLToPath(new URL("../persona.js", import.meta.url)), "// مولَّد تلقائيًا من server/persona.js — متعدّلوش بإيدك، شغّل: npm run bundle\nwindow.TEACHER_PERSONA = " + JSON.stringify(TEACHER_PERSONA) + ";\n");
process.stdout.write("persona.js generated " + TEACHER_PERSONA.length + " chars\n");
