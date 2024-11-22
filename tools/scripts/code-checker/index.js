const fs = require("fs");
var webdriver = require("selenium-webdriver"),
  By = webdriver.By;
var driver = new webdriver.Builder().forBrowser("chrome").build();

const srcContract = process.argv[2];
const destContract = process.argv[3];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const copySourceCode = async (url) => {
  await driver.switchTo().newWindow("tab");
  await driver.get(url);
  await sleep(5000);
  const countLabel = await driver.findElement(
    By.xpath(
      "/html[1]/body[1]/div[1]/main[1]/div[4]/div[2]/div[2]/div[1]/div[10]/div[2]/div[2]/div[1]/div[2]/span[1]"
    )
  );
  const label = await countLabel.getText();
  const count = parseInt(label.split("of")[1].split(":")[0].trim());
  const code = {};
  for (let i = 1; i <= count; i++) {
    const nameLabel = await driver.findElement(
      By.xpath(
        `/html[1]/body[1]/div[1]/main[1]/div[4]/div[2]/div[2]/div[1]/div[10]/div[2]/div[2]/div[1]/div[${
          i + 1
        }]/span[1]`
      )
    );
    const label = await nameLabel.getText();
    const fileName = label.split(":")[1].trim();
    const expandEl = await driver.findElement(
      By.xpath(
        `/html[1]/body[1]/div[1]/main[1]/div[4]/div[2]/div[2]/div[1]/div[10]/div[2]/div[2]/div[1]/div[${
          i + 1
        }]/span[2]/a[3]`
      )
    );
    try {
      await expandEl.click();
      await sleep(100);
    } catch {}
    const codeEl = await driver.findElement(
      By.xpath(
        `/html[1]/body[1]/div[1]/main[1]/div[4]/div[2]/div[2]/div[1]/div[10]/div[2]/div[2]/div[1]/pre[${i}]/div[2]/div[1]`
      )
    );
    code[fileName] = await codeEl.getText();

    try {
      await expandEl.click();
    } catch {}
  }
  return code;
};

const main = async () => {
  const srcSourceCode = await copySourceCode(
    `https://snowtrace.io/address/${srcContract}#code`
  );
  const destSourceCode = await copySourceCode(
    `https://snowtrace.io/address/${destContract}#code`
  );

  driver.quit();

  const srcFiles = Object.keys(srcSourceCode).sort();
  const destFiles = Object.keys(destSourceCode).sort();

  const srcOnlyFiles = srcFiles.filter(
    (file) => destFiles.indexOf(file) === -1
  );
  const destOnlyFiles = destFiles.filter(
    (file) => srcFiles.indexOf(file) === -1
  );
  const commonFiles = srcFiles.filter((file) => destFiles.indexOf(file) !== -1);

  if (!fs.existsSync("./src")) {
    fs.mkdirSync("./src");
  }
  if (!fs.existsSync("./dest")) {
    fs.mkdirSync("./dest");
  }

  srcFiles.map((file) => {
    const srcOutput = fs.createWriteStream(`src/${file}`);
    srcOutput.write(srcSourceCode[file]);
  });
  destFiles.map((file) => {
    const destOutput = fs.createWriteStream(`dest/${file}`);
    destOutput.write(destSourceCode[file]);
  });

  const result = [];
  srcOnlyFiles.map((file) => {
    result.push({ file, srcOnly: 'Yes', destOnly: '-', equal: "-" });
  });
  destOnlyFiles.map((file) => {
    result.push({ file, srcOnly: '-', destOnly: 'Yes', equal: "-" });
  });
  commonFiles.map((file) => {
    const srcCode = srcSourceCode[file];
    const destCode = destSourceCode[file];
    result.push({ file, srcOnly: '-', destOnly: '-', equal: srcCode === destCode ? 'Yes' : 'No' });
  });

  console.table(result);
};

main();
