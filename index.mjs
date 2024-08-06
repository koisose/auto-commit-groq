#!/usr/bin/env node
import { execSync, spawn } from "child_process";
import { confirm,select } from '@clack/prompts';
import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

const API_KEY = process.env.GROQ_API_KEY;
const groq = new Groq({
    apiKey: API_KEY
});

const systemMessage = `You are a commit message generator create a commit message in english by their diff string, 
you don't need to explain anything just put the commit message, this is the schema:

---
<emoji> <type>(<scope>): <subject>
<body>
---

With allowed <type> values are feat, fix, perf, docs, style, refactor, test, and build. After creating commit message, translate the commit message to indonesian language and put it below \`Indonesian translation:\` text. And here's an example of a good commit message:

---
🐛 fix(package): Update version number
Update the version number to 1.0.33 in the package.json file.

Indonesian translation:

🐛 perbaiki(package): Perbarui nomor versi
Memperbarui nomor versi menjadi 1.0.33 dalam file package.json.
---`;
const systemMessageEnglishOnly = `You are a commit message generator create a commit message in english by their diff string, 
you don't need to explain anything just put the commit message, this is the schema:

---
<emoji> <type>(<scope>): <subject>
<body>
---

With allowed <type> values are feat, fix, perf, docs, style, refactor, test, and build. And here's an example of a good commit message:

---
📝 docs(README): Add web demo and Clarifai project.
Adding links to the web demo and Clarifai project page to the documentation. Users can now access the GPT-4 Turbo demo application and view the Clarifai project through the provided links.
---`;
async function gitAdd() {
  const child = spawn("git", ["add", "."]);
  await new Promise((resolve, reject) => {
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Git command failed with exit code ${code}`));
      }
    });
    child.stderr.on("data", (data) => {
      if (data.toString().includes('nothing to commit')) {
        reject(new Error('Nothing to commit'));
      }
      console.error(data.toString());
    });
  });
}
async function readFirstFileDiff(fileName) {
  const child = spawn("git", ["diff", "--staged", fileName]);
  const diffOutput = await new Promise((resolve, reject) => {
    let stdout = "";
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Git command failed with exit code ${code}`));
      }
    });
    child.stderr.on("data", (data) => {
      console.error(data.toString());
    });
  });
  return diffOutput;
}
async function gitDiffStaged() {
  const child = spawn("git", ["diff", "--staged", "--name-only", "--diff-filter=d"]);
  const output = await new Promise((resolve, reject) => {
    let stdout = "";
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`aGit command failed with exit code ${code}`));
      }
    });
    child.stderr.on("data", (data) => {
      console.error(data.toString());
    });
  });

  const files = output.trim().split('\n');
  let shortestFile = files[0];
  let shortestDiffLength = Infinity;
  for (const file of files) {
    const diff = await readFirstFileDiff(file);
    if (diff.length < shortestDiffLength) {
      shortestFile = file;
      shortestDiffLength = diff.length;
    }
  }
  const diff = await readFirstFileDiff(shortestFile);
  return diff;



}

async function run() {
  try {
    await gitAdd()
    const diffString = await gitDiffStaged();
    if (!diffString.trim()) {
      throw { status: 5001, message: "No changes to commit" };
    }
//     console.log(diffString)
//     execSync("git reset")
// return
 
    const completion = await groq.chat.completions.create({
      messages: [
          {
              role: "system",
              content: systemMessageEnglishOnly
          },
          { role: 'user', content: `diff --git a/bun.lockb b/bun.lockb
            new file mode 100755
            index 0000000..7a2303c
            Binary files /dev/null and b/bun.lockb differ
            ` }, 
          {
            role: "assistant",
            content: "🌍feat(bun.lockb): Bun integration\nOur bun is now integrated into our project. This commit adds the ability to use a bun in our project.\n---\n\n\n"
          },
          {
              role: "user",
              content: diffString
          }
      ],
      model: "gemma-7b-it"
  });
  
  const text=completion.choices[0]?.message?.content || "";
    let text2=text.replace(/```/g, '');
    let text3=text2.replace(/---/g, '')
    let text4=text3.replace(/\"/gi, "\\\"")
    let text5=text4.replace(/\`/gi, "\\`");
    let text6=text5.replace(/\'/gi, "\\'");

    console.log(text6.trim())
    const stop = await confirm({
      message: 'stop?'
    });
    if(stop){
      execSync(`git reset`);
      process.exit();
    }
    const commitOnly = await confirm({
      message: 'commit only?'
    });
    if(commitOnly){
      execSync(`git add -A`);
      execSync(`printf "${text6}" | git commit -F-`);
      process.exit();
    }
    const shouldContinue = await confirm({
      message: 'Do you want to push?',
    });
    if(shouldContinue){
      execSync(`git add -A`);
      execSync(`printf "${text6}" | git commit -F-`);
      execSync("git push -u origin main");
    }else{
      execSync(`git reset`);
    }

    process.exit();
  } catch (e) {
    console.log(e.message);
    execSync(`git reset`);
    process.exit();
  }
}
run()