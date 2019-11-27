const chalk = require("chalk");
const fs = require("fs");
const g2js = require("gradle-to-js/lib/parser");
const path = require("path");
const plist = require("plist");

const paths = {
    androidManifest: "./app/App_Resources/Android/AndroidManifest.xml",
    buildGradle: "./app/App_Resources/Android/app.gradle",
    infoPlist: "./app/App_Resources/iOS/Info.plist",
    packageJson: "./package.json"
  };

const getVersion = async () => {
  const platform = process.argv[2];

  if (platform === "ios") {
    const plistInfo = plist.parse(fs.readFileSync(paths.infoPlist, "utf8"));
    console.log(plistInfo.CFBundleVersion);
  } else if (platform === "android") {
    const gradle = await g2js.parseFile(paths.buildGradle);
    const currentVersion = gradle.android.defaultConfig.versionName;
    const currentVersionCode = +gradle.android.defaultConfig.versionCode;
    console.log(`${currentVersion}.${currentVersionCode}`);
  }
};

getVersion();
