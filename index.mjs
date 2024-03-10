import { execSync, spawn } from "child_process";
import { confirm } from '@clack/prompts';
import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

const API_KEY = process.env.GROQ_API_KEY;
const groq = new Groq({
    apiKey: API_KEY
});

const systemMessage = `You are a commit message generator create a commit message in english by investigating the diff string this is the schema of good commit message:

---
<emoji> <type>(<scope>): <subject>
<body>

Indonesian translation:

<emoji> <type>(<scope>): <subject>
<body>
---

With allowed <type> values are feat, fix, perf, docs, style, refactor, test, and build. After creating commit message, translate the commit message to indonesian language and put it below \`Indonesian translation:\` text. And here's an example of a good commit message:

---
📝 docs(README): Add web demo and Clarifai project.
Adding links to the web demo and Clarifai project page to the documentation. Users can now access the GPT-4 Turbo demo application and view the Clarifai project through the provided links.

Indonesian translation:

📝 docs(README): tambah demo web dan proyek Clarifai.
Menambahkan tautan demo web dan halaman proyek Clarifai ke dalam dokumentasi. Pengguna kini dapat mengakses demo aplikasi GPT-4 Turbo dan melihat proyek Clarifai melalui tautan yang disediakan.
---

create commit message from this git diff:`;


async function gitDiffStaged() {
  const child = spawn("git", ["diff", "--staged"]);

  const output = await new Promise((resolve, reject) => {
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

  return output;
}
async function run() {
  try {
    execSync(`bash add-first-untracked.sh`);
    const diffString = await gitDiffStaged();
    if (!diffString.trim()) {
      throw { status: 5001, message: "No changes to commit" };
    }
    const completion = await groq.chat.completions.create({
      messages: [
          {
              role: "system",
              content: systemMessage
          },
          {
              role: "user",
              content: diffString
          }
      ],
      model: "mixtral-8x7b-32768"
  });
  const text=completion.choices[0]?.message?.content || "";
    let text2=text.replace(/```/g, '');
    let text3=text2.replace(/---/g, '')
    let text4=text3.replace(/\"/gi, "\\\"")
    let text5=text4.replace(/\`/gi, "\\`");
    let text6=text5.replace(/\'/gi, "\\'");
    console.log(text6)


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

run();
